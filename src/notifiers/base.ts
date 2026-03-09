/**
 * 通知器抽象基类
 *
 * 定义了所有通知渠道必须实现的接口契约。
 * 每个通知渠道（飞书、钉钉、Webhook）都需要继承此基类，
 * 并实现 send() 抽象方法。
 *
 * 设计模式：模板方法模式（Template Method Pattern）
 * - 基类定义了通知发送的接口
 * - 子类实现具体的消息构建和发送逻辑
 * - 新增通知渠道只需创建新的子类
 *
 * 配合工厂模式使用：
 * NotifierFactory.create('feishu', config) 根据渠道名称创建对应实例。
 */

import type { Context } from '../core/context'
import type { HookManager } from '../plugins/hook-manager'

/**
 * 通知器抽象基类
 *
 * 所有通知渠道的父类，定义了统一的发送接口。
 * 子类需要实现 send() 方法，处理具体的消息构建和 HTTP 请求。
 *
 * @example
 * ```typescript
 * class FeishuNotifier extends BaseNotifier {
 *   async send(ctx: Context): Promise<void> {
 *     const message = this.buildCard(ctx)
 *     await fetch(this.notifyConfig.webhook, { ... })
 *   }
 * }
 * ```
 */
export abstract class BaseNotifier {
  /** 通知渠道的配置对象（由子类在构造函数中具体化类型） */
  protected notifyConfig: any

  /** 钩子管理器，用于执行 beforeNotify 瀑布流钩子 */
  protected hookManager: HookManager

  /**
   * @param config - 通知渠道的配置对象
   * @param hookManager - 钩子管理器实例
   */
  constructor(config: unknown, hookManager: HookManager) {
    this.notifyConfig = config
    this.hookManager = hookManager
  }

  /**
   * 发送通知
   *
   * 子类必须实现此方法，完成以下工作：
   * 1. 根据 Context 中的数据构建通知消息
   * 2. 通过 hookManager.waterfall('beforeNotify', ...) 允许插件修改消息
   * 3. 发送 HTTP 请求到通知渠道的 Webhook
   *
   * @param ctx - 上传上下文，包含上传结果、版本号等信息
   * @throws 当通知发送失败时抛出错误
   */
  abstract send(ctx: Context): Promise<void>

  /**
   * 获取通知渠道的显示名称
   *
   * 用于日志输出，标识是哪个渠道的通知。
   */
  abstract get channelName(): string
}
