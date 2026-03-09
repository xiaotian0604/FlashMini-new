/**
 * Zod Schema 配置校验定义
 *
 * 使用 Zod 库定义配置文件的完整 Schema，实现运行时类型校验。
 * 所有 TypeScript 类型均从这些 Schema 自动推导（z.infer），
 * 确保"运行时校验规则"与"静态类型"始终保持一致。
 *
 * Zod 的优势：
 * 1. 错误信息精确到字段级别，用户能快速定位配置问题
 * 2. 支持默认值、链式校验、自定义错误消息
 * 3. 类型自动推导，无需手动维护两套类型定义
 *
 * @see https://zod.dev/ Zod 官方文档
 */

import { z } from 'zod'

// ─── 平台配置 Schema ──────────────────────────────────────────────

/**
 * 微信小程序平台配置 Schema
 *
 * 微信小程序上传依赖 miniprogram-ci SDK，需要以下关键配置：
 * - appId: 小程序的唯一标识，必须以 'wx' 开头
 * - privateKeyPath: 上传密钥文件路径，在微信公众平台下载
 * - projectPath: 构建产物目录（如 dist/wechat）
 * - robot: CI 机器人编号（1-30），不同编号对应不同的上传记录
 */
export const WechatSchema = z.object({
  /** 是否启用微信平台上传 */
  enabled: z.boolean().default(false),
  /** 微信小程序 AppID，必须以 'wx' 开头 */
  appId: z.string().startsWith('wx', { message: '微信 AppID 必须以 wx 开头' }),
  /** 上传密钥文件路径（从微信公众平台下载） */
  privateKeyPath: z.string(),
  /** 构建产物目录路径 */
  projectPath: z.string(),
  /** CI 机器人编号（1-30），不同编号在上传记录中区分来源 */
  robot: z.number().int().min(1).max(30).default(1),
})

/**
 * 支付宝小程序平台配置 Schema
 *
 * 支付宝上传依赖 minidev-tool SDK，支持两种鉴权方式：
 * 1. privateKey: 直接提供私钥字符串
 * 2. privateKeyPath: 提供私钥文件路径
 */
export const AlipaySchema = z.object({
  /** 是否启用支付宝平台上传 */
  enabled: z.boolean().default(false),
  /** 支付宝小程序 AppID */
  appId: z.string(),
  /** 支付宝开放平台工具 ID */
  toolId: z.string().default(''),
  /** 私钥字符串（与 privateKeyPath 二选一） */
  privateKey: z.string().default(''),
  /** 私钥文件路径（与 privateKey 二选一） */
  privateKeyPath: z.string().optional(),
  /** 构建产物目录路径 */
  projectPath: z.string(),
})

/**
 * 百度智能小程序平台配置 Schema
 *
 * 百度上传依赖 swan-toolkit SDK，使用 token 进行鉴权。
 */
export const BaiduSchema = z.object({
  /** 是否启用百度平台上传 */
  enabled: z.boolean().default(false),
  /** 百度智能小程序上传 token */
  token: z.string(),
  /** 构建产物目录路径 */
  projectPath: z.string(),
})

/**
 * 字节跳动小程序平台配置 Schema
 *
 * 字节上传依赖 @microprogram/upload SDK，支持邮箱密码或 token 鉴权。
 */
export const BytedanceSchema = z.object({
  /** 是否启用字节跳动平台上传 */
  enabled: z.boolean().default(false),
  /** 字节跳动开发者邮箱 */
  email: z.string().default(''),
  /** 字节跳动开发者密码（与 token 二选一） */
  password: z.string().default(''),
  /** 鉴权 token（与 email+password 二选一） */
  token: z.string().optional(),
  /** 构建产物目录路径 */
  projectPath: z.string(),
})

// ─── 通知配置 Schema ──────────────────────────────────────────────

/**
 * 飞书通知模板配置 Schema
 *
 * 控制飞书通知消息中展示哪些信息模块。
 */
const FeishuTemplateSchema = z.object({
  /** 是否在通知中展示体验版二维码 */
  showQrcode: z.boolean().default(true),
  /** 是否在通知中展示变更日志 */
  showChangelog: z.boolean().default(true),
  /** 是否在通知中展示上传平台列表 */
  showPlatforms: z.boolean().default(true),
}).default({})

/**
 * 飞书机器人通知配置 Schema
 *
 * 飞书通知通过 Webhook 发送富文本卡片消息，
 * 支持 @指定人员（通过飞书 open_id）。
 */
export const NotifyFeishuSchema = z.object({
  /** 是否启用飞书通知 */
  enabled: z.boolean().default(false),
  /** 飞书机器人 Webhook URL */
  webhook: z.string().url({ message: '飞书 Webhook 必须是合法 URL' }).default(''),
  /** 通知中 @的人员列表（飞书 open_id） */
  atUsers: z.array(z.string()).default([]),
  /** 消息模板配置 */
  template: FeishuTemplateSchema,
}).default({})

