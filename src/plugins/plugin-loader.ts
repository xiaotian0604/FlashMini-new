/**
 * 插件加载器
 *
 * 负责根据配置文件中的 plugins 数组，加载并初始化所有插件。
 * 插件来源支持三种格式：
 *
 * 1. 内置插件路径：'flashmini/plugins/git-log'
 *    → 从 flashmini 包内的 built-in 目录加载
 *
 * 2. npm 包名：'flashmini-plugin-xxx'
 *    → 通过 require/import 从 node_modules 加载
 *
 * 3. 本地文件路径：'./scripts/my-plugin.ts'
 *    → 从项目目录中加载用户自定义插件
 *
 * 加载流程：
 * 1. 遍历 plugins 配置数组
 * 2. 根据 use 字段判断插件来源类型
 * 3. 动态导入插件模块
 * 4. 调用插件的 apply() 方法，将 HookManager 传入
 * 5. 插件在 apply() 中通过 hooks.tap() 注册钩子回调
 */

import { resolve } from 'path'
import type { HookManager } from './hook-manager'
import type { Plugin, PluginConfig } from '../types/plugin'
import { FlashminiError, ErrorCode } from '../utils/errors'

/**
 * 内置插件名称到模块的映射
 *
 * 内置插件直接通过 import 引入，无需动态加载。
 * 新增内置插件时需要在此处注册。
 */
const BUILT_IN_PLUGINS: Record<string, () => Promise<{ default: Plugin } | Plugin>> = {
  'flashmini/plugins/git-log': () => import('./built-in/git-log'),
  'flashmini/plugins/version-bump': () => import('./built-in/version-bump'),
}

/**
 * 加载并初始化所有插件
 *
 * 遍历配置文件中的 plugins 数组，依次加载每个插件并调用其 apply() 方法。
 * 插件按照配置中的顺序加载和初始化，钩子回调也按此顺序执行。
 *
 * @param pluginConfigs - 配置文件中的插件配置数组
 * @param hookManager - 钩子管理器实例，传递给每个插件
 *
 * @example
 * ```typescript
 * await loadPlugins(config.plugins, hookManager)
 * // 所有插件的钩子回调已注册到 hookManager 中
 * ```
 */
export async function loadPlugins(
  pluginConfigs: PluginConfig[],
  hookManager: HookManager,
  baseDir: string = process.cwd(),
): Promise<void> {
  for (const pluginConfig of pluginConfigs) {
    try {
      // 加载插件模块
      const plugin = await resolvePlugin(pluginConfig, baseDir)

      // 调用插件的 apply 方法，传入 HookManager
      plugin.apply(hookManager)

      console.log(`[flashmini] 插件已加载: ${plugin.name}`)
    } catch (err) {
      throw new FlashminiError(
        `插件加载失败: ${pluginConfig.use} — ${(err as Error).message}`,
        ErrorCode.PLUGIN_ERROR,
      )
    }
  }
}

/**
 * 解析并加载单个插件
 *
 * 根据插件配置的 use 字段，判断插件来源并动态加载。
 * 支持三种来源：内置插件、npm 包、本地文件。
 *
 * @param config - 单个插件的配置项
 * @returns 加载后的插件对象
 * @throws 当插件文件不存在或导出格式不正确时抛出错误
 */
async function resolvePlugin(
  config: PluginConfig,
  baseDir: string,
): Promise<Plugin> {
  const { use, options } = config

  // ─── 情况 1：内置插件 ──────────────────────────────────────────
  if (BUILT_IN_PLUGINS[use]) {
    const mod = await BUILT_IN_PLUGINS[use]()
    return extractPlugin(mod, options)
  }

  // ─── 情况 2：本地文件路径（以 ./ 或 ../ 开头） ─────────────────
  if (use.startsWith('./') || use.startsWith('../')) {
    const absolutePath = resolve(baseDir, use)
    const mod = await import(absolutePath)
    return extractPlugin(mod, options)
  }

  // ─── 情况 3：npm 包名 ─────────────────────────────────────────
  const mod = await import(use)
  return extractPlugin(mod, options)
}

/**
 * 从模块导出中提取插件对象
 *
 * 插件模块可以使用以下任一导出方式：
 * - export default plugin（默认导出）
 * - export const plugin = ...（命名导出）
 * - module.exports = plugin（CJS 导出）
 * - export default function createPlugin(options)（工厂函数）
 *
 * @param mod - 动态导入的模块对象
 * @param options - 插件选项（传递给工厂函数）
 * @returns 标准化的插件对象
 * @throws 当模块导出格式不符合插件接口时抛出错误
 */
function extractPlugin(
  mod: any,
  options?: Record<string, unknown>,
): Plugin {
  // 尝试获取默认导出
  const exported = mod.default || mod

  // 如果导出的是工厂函数，调用它并传入 options
  if (typeof exported === 'function') {
    const plugin = exported(options || {})
    validatePlugin(plugin)
    return plugin
  }

  // 如果导出的是插件对象，直接使用
  if (isPlugin(exported)) {
    return exported
  }

  throw new Error('插件模块必须导出一个包含 name 和 apply 属性的对象，或一个返回此对象的工厂函数')
}

/**
 * 校验对象是否符合 Plugin 接口
 *
 * 检查对象是否包含必需的 name（字符串）和 apply（函数）属性。
 *
 * @param obj - 待校验的对象
 * @returns 是否符合 Plugin 接口
 */
function isPlugin(obj: unknown): obj is Plugin {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as any).name === 'string' &&
    typeof (obj as any).apply === 'function'
  )
}

/**
 * 校验插件对象的合法性
 *
 * @param plugin - 待校验的插件对象
 * @throws 当插件对象不符合接口要求时抛出错误
 */
function validatePlugin(plugin: unknown): asserts plugin is Plugin {
  if (!isPlugin(plugin)) {
    throw new Error('插件工厂函数必须返回一个包含 name（字符串）和 apply（函数）属性的对象')
  }
}
