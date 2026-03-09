/**
 * 插件接口类型定义
 *
 * Flashmini 的插件系统参考了 Webpack 的 Tapable 设计理念，
 * 但做了大幅简化以保持轻量。插件通过 apply 方法注册钩子回调，
 * 在上传生命周期的各个阶段被调用。
 *
 * 插件可以是：
 * 1. 内置插件 — 随 flashmini 包一起发布（如 git-log、version-bump）
 * 2. 第三方插件 — 通过 npm 包名引用
 * 3. 本地插件 — 通过相对路径引用项目内的自定义插件文件
 */

import type { HookManager } from '../plugins/hook-manager'

/**
 * 插件接口
 *
 * 所有插件（无论是内置的还是用户自定义的）都必须实现此接口。
 * 插件通过 apply 方法接收 HookManager 实例，在其上注册钩子回调。
 *
 * @example
 * ```typescript
 * const myPlugin: Plugin = {
 *   name: 'my-plugin',
 *   apply(hooks) {
 *     hooks.tap('beforeUpload', async (ctx, platform) => {
 *       console.log(`即将上传到 ${platform}`)
 *     })
 *   },
 * }
 * ```
 */
export interface Plugin {
  /** 插件名称，用于日志输出和调试（建议使用 'scope:name' 格式） */
  name: string
  /** 插件注册入口，在此方法中通过 hooks.tap() 注册生命周期钩子回调 */
  apply(hooks: HookManager): void
}

/**
 * 插件配置项（用于配置文件中声明插件）
 *
 * 用户在 flashmini.config.ts 的 plugins 数组中使用此格式声明要加载的插件。
 * use 字段支持三种格式：
 * - npm 包名：'flashmini-plugin-xxx'
 * - 内置插件路径：'flashmini/plugins/git-log'
 * - 本地文件路径：'./scripts/my-plugin.ts'
 *
 * @example
 * ```typescript
 * plugins: [
 *   { use: 'flashmini/plugins/git-log' },
 *   { use: './scripts/my-plugin.ts', options: { verbose: true } },
 * ]
 * ```
 */
export interface PluginConfig {
  /** 插件路径或 npm 包名 */
  use: string
  /** 传递给插件的自定义选项 */
  options?: Record<string, unknown>
}
