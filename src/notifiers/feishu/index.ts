/**
 * 飞书机器人通知器
 *
 * 通过飞书自定义机器人的 Webhook 发送富文本卡片消息。
 * 消息内容包含上传结果、版本号、分支信息、变更日志等。
 *
 * 飞书自定义机器人配置步骤：
 * 1. 在飞书群聊中添加自定义机器人
 * 2. 获取 Webhook URL
 * 3. 将 URL 填入 flashmini 配置文件的 notify.feishu.webhook 字段
 *
 * @see https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot
 */

import { BaseNotifier } from '../base'
import { buildFeishuCard } from './template'
import type { Context } from '../../core/context'
import { FlashminiError, ErrorCode } from '../../utils/errors'

/**
 * 飞书通知器
 *
 * 继承 BaseNotifier，实现飞书平台的通知发送逻辑。
 * 使用 Node.js 18+ 原生 fetch API 发送 HTTP 请求。
 */
export class FeishuNotifier extends BaseNotifier {
  /** 通知渠道显示名称 */
  get channelName(): string {
    return '飞书'
  }

  /**
   * 发送飞书通知
   *
   * 流程：
   * 1. 调用模板构建器生成飞书卡片消息
   * 2. 通过 beforeNotify 瀑布流钩子允许插件修改消息内容
   * 3. 使用 fetch 发送 POST 请求到飞书 Webhook
   * 4. 检查响应状态，失败时抛出错误
   *
   * @param ctx - 上传上下文
   * @throws FlashminiError 当 HTTP 请求失败时
   */
  async send(ctx: Context): Promise<void> {
    // 构建飞书卡片消息
    const message = buildFeishuCard(
      ctx,
      this.notifyConfig.template,
      this.notifyConfig.atUsers || [],
    )

    // 执行 beforeNotify 瀑布流钩子，允许插件修改消息内容
    const finalMessage = await this.hookManager.waterfall(
      'beforeNotify',
      { type: 'feishu', content: message },
      ctx,
    )

    // 发送 HTTP 请求
    const response = await fetch(this.notifyConfig.webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalMessage.content),
    })

    // 检查响应状态
    if (!response.ok) {
      throw new FlashminiError(
        `飞书通知发送失败: HTTP ${response.status} ${response.statusText}`,
        ErrorCode.NETWORK_ERROR,
      )
    }
  }
}
