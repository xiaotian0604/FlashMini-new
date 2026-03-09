/**
 * 环境变量工具函数
 *
 * 提供环境变量的读取和合并功能。
 * 在 CI/CD 场景中，敏感信息（如密钥、Webhook URL）通常通过环境变量传递，
 * 而非写在配置文件中。本模块负责将环境变量与配置文件中的值进行合并。
 *
 * 环境变量命名规范：
 * - 统一使用 FLASHMINI_ 前缀
 * - 平台相关：FLASHMINI_WECHAT_APP_ID、FLASHMINI_ALIPAY_TOOL_ID
 * - 通知相关：FLASHMINI_FEISHU_WEBHOOK、FLASHMINI_DINGTALK_WEBHOOK
 * - 通用：FLASHMINI_VERSION、FLASHMINI_ENV
 *
 * 优先级：CLI 参数 > 环境变量 > 配置文件
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * 从环境变量中读取指定的值
 *
 * 如果环境变量存在且非空，返回其值；否则返回 undefined。
 * 用于在配置合并时判断是否需要用环境变量覆盖配置文件中的值。
 *
 * @param key - 环境变量名称
 * @returns 环境变量的值，不存在或为空时返回 undefined
 *
 * @example
 * ```typescript
 * // 设置了 FEISHU_WEBHOOK=https://...
 * getEnv('FEISHU_WEBHOOK') // 'https://...'
 * // 未设置 SOME_VAR
 * getEnv('SOME_VAR') // undefined
 * ```
 */
export function getEnv(key: string): string | undefined {
  const value = process.env[key]
  // 空字符串视为未设置
  return value && value.trim() !== '' ? value.trim() : undefined
}

/**
 * 从环境变量中读取 Flashmini 专属配置
 *
 * 读取所有以 FLASHMINI_ 为前缀的环境变量，
 * 将其转换为配置对象的嵌套结构。
 *
 * @returns 从环境变量中提取的配置覆盖对象
 *
 * @example
 * ```typescript
 * // 环境变量：FLASHMINI_VERSION=2.0.0
 * const envConfig = getFlashminiEnvConfig()
 * // { version: '2.0.0' }
 * ```
 */
export function getFlashminiEnvConfig(): Record<string, unknown> {
  const config: Record<string, unknown> = {}

  // 版本号覆盖
  const version = getEnv('FLASHMINI_VERSION')
  if (version) config.version = version

  // 环境标识
  const env = getEnv('FLASHMINI_ENV') || getEnv('FLASH_ENV')
  if (env) config.env = env

  return config
}

/**
 * 解析版本号
 *
 * 根据配置中的 version 字段值，解析出最终使用的版本号：
 * - 'auto'：从项目的 package.json 中读取 version 字段
 * - 其他字符串：直接使用该字符串作为版本号
 *
 * @param versionConfig - 配置文件中的 version 字段值
 * @returns 解析后的版本号字符串
 * @throws 当设置为 'auto' 但无法读取 package.json 时抛出错误
 *
 * @example
 * ```typescript
 * await resolveVersion('auto')    // '1.2.3'（从 package.json 读取）
 * await resolveVersion('2.0.0')   // '2.0.0'（直接使用）
 * ```
 */
export async function resolveVersion(versionConfig: string): Promise<string> {
  if (versionConfig === 'auto') {
    try {
      // 从当前工作目录的 package.json 中读取版本号
      const pkgPath = resolve(process.cwd(), 'package.json')
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      return pkg.version || '0.0.0'
    } catch {
      console.warn('无法读取 package.json，使用默认版本号 0.0.0')
      return '0.0.0'
    }
  }
  return versionConfig
}

/**
 * 解析上传描述
 *
 * 根据配置中的 description 字段值，解析出最终使用的上传描述：
 * - 'git'：读取最近一条 git commit message
 * - 其他字符串：直接使用该字符串作为描述
 *
 * @param descConfig - 配置文件中的 description 字段值
 * @returns 解析后的描述字符串
 *
 * @example
 * ```typescript
 * await resolveDescription('git')           // 'feat: 新增上传功能'
 * await resolveDescription('手动发布 v2.0') // '手动发布 v2.0'
 * ```
 */
export async function resolveDescription(descConfig: string): Promise<string> {
  if (descConfig === 'git') {
    // 延迟导入避免循环依赖
    const { getLastCommitMessage } = await import('./git')
    const message = await getLastCommitMessage()
    return message || 'no description'
  }
  return descConfig
}
