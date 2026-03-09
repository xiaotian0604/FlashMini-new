/**
 * Loading 状态展示工具
 *
 * 封装 ora 库，提供统一的 loading 动画管理。
 * 在上传过程中展示旋转动画和状态文字，提升用户体验。
 *
 * ora 是一个优雅的终端 spinner 库，支持：
 * - 多种旋转动画样式
 * - 动态更新文字
 * - 成功/失败/警告状态切换
 *
 * @see https://www.npmjs.com/package/ora
 *
 * @example
 * ```typescript
 * const spinner = createSpinner('正在上传微信小程序...')
 * spinner.start()
 *
 * // 上传完成后
 * spinner.succeed('微信小程序上传成功 (8.3s)')
 *
 * // 或者上传失败
 * spinner.fail('微信小程序上传失败')
 * ```
 */

import ora from 'ora'
import type { Ora } from 'ora'

/**
 * 创建 spinner 实例
 *
 * 创建一个新的 ora spinner，使用统一的样式配置。
 * 返回的 spinner 实例可以调用 start()、succeed()、fail() 等方法。
 *
 * @param text - spinner 初始显示的文字
 * @returns ora spinner 实例
 *
 * @example
 * ```typescript
 * const spinner = createSpinner('准备上传...')
 * spinner.start()
 * // ... 执行操作 ...
 * spinner.succeed('上传完成')
 * ```
 */
export function createSpinner(text: string): Ora {
  return ora({
    text,
    // 使用 dots 动画样式（最常见的旋转点动画）
    spinner: 'dots',
    // 颜色设为青色，与 chalk 的信息色调一致
    color: 'cyan',
  })
}

/**
 * 创建并立即启动 spinner
 *
 * 便捷方法，创建 spinner 后立即开始动画。
 * 适用于不需要在创建和启动之间执行其他操作的场景。
 *
 * @param text - spinner 显示的文字
 * @returns 已启动的 ora spinner 实例
 */
export function startSpinner(text: string): Ora {
  return createSpinner(text).start()
}
