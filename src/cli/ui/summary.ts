/**
 * 上传结果汇总表格输出
 *
 * 使用 cli-table3 库在终端中输出美观的结果汇总表格。
 * 表格包含每个平台的上传状态、版本号和耗时信息。
 *
 * 输出效果示例：
 * ```
 * ┌──────────────┬─────────┬──────────┬────────┐
 * │ 平台         │ 状态    │ 版本     │ 耗时   │
 * ├──────────────┼─────────┼──────────┼────────┤
 * │ 微信小程序   │ ✅ 成功  │ 1.2.3    │ 8.3s  │
 * │ 支付宝小程序 │ ✅ 成功  │ 1.2.3    │ 12.1s │
 * └──────────────┴─────────┴──────────┴────────┘
 * ```
 *
 * @see https://www.npmjs.com/package/cli-table3
 */

import Table from 'cli-table3'
import chalk from 'chalk'
import type { Context } from '../../core/context'
import { PLATFORM_DISPLAY_NAMES, type PlatformNameType } from '../../types/platform'

/**
 * 打印上传结果汇总
 *
 * 在终端中输出格式化的结果表格和统计信息。
 * 包含以下内容：
 * 1. 每个平台的上传结果表格（平台名、状态、版本、耗时）
 * 2. 通知发送状态
 * 3. 总耗时和上传模式（并行/串行）
 *
 * @param ctx - 上传上下文，包含所有平台的上传结果
 *
 * @example
 * ```typescript
 * const ctx = await runner.run(options)
 * printSummary(ctx)
 * ```
 */
export function printSummary(ctx: Context): void {
  // 空行分隔
  console.log()

  // 创建表格实例，定义列头
  const table = new Table({
    head: [
      chalk.white.bold('平台'),
      chalk.white.bold('状态'),
      chalk.white.bold('版本'),
      chalk.white.bold('耗时'),
    ],
    // 表格样式配置
    style: {
      head: [],
      border: [],
    },
  })

  // 遍历上传结果，填充表格行
  for (const result of ctx.results) {
    // 获取平台的中文显示名称，如果没有映射则使用原始名称
    const displayName = PLATFORM_DISPLAY_NAMES[result.platform as PlatformNameType]
      || result.platform

    // 根据上传结果设置状态文字和颜色
    const status = result.success
      ? chalk.green('✅ 成功')
      : chalk.red('❌ 失败')

    // 格式化耗时（毫秒转秒，保留一位小数）
    const duration = `${(result.duration / 1000).toFixed(1)}s`

    // 添加表格行
    table.push([displayName, status, result.version, duration])
  }

  // 输出表格
  console.log(table.toString())
  console.log()

  // ─── 统计信息 ──────────────────────────────────────────────────

  // 成功/失败计数
  const successCount = ctx.successCount
  const failCount = ctx.results.length - successCount

  if (failCount > 0) {
    console.log(
      chalk.yellow(`  ⚠  ${successCount} 个平台成功，${failCount} 个平台失败`),
    )
  }

  // 上传模式和总耗时
  const mode = ctx.config.options.parallel ? '并行上传' : '串行上传'
  console.log(
    chalk.gray(`  ⏱  总耗时：${(ctx.duration / 1000).toFixed(1)}s（${mode}）`),
  )
  console.log()
}
