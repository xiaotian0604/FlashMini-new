/**
 * 通知器工厂
 *
 * 根据配置文件中的通知渠道配置，创建并发送通知。
 * 遍历所有已启用的通知渠道，依次发送通知消息。
 *
 * 设计模式：工厂模式（Factory Pattern）
 * - 根据渠道名称创建对应的通知器实例
 * - 调用方无需关心具体的通知器类
 *
 * 支持的通知渠道：
 * 1. 飞书（Feishu）— 富文本卡片消息
 * 2. 钉钉（DingTalk）— ActionCard 消息
 * 3. 通用 Webhook — 自定义 JSON 模板
 */

import type { Context } from '../core/context'
import type { HookManager } from '../plugins/hook-manager'
import { BaseNotifier } from './base'
import { FeishuNotifier } from './feishu'
import { DingtalkNotifier } from './dingtalk'
import { WebhookNotifier } from './webhook'

/**
 * 通知渠道配置类型
 *
 * 所有通知渠道配置都包含 enabled 字段，用于控制是否启用该渠道。
 */
interface NotifyChannelConfig {
  enabled: boolean
  [key: string]: unknown
}

/**
 * 通知配置（对应配置文件中的 notify 字段）
 */
interface NotifyConfig {
  feishu?: NotifyChannelConfig
  dingtalk?: NotifyChannelConfig
  webhook?: NotifyChannelConfig
}

/**
 * 发送所有已启用渠道的通知
 *
 * 遍历配置文件中的通知渠道，为每个已启用的渠道创建通知器并发送。
 * 单个渠道发送失败不会影响其他渠道，错误会被捕获并输出警告。
 *
 * @param notifyConfig - 通知配置对象（配置文件中的 notify 字段）
 * @param ctx - 上传上下文，包含上传结果等信息
 * @param hookManager - 钩子管理器，传递给通知器用于执行 beforeNotify 钩子
 *
 * @example
 * ```typescript
 * await sendNotifications(config.notify, ctx, hookManager)
 * // 所有已启用的通知渠道都会收到通知
 * ```
 */
export async function sendNotifications(
  notifyConfig: NotifyConfig,
  ctx: Context,
  hookManager: HookManager,
): Promise<void> {
  /** 收集所有已启用的通知器实例 */
  const notifiers: BaseNotifier[] = []

  // ─── 飞书通知 ──────────────────────────────────────────────────
  if (notifyConfig.feishu?.enabled) {
    notifiers.push(new FeishuNotifier(notifyConfig.feishu, hookManager))
  }

  // ─── 钉钉通知 ──────────────────────────────────────────────────
  if (notifyConfig.dingtalk?.enabled) {
    notifiers.push(new DingtalkNotifier(notifyConfig.dingtalk, hookManager))
  }

  // ─── 通用 Webhook 通知 ────────────────────────────────────────
  if (notifyConfig.webhook?.enabled) {
    notifiers.push(new WebhookNotifier(notifyConfig.webhook, hookManager))
  }

  // 没有启用任何通知渠道
  if (notifiers.length === 0) {
    return
  }

  // 依次发送每个渠道的通知（单个失败不影响其他渠道）
  for (const notifier of notifiers) {
    try {
      await notifier.send(ctx)
      console.log(`[flashmini] ${notifier.channelName}通知已发送`)
    } catch (err) {
      console.warn(
        `[flashmini] ${notifier.channelName}通知发送失败: ${(err as Error).message}`,
      )
    }
  }
}
