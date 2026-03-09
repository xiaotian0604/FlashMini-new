/**
 * 统一日志输出工具
 *
 * 封装 chalk 库，提供统一的日志输出样式。
 * 不同级别的日志使用不同的颜色和前缀，便于用户在终端中快速识别信息类型。
 *
 * 日志级别及对应样式：
 * - info:    蓝色 ℹ 前缀，用于普通信息
 * - success: 绿色 ✔ 前缀，用于成功信息
 * - warn:    黄色 ⚠ 前缀，用于警告信息
 * - error:   红色 ✖ 前缀，用于错误信息
 * - debug:   灰色 🔍 前缀，用于调试信息（仅在 DEBUG 模式下输出）
 *
 * @example
 * ```typescript
 * import { logger } from './ui/logger'
 *
 * logger.info('正在读取配置文件...')
 * logger.success('配置文件读取成功')
 * logger.warn('未找到飞书 Webhook，跳过通知')
 * logger.error('上传失败: network timeout')
 * ```
 */

import chalk from 'chalk'

/**
 * 日志工具对象
 *
 * 提供多个级别的日志输出方法，每个方法都会添加对应的颜色和前缀。
 * 所有输出都通过 console.log/console.error 输出到终端。
 */
export const logger = {
  /**
   * 输出普通信息
   *
   * 蓝色 ℹ 前缀，用于流程状态、操作提示等一般性信息。
   *
   * @param message - 日志消息
   * @param args - 额外参数（传递给 console.log）
   */
  info(message: string, ...args: unknown[]): void {
    console.log(chalk.blue('ℹ'), message, ...args)
  },

  /**
   * 输出成功信息
   *
   * 绿色 ✔ 前缀，用于操作成功、任务完成等正面反馈。
   *
   * @param message - 日志消息
   * @param args - 额外参数
   */
  success(message: string, ...args: unknown[]): void {
    console.log(chalk.green('✔'), message, ...args)
  },

  /**
   * 输出警告信息
   *
   * 黄色 ⚠ 前缀，用于非致命性问题、降级处理等警告。
   *
   * @param message - 日志消息
   * @param args - 额外参数
   */
  warn(message: string, ...args: unknown[]): void {
    console.log(chalk.yellow('⚠'), message, ...args)
  },

  /**
   * 输出错误信息
   *
   * 红色 ✖ 前缀，用于致命错误、操作失败等负面反馈。
   * 输出到 stderr 而非 stdout，便于 CI 环境中区分。
   *
   * @param message - 日志消息
   * @param args - 额外参数
   */
  error(message: string, ...args: unknown[]): void {
    console.error(chalk.red('✖'), message, ...args)
  },

  /**
   * 输出调试信息
   *
   * 灰色 🔍 前缀，仅在环境变量 DEBUG=flashmini 时输出。
   * 用于开发调试，生产环境中不会显示。
   *
   * @param message - 日志消息
   * @param args - 额外参数
   */
  debug(message: string, ...args: unknown[]): void {
    if (process.env.DEBUG?.includes('flashmini')) {
      console.log(chalk.gray('🔍'), chalk.gray(message), ...args)
    }
  },

  /**
   * 输出空行
   *
   * 用于在不同信息块之间添加视觉分隔。
   */
  newline(): void {
    console.log()
  },
}
