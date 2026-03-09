/**
 * 内置插件：Git Log 自动提取
 *
 * 自动读取最近的 git commit 日志，填充到 Context 中。
 * 这些日志信息用于：
 * 1. 生成通知消息中的变更日志（changelog）
 * 2. 当上传描述为空时，自动使用最近一条 commit message 作为描述
 *
 * 使用方式（在配置文件中启用）：
 * ```typescript
 * plugins: [
 *   { use: 'flashmini/plugins/git-log' }
 * ]
 * ```
 *
 * 钩子注册：
 * - beforeAll: 在所有上传开始前读取 git log 并填充到 Context
 */

import type { Plugin } from '../../types/plugin'
import { getGitLog } from '../../utils/git'

/**
 * Git Log 插件实例
 *
 * 在 beforeAll 钩子中执行以下操作：
 * 1. 读取最近 5 条 git commit 日志
 * 2. 将日志列表写入 ctx.changelog
 * 3. 如果 ctx.description 为空，用最近一条 commit message 填充
 */
export const GitLogPlugin: Plugin = {
  /** 插件名称，使用 'flashmini:' 前缀标识为内置插件 */
  name: 'flashmini:git-log',

  /**
   * 注册钩子回调
   *
   * @param hooks - HookManager 实例，用于注册生命周期钩子
   */
  apply(hooks) {
    hooks.tap('beforeAll', async (ctx) => {
      // 读取最近 5 条 commit 日志
      const logs = await getGitLog(5)
      ctx.changelog = logs

      // 如果描述为空，使用最近一条 commit message 作为默认描述
      if (!ctx.description) {
        ctx.description = logs[0] || 'no description'
      }
    })
  },
}

// 默认导出插件实例，支持 import() 动态加载
export default GitLogPlugin
