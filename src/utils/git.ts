/**
 * Git 工具函数
 *
 * 封装了常用的 git 命令调用，用于获取项目的 git 信息。
 * 这些信息在以下场景中使用：
 *
 * 1. 自动生成上传描述（读取最近的 commit message）
 * 2. 通知消息中展示分支名和 commit hash
 * 3. 变更日志（changelog）生成
 *
 * 所有函数都做了错误容错处理：
 * 如果当前目录不是 git 仓库或 git 命令执行失败，
 * 会返回空字符串或空数组，不会中断上传流程。
 */

import { execSync } from 'child_process'

/**
 * 安全执行 git 命令
 *
 * 封装 execSync，统一处理编码和错误。
 * 当命令执行失败时（如不在 git 仓库中），返回空字符串而非抛出异常。
 *
 * @param command - 要执行的 git 命令
 * @returns 命令输出（已去除首尾空白），失败时返回空字符串
 */
function execGit(command: string): string {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      // 静默 stderr 输出，避免在非 git 仓库时打印错误信息
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return ''
  }
}

/**
 * 获取当前 git 分支名称
 *
 * 使用 `git rev-parse --abbrev-ref HEAD` 获取当前分支名。
 * 在 detached HEAD 状态下会返回 'HEAD'。
 *
 * @returns 分支名称，如 'main'、'feature/upload'，失败时返回空字符串
 *
 * @example
 * ```typescript
 * const branch = await getGitBranch()
 * console.log(branch) // 'main'
 * ```
 */
export async function getGitBranch(): Promise<string> {
  return execGit('git rev-parse --abbrev-ref HEAD')
}

/**
 * 获取当前 git commit 的完整哈希值
 *
 * 使用 `git rev-parse HEAD` 获取 40 位完整 commit hash。
 * 在通知消息中通常只展示前 7 位（short hash）。
 *
 * @returns 40 位 commit hash，失败时返回空字符串
 *
 * @example
 * ```typescript
 * const commit = await getGitCommit()
 * console.log(commit.slice(0, 7)) // 'a1b2c3d'
 * ```
 */
export async function getGitCommit(): Promise<string> {
  return execGit('git rev-parse HEAD')
}

/**
 * 获取最近的 git commit 日志
 *
 * 使用 `git log --oneline` 获取最近 N 条 commit 的简要信息。
 * 每条日志格式为 "短hash 提交信息"，如 "a1b2c3d feat: 新增上传功能"。
 *
 * 用途：
 * - 生成通知消息中的变更日志（changelog）
 * - 当 description 设置为 'git' 时，取第一条作为上传描述
 *
 * @param count - 获取的日志条数（默认 5 条）
 * @returns commit 日志数组，每个元素为一条日志，失败时返回空数组
 *
 * @example
 * ```typescript
 * const logs = await getGitLog(3)
 * // ['a1b2c3d feat: 新增上传功能', 'b2c3d4e fix: 修复配置解析', ...]
 * ```
 */
export async function getGitLog(count: number = 5): Promise<string[]> {
  const output = execGit(`git log --oneline -${count}`)
  if (!output) return []
  return output.split('\n').filter(Boolean)
}

/**
 * 获取最近一条 commit message（不含 hash 前缀）
 *
 * 使用 `git log -1 --format=%s` 仅获取最近一条 commit 的标题行。
 * 当配置文件中 description 设置为 'git' 时，使用此函数获取上传描述。
 *
 * @returns 最近一条 commit message，失败时返回空字符串
 *
 * @example
 * ```typescript
 * const message = await getLastCommitMessage()
 * console.log(message) // 'feat: 新增微信小程序上传功能'
 * ```
 */
export async function getLastCommitMessage(): Promise<string> {
  return execGit('git log -1 --format=%s')
}
