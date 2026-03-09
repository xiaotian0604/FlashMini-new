/**
 * 钉钉消息模板构建器
 *
 * 构建钉钉机器人的 ActionCard 消息。
 * ActionCard 是钉钉机器人支持的一种富文本消息类型，
 * 支持 Markdown 格式的内容和操作按钮。
 *
 * @see https://open.dingtalk.com/document/orgapp/custom-robots-send-group-messages
 */

import type { Context } from '../../core/context'

/**
 * 构建钉钉 ActionCard 消息
 *
 * 生成钉钉机器人可识别的 ActionCard 消息 JSON。
 * 消息内容使用 Markdown 格式，包含上传结果汇总。
 *
 * @param ctx - 上传上下文
 * @param atMobiles - 需要 @的手机号列表
 * @returns 钉钉消息 JSON 对象
 */
export function buildDingtalkMessage(
  ctx: Context,
  atMobiles: string[] = [],
): Record<string, unknown> {
  // 分类上传结果
  const successPlatforms = ctx.results.filter(r => r.success).map(r => r.platform)
  const failedPlatforms = ctx.failedPlatforms

  // 构建 Markdown 内容
  const lines: string[] = [
    `# 🚀 小程序上传完成 v${ctx.version}`,
    '',
    `**分支**: ${ctx.gitBranch || '未知'}`,
    `**提交**: ${ctx.gitCommit ? ctx.gitCommit.slice(0, 7) : '未知'}`,
    '',
  ]

  // 平台状态
  if (successPlatforms.length > 0) {
    lines.push(`**成功**: ${successPlatforms.map(p => `✅ ${p}`).join(' ')}`)
  }
  if (failedPlatforms.length > 0) {
    lines.push(`**失败**: ${failedPlatforms.map(p => `❌ ${p}`).join(' ')}`)
  }

  // 变更日志
  if (ctx.changelog.length > 0) {
    lines.push('', '**变更日志**:')
    ctx.changelog.forEach(log => {
      lines.push(`- ${log}`)
    })
  }

  // 耗时
  lines.push('', `⏱ 总耗时：${(ctx.duration / 1000).toFixed(1)}s`)

  return {
    msgtype: 'actionCard',
    actionCard: {
      title: `小程序上传完成 v${ctx.version}`,
      text: lines.join('\n'),
      btnOrientation: '0',
      singleTitle: '查看详情',
      singleURL: '',
    },
    at: {
      atMobiles,
      isAtAll: false,
    },
  }
}
