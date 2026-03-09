/**
 * 飞书消息模板构建器
 *
 * 构建飞书机器人的富文本卡片（Interactive Card）消息。
 * 飞书卡片消息支持丰富的排版和交互元素，包括：
 * - 标题栏（带颜色主题）
 * - 多列布局（fields）
 * - Markdown 文本
 * - @指定人员
 *
 * @see https://open.feishu.cn/document/common-capabilities/message-card/message-cards-content
 */

import type { Context } from '../../core/context'

/**
 * 飞书通知模板配置
 */
interface FeishuTemplateConfig {
  /** 是否展示体验版二维码 */
  showQrcode?: boolean
  /** 是否展示变更日志 */
  showChangelog?: boolean
  /** 是否展示上传平台列表 */
  showPlatforms?: boolean
}

/**
 * 构建飞书富文本卡片消息
 *
 * 根据上传上下文中的数据，生成飞书机器人可识别的卡片消息 JSON。
 * 卡片包含以下信息模块（可通过模板配置控制显示/隐藏）：
 *
 * 1. 标题栏：显示版本号，全部成功为绿色，有失败为橙色
 * 2. 基本信息：git 分支和 commit hash
 * 3. 平台状态：每个平台的上传结果（成功/失败）
 * 4. 变更日志：最近的 git commit 记录
 * 5. @相关人：通知指定的飞书用户
 *
 * @param ctx - 上传上下文
 * @param templateConfig - 模板配置（控制展示哪些信息）
 * @param atUsers - 需要 @的飞书用户 open_id 列表
 * @returns 飞书卡片消息 JSON 对象
 */
export function buildFeishuCard(
  ctx: Context,
  templateConfig: FeishuTemplateConfig = {},
  atUsers: string[] = [],
): Record<string, unknown> {
  // 解构模板配置，设置默认值
  const {
    showQrcode = true,
    showChangelog = true,
    showPlatforms = true,
  } = templateConfig

  // 分类上传结果
  const successPlatforms = ctx.results.filter(r => r.success).map(r => r.platform)
  const failedPlatforms = ctx.failedPlatforms

  // 根据是否有失败平台决定卡片主题色
  const headerTemplate = failedPlatforms.length > 0 ? 'orange' : 'green'

  // 构建卡片元素列表
  const elements: Record<string, unknown>[] = []

  // ─── 基本信息区域（分支 + commit） ─────────────────────────────
  elements.push({
    tag: 'div',
    fields: [
      {
        is_short: true,
        text: { content: `**分支**：${ctx.gitBranch || '未知'}`, tag: 'lark_md' },
      },
      {
        is_short: true,
        text: { content: `**提交**：${ctx.gitCommit ? ctx.gitCommit.slice(0, 7) : '未知'}`, tag: 'lark_md' },
      },
    ],
  })

  // ─── 平台状态区域 ──────────────────────────────────────────────
  if (showPlatforms) {
    const statusLines = [
      ...successPlatforms.map(p => `✅ ${p}`),
      ...failedPlatforms.map(p => `❌ ${p}`),
    ]

    if (statusLines.length > 0) {
      elements.push({
        tag: 'div',
        text: {
          content: statusLines.join('  '),
          tag: 'lark_md',
        },
      })
    }
  }

  // ─── 变更日志区域 ──────────────────────────────────────────────
  if (showChangelog && ctx.changelog.length > 0) {
    elements.push({
      tag: 'div',
      text: {
        content: `**变更日志**\n${ctx.changelog.map(l => `• ${l}`).join('\n')}`,
        tag: 'lark_md',
      },
    })
  }

  // ─── 耗时信息 ──────────────────────────────────────────────────
  elements.push({
    tag: 'div',
    text: {
      content: `⏱ 总耗时：${(ctx.duration / 1000).toFixed(1)}s`,
      tag: 'lark_md',
    },
  })

  // ─── @相关人员 ─────────────────────────────────────────────────
  if (atUsers.length > 0) {
    elements.push({
      tag: 'div',
      text: {
        content: atUsers.map(id => `<at id=${id}></at>`).join(' '),
        tag: 'lark_md',
      },
    })
  }

  // 组装完整的飞书卡片消息
  return {
    msg_type: 'interactive',
    card: {
      header: {
        title: {
          content: `🚀 小程序上传完成 v${ctx.version}`,
          tag: 'plain_text',
        },
        template: headerTemplate,
      },
      elements,
    },
  }
}
