/**
 * CLI 入口模块
 *
 * 使用 Commander.js 注册所有 CLI 命令和选项。
 * 这是 `flashmini` 命令的入口点，由 bin/flashmini.js 引导加载。
 *
 * Commander.js 是一个轻量成熟的 CLI 框架，提供：
 * - 命令和子命令注册
 * - 选项解析（短选项 -p、长选项 --platform）
 * - 自动生成帮助信息
 * - 版本号展示
 *
 * 注册的命令：
 * - flashmini upload  — 上传小程序到指定平台
 * - flashmini init    — 生成默认配置文件
 * - flashmini preview — 生成体验版二维码
 *
 * @see https://www.npmjs.com/package/commander
 */

import { Command } from 'commander'
import { uploadCommand } from './commands/upload'
import { initCommand } from './commands/init'
import { previewCommand } from './commands/preview'
import { doctorCommand } from './commands/doctor'
import { planCommand } from './commands/plan'

/**
 * 创建 Commander 程序实例
 *
 * 设置程序的基本信息：名称、描述、版本号。
 */
const program = new Command()

program
  .name('flashmini')
  .description('多平台小程序一键上传工具')
  .version('1.0.0', '-v, --version')

// ─── upload 命令 ──────────────────────────────────────────────────

/**
 * flashmini upload 命令
 *
 * 核心命令，将小程序上传到指定平台。
 * 支持多平台并行上传、重试、通知等功能。
 *
 * 使用示例：
 * ```bash
 * # 上传所有已启用的平台
 * flashmini upload
 *
 * # 只上传微信和支付宝
 * flashmini upload -p wechat,alipay
 *
 * # 指定环境和版本号
 * flashmini upload -e prod --version 2.0.0
 *
 * # CI 场景：JSON 输出 + 禁用通知
 * flashmini upload --json --no-notify
 *
 * # 试运行（不实际上传）
 * flashmini upload --dry-run
 * ```
 */
program
  .command('upload')
  .description('上传小程序到指定平台')
  .option('-p, --platform <platforms>', '指定平台，逗号分隔（wechat,alipay）')
  .option('-e, --env <env>', '环境（dev/test/prod）', 'prod')
  .option('--config <path>', '指定配置文件路径')
  .option('--version <version>', '覆盖配置文件中的版本号')
  .option('--desc <desc>', '覆盖上传备注')
  .option('--no-notify', '禁用上传通知')
  .option('--json', '以 JSON 格式输出结果（CI 场景）')
  .option('--report <path>', '将结构化报告写入文件')
  .option('--dry-run', '试运行，不实际上传')
  .action(uploadCommand)

// ─── init 命令 ────────────────────────────────────────────────────

/**
 * flashmini init 命令
 *
 * 在当前目录生成默认配置文件 flashmini.config.ts。
 * 配置文件包含完整的注释说明。
 *
 * 使用示例：
 * ```bash
 * # 生成配置文件
 * flashmini init
 *
 * # 覆盖已有配置文件
 * flashmini init --force
 * ```
 */
program
  .command('init')
  .description('在当前目录生成默认配置文件')
  .option('--force', '覆盖已有配置文件')
  .action(initCommand)

// ─── preview 命令 ─────────────────────────────────────────────────

/**
 * flashmini preview 命令
 *
 * 生成小程序体验版二维码，在终端中展示。
 *
 * 使用示例：
 * ```bash
 * # 生成微信小程序预览二维码（默认）
 * flashmini preview
 *
 * # 生成支付宝小程序预览二维码
 * flashmini preview -p alipay
 * ```
 */
program
  .command('preview')
  .description('生成小程序体验版二维码')
  .option('-p, --platform <platform>', '平台（默认 wechat）', 'wechat')
  .option('-e, --env <env>', '环境（默认 dev）', 'dev')
  .option('--config <path>', '指定配置文件路径')
  .action(previewCommand)

program
  .command('plan')
  .description('输出本次执行计划，不实际上传')
  .option('-p, --platform <platforms>', '指定平台，逗号分隔（wechat,alipay）')
  .option('-e, --env <env>', '环境（dev/test/prod）', 'prod')
  .option('--config <path>', '指定配置文件路径')
  .option('--version <version>', '覆盖配置文件中的版本号')
  .option('--desc <desc>', '覆盖上传备注')
  .option('--no-notify', '禁用上传通知')
  .option('--json', '以 JSON 格式输出执行计划')
  .option('--report <path>', '将结构化报告写入文件')
  .option('--dry-run', '按 dry-run 模式生成执行计划')
  .action(planCommand)

program
  .command('doctor')
  .description('诊断当前配置和运行环境')
  .option('-p, --platform <platforms>', '指定平台，逗号分隔（wechat,alipay）')
  .option('-e, --env <env>', '环境（dev/test/prod）', 'prod')
  .option('--config <path>', '指定配置文件路径')
  .option('--version <version>', '覆盖配置文件中的版本号')
  .option('--desc <desc>', '覆盖上传备注')
  .option('--no-notify', '禁用上传通知')
  .option('--json', '以 JSON 格式输出诊断结果')
  .option('--report <path>', '将结构化报告写入文件')
  .action(doctorCommand)

// ─── 解析命令行参数 ──────────────────────────────────────────────

/**
 * 解析命令行参数并执行对应的命令
 *
 * Commander.js 会自动匹配用户输入的命令和选项，
 * 调用对应的 action 处理函数。
 * 如果用户未输入任何命令，会显示帮助信息。
 */
program.parse()
