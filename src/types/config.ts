/**
 * 配置文件类型定义
 *
 * 所有类型均从 Zod Schema 自动推导（z.infer），
 * 确保运行时校验与静态类型始终保持一致，无需手动维护两套定义。
 *
 * 本文件仅做类型的重新导出，实际的 Schema 定义在 core/config/schema.ts 中。
 */

import type { z } from 'zod'
import type {
  ConfigSchema,
  WechatSchema,
  AlipaySchema,
  BaiduSchema,
  BytedanceSchema,
  NotifyFeishuSchema,
  NotifyDingtalkSchema,
  NotifyWebhookSchema,
  OptionsSchema,
  PluginConfigSchema,
} from '../core/config/schema'

// ─── 平台配置类型 ─────────────────────────────────────────────────

/** 微信小程序平台配置 */
export type WechatConfig = z.infer<typeof WechatSchema>

/** 支付宝小程序平台配置 */
export type AlipayConfig = z.infer<typeof AlipaySchema>

/** 百度智能小程序平台配置 */
export type BaiduConfig = z.infer<typeof BaiduSchema>

/** 字节跳动小程序平台配置 */
export type BytedanceConfig = z.infer<typeof BytedanceSchema>

// ─── 通知配置类型 ─────────────────────────────────────────────────

/** 飞书通知配置 */
export type NotifyFeishuConfig = z.infer<typeof NotifyFeishuSchema>

/** 钉钉通知配置 */
export type NotifyDingtalkConfig = z.infer<typeof NotifyDingtalkSchema>

/** 通用 Webhook 通知配置 */
export type NotifyWebhookConfig = z.infer<typeof NotifyWebhookSchema>

// ─── 行为配置类型 ─────────────────────────────────────────────────

/** 上传行为选项配置 */
export type OptionsConfig = z.infer<typeof OptionsSchema>

/** 插件配置项 */
export type PluginConfigItem = z.infer<typeof PluginConfigSchema>

// ─── 完整配置类型 ─────────────────────────────────────────────────

/** Flashmini 完整配置文件类型（从 Zod Schema 自动推导） */
export type FlashminiConfig = z.infer<typeof ConfigSchema>
