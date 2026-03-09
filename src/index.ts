/**
 * Flashmini 包入口
 *
 * 这是 flashmini npm 包的主入口文件，同时导出：
 * 1. Node.js API — 供代码集成场景使用（如在构建脚本中调用）
 * 2. 类型定义 — 供 TypeScript 用户获取类型提示
 * 3. 工具函数 — 供插件开发者使用
 *
 * 双调用模式：
 * - CLI 模式：通过 `flashmini upload` 命令调用（入口为 cli/index.ts）
 * - API 模式：通过 `import { upload } from 'flashmini'` 调用（入口为本文件）
 *
 * @example
 * ```typescript
 * // Node.js API 调用方式
 * import { upload } from 'flashmini'
 *
 * const ctx = await upload({
 *   config: './flashmini.config.ts',
 *   platforms: ['wechat'],
 *   env: 'prod',
 * })
 *
 * console.log(ctx.results)
 * ```
 *
 * @example
 * ```typescript
 * // 类型导入
 * import type { FlashminiConfig, Plugin, UploadResult } from 'flashmini'
 * ```
 *
 * @example
 * ```typescript
 * // 配置文件中使用 defineConfig
 * import { defineConfig } from 'flashmini'
 *
 * export default defineConfig({
 *   version: 'auto',
 *   platforms: { wechat: { enabled: true, ... } }
 * })
 * ```
 */

// ─── 类型导出 ────────────────────────────────────────────────────
export type {
  FlashminiConfig,
  WechatConfig,
  AlipayConfig,
  BaiduConfig,
  BytedanceConfig,
  NotifyFeishuConfig,
  NotifyDingtalkConfig,
  NotifyWebhookConfig,
  PluginConfigItem,
} from './types/config'

export type { UploadResult, PlatformNameType } from './types/platform'
export type { Plugin, PluginConfig } from './types/plugin'

// ─── 类和工具导出 ────────────────────────────────────────────────
export { Context } from './core/context'
export { defineConfig } from './types/index'
export { HookManager } from './plugins/hook-manager'
export { PlatformFactory } from './platforms/factory'
export { FlashminiError, ErrorCode } from './utils/errors'

// ─── 核心模块导出 ────────────────────────────────────────────────
import { loadConfig, loadConfigFromFile } from './core/config/loader'
import { ConfigSchema } from './core/config/schema'
import { Runner, type RunOptions } from './core/runner'

/**
 * Node.js API 调用选项
 */
export interface UploadApiOptions {
  /** 配置文件路径（可选，不提供则自动搜索） */
  config?: string
  /** 指定上传的平台列表 */
  platforms?: string[]
  /** 运行环境标识 */
  env?: string
  /** 试运行模式 */
  dryRun?: boolean
}

/**
 * Node.js API 入口函数
 *
 * 提供编程方式调用 Flashmini 上传功能。
 * 适用于在构建脚本、CI 脚本或其他 Node.js 代码中集成上传逻辑。
 *
 * @param options - API 调用选项
 * @returns 包含所有上传结果的 Context 对象
 * @throws FlashminiError 当配置加载失败或上传出错时
 *
 * @example
 * ```typescript
 * import { upload } from 'flashmini'
 *
 * const ctx = await upload({
 *   config: './flashmini.config.ts',
 *   platforms: ['wechat'],
 *   env: 'prod',
 * })
 *
 * if (ctx.isAllSuccess) {
 *   console.log('所有平台上传成功！')
 * } else {
 *   console.log('失败的平台:', ctx.failedPlatforms)
 * }
 * ```
 */
export async function upload(options: UploadApiOptions = {}) {
  // ─── 加载配置 ──────────────────────────────────────────────────
  const raw = options.config
    ? await loadConfigFromFile(options.config)
    : await loadConfig()

  if (!raw) {
    throw new Error('未找到配置文件，请先运行 flashmini init 或指定 config 路径')
  }

  // ─── 校验配置 ──────────────────────────────────────────────────
  const result = ConfigSchema.safeParse(raw.config)

  if (!result.success) {
    const errors = result.error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join('\n')
    throw new Error(`配置校验失败:\n${errors}`)
  }

  // ─── 执行上传 ──────────────────────────────────────────────────
  const runner = new Runner(result.data)
  const runOptions: RunOptions = {
    env: options.env || 'prod',
    platforms: options.platforms,
    dryRun: options.dryRun,
  }

  return runner.run(runOptions)
}
