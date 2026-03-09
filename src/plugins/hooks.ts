/**
 * 生命周期钩子定义
 *
 * 定义了 Flashmini 上传流程中所有可用的生命周期钩子。
 * 插件通过 HookManager.tap() 注册这些钩子的回调函数，
 * 在对应的生命周期阶段被 Runner 调用。
 *
 * 钩子执行顺序（完整的上传生命周期）：
 *
 * ┌─────────────┐
 * │  beforeAll   │  ← 所有平台上传开始前（可修改 ctx）
 * └──────┬──────┘
 *        │
 * ┌──────▼──────┐
 * │beforeUpload │  ← 单个平台上传开始前（每个平台调用一次）
 * └──────┬──────┘
 *        │
 * ┌──────▼──────┐
 * │ afterUpload │  ← 单个平台上传完成后（每个平台调用一次）
 * └──────┬──────┘
 *        │
 * ┌──────▼──────┐
 * │  afterAll   │  ← 所有平台上传完成后
 * └──────┬──────┘
 *        │
 * ┌──────▼──────┐
 * │beforeNotify │  ← 通知发送前（瀑布流钩子，可修改通知内容）
 * └─────────────┘
 *
 * 错误钩子：
 * ┌─────────────┐
 * │   onError   │  ← 上传出错时触发（不影响主流程）
 * └─────────────┘
 */

import type { Context } from '../core/context'
import type { UploadResult } from '../types/platform'

/**
 * 可以是同步值也可以是 Promise 的联合类型
 *
 * 钩子回调函数可以是同步的也可以是异步的，
 * HookManager 统一使用 await 处理，兼容两种写法。
 */
export type Promisable<T> = T | Promise<T>

/**
 * 通知消息结构（传递给 beforeNotify 钩子）
 *
 * 插件可以在 beforeNotify 钩子中修改通知消息的内容，
 * 例如添加自定义字段、修改标题等。
 */
export interface NotifyMessage {
  /** 消息类型标识 */
  type: string
  /** 消息内容（具体结构取决于通知渠道） */
  content: Record<string, unknown>
}

/**
 * 所有生命周期钩子的类型定义
 *
 * 每个属性名对应一个钩子名称，属性值是该钩子的回调函数签名。
 * 插件开发者可以参考此接口了解每个钩子的参数和返回值。
 */
export interface Hooks {
  /**
   * 所有平台上传开始前触发
   *
   * 此时 Context 中已填充了版本号、描述、git 信息等数据。
   * 插件可以在此钩子中修改 ctx 的属性（如动态修改版本号）。
   *
   * @param ctx - 上传上下文对象
   */
  beforeAll: (ctx: Context) => Promisable<void>

  /**
   * 单个平台上传开始前触发
   *
   * 每个启用的平台都会触发一次此钩子。
   * 可用于记录日志、执行平台特定的预处理等。
   *
   * @param ctx - 上传上下文对象
   * @param platform - 即将上传的平台名称（如 'wechat'）
   */
  beforeUpload: (ctx: Context, platform: string) => Promisable<void>

  /**
   * 单个平台上传完成后触发
   *
   * 无论上传成功或失败都会触发。
   * 可用于记录上传结果、执行平台特定的后处理等。
   *
   * @param ctx - 上传上下文对象
   * @param result - 该平台的上传结果
   */
  afterUpload: (ctx: Context, result: UploadResult) => Promisable<void>

  /**
   * 所有平台上传完成后触发
   *
   * 此时 ctx.results 中已包含所有平台的上传结果。
   * 可用于生成汇总报告、执行清理操作等。
   *
   * @param ctx - 上传上下文对象
   */
  afterAll: (ctx: Context) => Promisable<void>

  /**
   * 上传过程中出错时触发
   *
   * 当某个平台上传失败时触发此钩子。
   * 注意：此钩子的执行不会影响主流程的错误处理逻辑。
   *
   * @param ctx - 上传上下文对象
   * @param error - 错误对象
   * @param platform - 出错的平台名称
   */
  onError: (ctx: Context, error: Error, platform: string) => Promisable<void>

  /**
   * 通知发送前触发（瀑布流钩子）
   *
   * 与其他钩子不同，这是一个瀑布流（waterfall）钩子：
   * 每个回调函数接收上一个回调的返回值作为输入，
   * 最终的返回值作为实际发送的通知消息。
   *
   * 插件可以在此钩子中修改通知消息的内容。
   *
   * 注意：因为 waterfall 钩子的第一个参数是被传递的值（message），
   * 所以参数顺序是 (message, ctx)，与其他钩子不同。
   *
   * @param message - 当前的通知消息对象（瀑布流传递值）
   * @param ctx - 上传上下文对象
   * @returns 修改后的通知消息对象
   */
  beforeNotify: (message: NotifyMessage, ctx: Context) => Promisable<NotifyMessage>
}

/**
 * 所有可用的钩子名称列表
 *
 * 用于运行时校验钩子名称是否合法，
 * 防止插件注册了不存在的钩子名称。
 */
export const HOOK_NAMES: (keyof Hooks)[] = [
  'beforeAll',
  'beforeUpload',
  'afterUpload',
  'afterAll',
  'onError',
  'beforeNotify',
]
