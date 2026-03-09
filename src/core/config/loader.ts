/**
 * 配置文件加载器
 *
 * 使用 Cosmiconfig 库自动查找和加载配置文件。
 * Cosmiconfig 支持多种配置文件格式，按优先级顺序查找：
 *
 * 1. flashmini.config.ts  ← 推荐（有 TypeScript 类型提示）
 * 2. flashmini.config.js
 * 3. flashmini.config.mjs
 * 4. .flashminirc.ts
 * 5. .flashminirc.json
 * 6. package.json 的 "flashmini" 字段
 *
 * 找到第一个即停止查找，返回解析后的配置对象。
 *
 * @see https://github.com/cosmiconfig/cosmiconfig Cosmiconfig 文档
 */

import { cosmiconfig } from 'cosmiconfig'
import { CONFIG_MODULE_NAME } from './defaults'

/**
 * 创建 Cosmiconfig 配置探索器实例
 *
 * 配置了模块名称为 'flashmini'，Cosmiconfig 会据此
 * 自动查找 flashmini.config.ts、.flashminirc.json 等文件。
 */
const explorer = cosmiconfig(CONFIG_MODULE_NAME, {
  // 指定搜索的文件名列表（按优先级排序）
  searchPlaces: [
    'flashmini.config.ts',
    'flashmini.config.js',
    'flashmini.config.mjs',
    '.flashminirc.ts',
    '.flashminirc.json',
    'package.json',
  ],
})

/**
 * 配置加载结果
 *
 * 包含解析后的配置对象和配置文件的路径信息，
 * 路径信息用于在错误提示中告知用户配置文件的位置。
 */
export interface LoadConfigResult {
  /** 解析后的原始配置对象（尚未经过 Zod 校验） */
  config: Record<string, unknown>
  /** 配置文件的绝对路径 */
  filepath: string
}

/**
 * 加载配置文件
 *
 * 从当前工作目录开始向上查找配置文件。
 * 如果找到配置文件，返回解析后的配置对象和文件路径；
 * 如果未找到任何配置文件，返回 null。
 *
 * @param searchFrom - 开始搜索的目录路径（默认为当前工作目录）
 * @returns 配置加载结果，未找到时返回 null
 *
 * @example
 * ```typescript
 * const result = await loadConfig()
 * if (!result) {
 *   console.error('未找到配置文件，请先运行 flashmini init')
 *   process.exit(1)
 * }
 * console.log('配置文件路径:', result.filepath)
 * console.log('配置内容:', result.config)
 * ```
 */
export async function loadConfig(
  searchFrom?: string,
): Promise<LoadConfigResult | null> {
  // Cosmiconfig 的 search() 方法会从指定目录开始向上查找
  const result = await explorer.search(searchFrom)

  // 未找到任何配置文件
  if (!result || result.isEmpty) {
    return null
  }

  return {
    config: result.config as Record<string, unknown>,
    filepath: result.filepath,
  }
}

/**
 * 从指定路径加载配置文件
 *
 * 直接加载指定路径的配置文件，不进行自动搜索。
 * 适用于用户通过 CLI 参数 --config 指定配置文件路径的场景。
 *
 * @param filepath - 配置文件的绝对或相对路径
 * @returns 配置加载结果
 * @throws 当文件不存在或解析失败时抛出错误
 *
 * @example
 * ```typescript
 * const result = await loadConfigFromFile('./custom-config.ts')
 * ```
 */
export async function loadConfigFromFile(
  filepath: string,
): Promise<LoadConfigResult> {
  const result = await explorer.load(filepath)

  if (!result || result.isEmpty) {
    throw new Error(`配置文件为空或无法解析: ${filepath}`)
  }

  return {
    config: result.config as Record<string, unknown>,
    filepath: result.filepath,
  }
}
