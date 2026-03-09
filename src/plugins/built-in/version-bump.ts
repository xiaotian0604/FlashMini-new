/**
 * 内置插件：版本号自动递增
 *
 * 在所有平台上传成功后，自动递增项目的 package.json 版本号。
 * 支持三种递增类型：patch（补丁）、minor（次版本）、major（主版本）。
 *
 * 使用方式（在配置文件中启用）：
 * ```typescript
 * plugins: [
 *   {
 *     use: 'flashmini/plugins/version-bump',
 *     options: {
 *       type: 'patch',    // 递增类型：'patch' | 'minor' | 'major'
 *       commit: true,     // 是否自动 git commit
 *     }
 *   }
 * ]
 * ```
 *
 * 安全机制：
 * - 只有所有平台都上传成功时才会递增版本号
 * - 如果有任何平台上传失败，跳过版本递增
 *
 * 钩子注册：
 * - afterAll: 在所有上传完成后执行版本递增
 */

import { execSync } from 'child_process'
import type { Plugin } from '../../types/plugin'

/**
 * 版本递增插件选项
 */
interface VersionBumpOptions {
  /** 版本递增类型：patch（0.0.x）、minor（0.x.0）、major（x.0.0） */
  type: 'patch' | 'minor' | 'major'
  /** 递增后是否自动创建 git commit */
  commit: boolean
}

/**
 * 创建版本递增插件的工厂函数
 *
 * 使用工厂函数模式而非直接导出插件对象，
 * 是因为此插件需要接收用户配置的选项（type、commit）。
 *
 * @param options - 插件选项（可选，有默认值）
 * @returns 配置好的插件实例
 *
 * @example
 * ```typescript
 * // 使用默认选项（patch 递增，不自动 commit）
 * const plugin = createVersionBumpPlugin()
 *
 * // 自定义选项
 * const plugin = createVersionBumpPlugin({
 *   type: 'minor',
 *   commit: true,
 * })
 * ```
 */
export function createVersionBumpPlugin(
  options: Partial<VersionBumpOptions> = {},
): Plugin {
  // 合并默认选项
  const opts: VersionBumpOptions = {
    type: 'patch',
    commit: false,
    ...options,
  }

  return {
    /** 插件名称 */
    name: 'flashmini:version-bump',

    /**
     * 注册钩子回调
     *
     * 在 afterAll 钩子中执行版本递增：
     * 1. 检查是否所有平台都上传成功
     * 2. 使用 npm version 命令递增版本号
     * 3. 可选：自动创建 git commit
     */
    apply(hooks) {
      hooks.tap('afterAll', async (ctx) => {
        // 安全检查：有失败的平台则不递增版本号
        if (ctx.failedPlatforms.length > 0) {
          console.log('[flashmini:version-bump] 存在上传失败的平台，跳过版本递增')
          return
        }

        try {
          // 使用 npm version 命令递增版本号
          // --no-git-tag-version: 不自动创建 git tag
          const newVersion = execSync(`npm version ${opts.type} --no-git-tag-version`, {
            stdio: 'pipe',
            encoding: 'utf-8',
          }).trim()

          console.log(`[flashmini:version-bump] 版本号已递增: ${newVersion} (${opts.type})`)

          // 如果配置了自动 commit，执行 git add + commit
          if (opts.commit) {
            execSync('git add package.json', { stdio: 'pipe' })
            execSync(
              `git commit -m "chore: bump version to ${newVersion}"`,
              { stdio: 'pipe' },
            )
            console.log('[flashmini:version-bump] 已自动提交版本变更')
          }
        } catch (err) {
          // 版本递增失败不应中断主流程，仅输出警告
          console.warn(
            `[flashmini:version-bump] 版本递增失败: ${(err as Error).message}`,
          )
        }
      })
    },
  }
}

// 默认导出工厂函数，支持 import() 动态加载
export default createVersionBumpPlugin
