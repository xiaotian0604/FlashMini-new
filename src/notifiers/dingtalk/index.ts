/**
 * 钉钉机器人通知器
 *
 * 通过钉钉自定义机器人的 Webhook 发送 ActionCard 消息。
 * 支持加签（sign）安全验证和 @指定手机号。
 *
 * 钉钉自定义机器人安全设置支持三种方式：
 * 1. 自定义关键词
 * 2. 加签（本模块支持）
 * 3. IP 地址（段）
 *
 * @see https://open.dingtalk.com/document/orgapp/custom-robots-send-group-messages
 */

import { createHmac } from 'crypto'
import { BaseNotifier } from '../base'
import { buildDingtalkMessage } from './template'
import type { Context } from '../../core/context'
import { FlashminiError, ErrorCode } from '../../utils/errors'

/**
 * 钉钉通知器
 *
 * 继承 BaseNotifier，实现钉钉平台的通知发送逻辑。
 */
export class DingtalkNotifier extends BaseNotifier {
  /** 通知渠道显示名称 */
  get channelName(): string {
    return '钉钉'
  }

  /**
   * 发送钉钉通知
   *
   * 流程：
   * 1. 构建钉钉 ActionCard 消息
   * 2. 通过 beforeNotify 钩子允许插件修改消息
   * 3. 如果配置了加签密钥，计算签名并附加到 URL
   * 4. 发送 POST 请求到钉钉 Webhook
   *
   * @param ctx - 上传上下文
   * @throws FlashminiError 当请求失败时
   */
  async send(ctx: Context): Promise<void> {
    // 构建钉钉消息
    const message = buildDingtalkMessage(
      ctx,
      this.notifyConfig.atMobiles || [],
    )

    // 执行 beforeNotify 瀑布流钩子
    const finalMessage = await this.hookManager.waterfall(
      'beforeNotify',
      { type: 'dingtalk', content: message },
      ctx,
    )

    // 构建请求 URL（可能需要加签）
    const url = this.buildWebhookUrl()

    // 发送 HTTP 请求
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalMessage.content),
    })

    if (!response.ok) {
      throw new FlashminiError(
        `钉钉通知发送失败: HTTP ${response.status} ${response.statusText}`,
        ErrorCode.NETWORK_ERROR,
      )
    }
  }

  /**
   * 构建带签名的 Webhook URL
   *
   * 如果配置了加签密钥（secret），按照钉钉的签名算法生成签名，
   * 并将 timestamp 和 sign 参数附加到 Webhook URL 上。
   *
   * 签名算法：
   * 1. 将 timestamp + "\n" + secret 作为签名字符串
   * 2. 使用 HmacSHA256 算法计算签名
   * 3. 将签名结果进行 Base64 编码
   * 4. 对 Base64 结果进行 URL 编码
   *
   * @returns 完整的 Webhook URL（可能包含签名参数）
   */
  private buildWebhookUrl(): string {
    const { webhook, secret } = this.notifyConfig

    // 未配置加签密钥，直接返回原始 URL
    if (!secret) {
      return webhook
    }

    // 计算签名
    const timestamp = Date.now()
    const stringToSign = `${timestamp}\n${secret}`
    const hmac = createHmac('sha256', secret)
    hmac.update(stringToSign)
    const sign = encodeURIComponent(hmac.digest('base64'))

    // 将签名参数附加到 URL
    const separator = webhook.includes('?') ? '&' : '?'
    return `${webhook}${separator}timestamp=${timestamp}&sign=${sign}`
  }
}
