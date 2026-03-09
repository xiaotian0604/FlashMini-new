/**
 * 类型系统统一导出
 *
 * 本文件作为类型系统的唯一出口，集中导出所有公开类型。
 * 外部使用者（包括 Node.js API 调用方和插件开发者）
 * 只需从 'flashmini' 导入即可获取所有需要的类型。
 *
 * @example
 * ```typescript
 * import type { FlashminiConfig, Plugin, UploadResult } from 'flashmini'
 * ```
 */

// ─── 配置文件类型 ─────────────────────────────────────────────────
export type {
  FlashminiConfig,
  WechatConfig,
  AlipayConfig,
  BaiduConfig,
  BytedanceConfig,
  NotifyFeishuConfig,
  NotifyDingtalkConfig,
  NotifyWebhookConfig,
  OptionsConfig,
  PluginConfigItem,
} from './config'

// ─── 平台相关类型 ─────────────────────────────────────────────────
export type { UploadResult, PlatformNameType } from './platform'
export { PlatformName, PLATFORM_DISPLAY_NAMES } from './platform'

// ─── 插件接口类型 ─────────────────────────────────────────────────
export type { Plugin, PluginConfig } from './plugin'

// ─── 上下文类型（从核心模块重导出） ──────────────────────────────
export { Context } from '../core/context'

// ─── defineConfig 辅助函数 ────────────────────────────────────────

/**
 * defineConfig 辅助函数
 *
 * 用于配置文件中提供 TypeScript 类型推断支持。
 * 本身不做任何处理，只是原样返回配置对象，
 * 但通过泛型约束让 IDE 能够提供完整的类型提示和自动补全。
 *
 * @param config - 用户的配置对象
 * @returns 原样返回的配置对象（附带类型信息）
 *
 * @example
 * ```typescript
 * // flashmini.config.ts
 * import { defineConfig } from 'flashmini'
 *
 * export default defineConfig({
 *   version: '1.0.0',
 *   platforms: {
 *     wechat: { enabled: true, appId: 'wx...', ... }
 *   }
 * })
 * ```
 */
import type { FlashminiConfig } from './config'

export function defineConfig(config: FlashminiConfig): FlashminiConfig {
  return config
}
