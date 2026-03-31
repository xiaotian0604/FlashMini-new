/**
 * 通用 Webhook 通知器
 *
 * 支持向任意 HTTP 端点发送通知，使用模板变量替换生成请求体。
 * 适用于自建通知系统、企业微信、Slack 等任意支持 Webhook 的平台。
 *
 * 可用的模板变量：
 * - {{version}}    — 上传版本号
 * - {{platforms}}  — 上传平台列表（逗号分隔）
 * - {{timestamp}}  — 当前时间戳（ISO 格式）
 * - {{changelog}}  — 变更日志（换行分隔）
 * - {{branch}}     — git 分支名
 * - {{commit}}     — git commit hash（短）
 * - {{duration}}   — 总耗时（秒）
 * - {{status}}     — 上传状态（success / partial / failed）
 * - {{mode}}       — 上传模式（real / mock / mixed）
 *
 * @example
 * ```typescript
 * // 配置示例
 * webhook: {
 *   enabled: true,
 *   url: 'https://my-server.com/notify',
 *   method: 'POST',
 *   headers: { 'Authorization': 'Bearer xxx' },
 *   body: '{"text": "{{platforms}} 上传完成，版本 {{version}}"}',
 * }
 * ```
 */

import { BaseNotifier } from '../base'
import type { Context } from '../../core/context'
import { FlashminiError, ErrorCode } from '../../utils/errors'

/**
 * 通用 Webhook 通知器
 *
 * 继承 BaseNotifier，实现通用 Webhook 的通知发送逻辑。
 * 通过模板变量替换机制，支持任意格式的请求体。
 */
export class WebhookNotifier extends BaseNotifier {
  /** 通知渠道显示名称 */
  get channelName(): string {
    return 'Webhook'
  }

  /**
   * 发送 Webhook 通知
   *
   * 流程：
   * 1. 将配置中的 body 模板进行变量替换
   * 2. 通过 beforeNotify 钩子允许插件修改消息
   * 3. 发送 HTTP 请求到指定 URL
   *
   * @param ctx - 上传上下文
   * @throws FlashminiError 当请求失败时
   */
  async send(ctx: Context): Promise<void> {
    const { url, method, headers, body } = this.notifyConfig

    // 对 body 模板进行变量替换
    const resolvedBody = this.resolveTemplate(body || '', ctx)

    // 执行 beforeNotify 瀑布流钩子
    const finalMessage = await this.hookManager.waterfall(
      'beforeNotify',
      { type: 'webhook', content: { body: resolvedBody } },
      ctx,
    )

    // 发送 HTTP 请求
    const response = await fetch(url, {
      method: method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(headers || {}),
      },
      body: (finalMessage.content as any).body,
    })

    if (!response.ok) {
      throw new FlashminiError(
        `Webhook 通知发送失败: HTTP ${response.status} ${response.statusText}`,
        ErrorCode.NETWORK_ERROR,
      )
    }
  }

  /**
   * 模板变量替换
   *
   * 将模板字符串中的 {{variable}} 占位符替换为实际值。
   * 支持的变量列表见模块顶部的文档注释。
   *
   * @param template - 包含 {{variable}} 占位符的模板字符串
   * @param ctx - 上传上下文，提供替换变量的实际值
   * @returns 替换后的字符串
   */
  private resolveTemplate(template: string, ctx: Context): string {
    // 确定上传状态
    const status = ctx.isAllSuccess
      ? 'success'
      : ctx.successCount > 0
        ? 'partial'
        : 'failed'
    const mode = ctx.results.every(result => result.mock)
      ? 'mock'
      : ctx.results.some(result => result.mock)
        ? 'mixed'
        : 'real'

    // 构建变量映射表
    const variables: Record<string, string> = {
      version: ctx.version,
      platforms: ctx.results.map(r => r.platform).join(', '),
      timestamp: new Date().toISOString(),
      changelog: ctx.changelog.join('\n'),
      branch: ctx.gitBranch,
      commit: ctx.gitCommit ? ctx.gitCommit.slice(0, 7) : '',
      duration: (ctx.duration / 1000).toFixed(1),
      status,
      mode,
    }

    // 执行替换：将 {{key}} 替换为对应的值
    return template.replace(
      /\{\{(\w+)\}\}/g,
      (match, key) => variables[key] ?? match,
    )
  }
}
