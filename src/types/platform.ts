/**
 * 平台相关类型定义
 *
 * 定义了上传结果、平台名称枚举等与平台策略层相关的类型。
 * 这些类型在整个项目中被广泛使用，包括：
 * - Context 上下文对象中存储上传结果
 * - Runner 主流程编排中传递上传状态
 * - 通知系统中读取上传结果生成消息
 * - 插件钩子中作为参数传递
 */

/**
 * 单个平台的上传结果
 *
 * 每次上传操作完成后（无论成功或失败），都会生成一个 UploadResult 对象，
 * 存储到 Context.results 数组中，供后续的通知系统和结果汇总使用。
 */
export interface UploadResult {
  /** 平台标识名称（如 'wechat'、'alipay'） */
  platform: string
  /** 上传是否成功 */
  success: boolean
  /** 是否为模拟上传结果 */
  mock?: boolean
  /** 上传的版本号 */
  version: string
  /** 体验版二维码 URL 或 base64 编码（上传成功时可能返回） */
  qrcodeUrl?: string
  /** 模拟上传时的触发原因 */
  mockReason?: string
  /** 上传失败时的错误对象 */
  error?: Error
  /** 上传耗时（毫秒） */
  duration: number
}

/**
 * 支持的平台名称枚举
 *
 * 使用 const enum 在编译时内联，减少运行时开销。
 * 新增平台时需要在此处添加对应的枚举值。
 */
export const enum PlatformName {
  /** 微信小程序 */
  Wechat = 'wechat',
  /** 支付宝小程序 */
  Alipay = 'alipay',
  /** 百度智能小程序 */
  Baidu = 'baidu',
  /** 字节跳动小程序 */
  Bytedance = 'bytedance',
}

/**
 * 平台名称字符串字面量联合类型
 *
 * 用于函数参数类型约束，确保传入的平台名称是合法的。
 */
export type PlatformNameType = 'wechat' | 'alipay' | 'baidu' | 'bytedance'

/**
 * 平台显示名称映射
 *
 * 将平台标识名称映射为用户友好的中文显示名称，
 * 用于 CLI 输出、通知消息等面向用户的场景。
 */
export const PLATFORM_DISPLAY_NAMES: Record<PlatformNameType, string> = {
  wechat: '微信小程序',
  alipay: '支付宝小程序',
  baidu: '百度智能小程序',
  bytedance: '字节跳动小程序',
}