/**
 * 钉钉机器人通知配置 Schema
 *
 * 钉钉通知通过 Webhook 发送 ActionCard 消息，
 * 支持加签验证和 @指定手机号。
 */
export const NotifyDingtalkSchema = z.object({
  /** 是否启用钉钉通知 */
  enabled: z.boolean().default(false),
  /** 钉钉机器人 Webhook URL */
  webhook: z.string().url({ message: '钉钉 Webhook 必须是合法 URL' }).default(''),
  /** 加签密钥（可选，用于安全验证） */
  secret: z.string().default(''),
  /** 通知中 @的手机号列表 */
  atMobiles: z.array(z.string()).default([]),
}).default({})

/**
 * 通用 Webhook 通知配置 Schema
 *
 * 支持自定义 JSON 模板，通过模板变量替换生成最终的请求体。
 * 可用模板变量：{{version}} {{platforms}} {{timestamp}} {{changelog}}
 */
export const NotifyWebhookSchema = z.object({
  /** 是否启用通用 Webhook 通知 */
  enabled: z.boolean().default(false),
  /** Webhook URL */
  url: z.string().default(''),
  /** HTTP 请求方法 */
  method: z.enum(['GET', 'POST', 'PUT']).default('POST'),
  /** 自定义请求头 */
  headers: z.record(z.string()).default({}),
  /** 请求体模板（支持 {{variable}} 模板变量） */
  body: z.string().default('{"text": "{{platforms}} 上传完成，版本 {{version}}"}'),
}).default({})

// ─── 行为配置 Schema ──────────────────────────────────────────────

/**
 * 上传行为选项 Schema
 *
 * 控制上传过程的并行/串行、重试策略、错误处理等行为。
 */
export const OptionsSchema = z.object({
  /** 多平台是否并行上传（false 则按顺序串行上传） */
  parallel: z.boolean().default(true),
  /** 上传失败后的自动重试次数（0 表示不重试） */
  retry: z.number().int().min(0).max(5).default(2),
  /** 重试间隔时间（毫秒），实际间隔会按指数退避递增 */
  retryDelay: z.number().default(3000),
  /** 某个平台上传失败后是否继续上传其他平台 */
  continueOnError: z.boolean().default(false),
}).default({})

// ─── 插件配置 Schema ──────────────────────────────────────────────

/**
 * 单个插件配置项 Schema
 *
 * use 字段指定插件来源，options 字段传递插件自定义参数。
 */
export const PluginConfigSchema = z.object({
  /** 插件路径或 npm 包名 */
  use: z.string(),
  /** 传递给插件的自定义选项 */
  options: z.record(z.unknown()).optional(),
})

// ─── 完整配置 Schema ──────────────────────────────────────────────

/**
 * Flashmini 完整配置文件 Schema
 *
 * 这是配置文件的顶层 Schema，包含所有配置项。
 * 使用 ConfigSchema.safeParse(raw) 进行校验，
 * 校验失败时会返回精确到字段级别的错误信息。
 *
 * @example
 * ```typescript
 * const result = ConfigSchema.safeParse(rawConfig)
 * if (!result.success) {
 *   result.error.errors.forEach(e => {
 *     console.error(`${e.path.join('.')} — ${e.message}`)
 *   })
 * }
 * ```
 */
export const ConfigSchema = z.object({
  /**
   * 上传版本号
   * - 字符串：直接使用指定的版本号
   * - 'auto'：自动读取项目 package.json 中的 version 字段
   */
  version: z.union([z.string(), z.literal('auto')]).default('auto'),

  /**
   * 上传备注/描述
   * - 字符串：直接使用指定的描述
   * - 'git'：自动读取最近一条 git commit message
   */
  description: z.union([z.string(), z.literal('git')]).default('git'),

  /** 各平台配置（每个平台独立配置，可选启用） */
  platforms: z.object({
    wechat: WechatSchema.optional(),
    alipay: AlipaySchema.optional(),
    baidu: BaiduSchema.optional(),
    bytedance: BytedanceSchema.optional(),
  }),

  /** 通知渠道配置 */
  notify: z.object({
    feishu: NotifyFeishuSchema,
    dingtalk: NotifyDingtalkSchema,
    webhook: NotifyWebhookSchema,
  }).default({}),

  /** 上传行为选项 */
  options: OptionsSchema,

  /** 插件列表 */
  plugins: z.array(PluginConfigSchema).default([]),
})

/** Flashmini 完整配置类型（从 Schema 自动推导） */
export type FlashminiConfig = z.infer<typeof ConfigSchema>
