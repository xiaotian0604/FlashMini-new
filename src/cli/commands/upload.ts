/**
 * upload 命令实现
 *
 * 这是 Flashmini 最核心的命令，负责将小程序上传到指定平台。
 *
 * 命令格式：
 * ```bash
 * flashmini upload [options]
 * ```
 *
 * 支持的选项：
 * -p, --platform <platforms>  指定平台，逗号分隔（如 wechat,alipay）
 * -e, --env <env>            环境（dev/test/prod），默认 prod
 * --version <version>        覆盖配置文件中的版本号
 * --desc <desc>              覆盖上传备注
 * --no-notify                禁用上传通知
 * --json                     以 JSON 格式输出结果（CI 场景）
 * --dry-run                  试运行，不实际上传
 *
 * 执行流程：
 * 1. 加载配置文件（Cosmiconfig）
 * 2. Zod Schema 校验配置
 * 3. CLI 参数覆盖配置
 * 4. 创建 Runner 并执行上传
 * 5. 输出结果（表格或 JSON）
 * 6. 根据结果设置退出码（有失败则非零退出）
 */

import { loadConfig } from '../../core/config/loader'
import { ConfigSchema } from '../../core/config/schema'
import { Runner } from '../../core/runner'
import { logger } from '../ui/logger'
import { startSpinner } from '../ui/spinner'
import { printSummary } from '../ui/summary'
import type { FlashminiConfig } from '../../types/config'

/**
 * upload 命令的 CLI 选项类型
 */
export interface UploadCommandOptions {
  /** 指定平台（逗号分隔的字符串） */
  platform?: string
  /** 运行环境 */
  env: string
  /** 覆盖版本号 */
  version?: string
  /** 覆盖上传描述 */
  desc?: string
  /** 是否发送通知（--no-notify 时为 false） */
  notify: boolean
  /** 是否以 JSON 格式输出 */
  json?: boolean
  /** 是否试运行 */
  dryRun?: boolean
}

/**
 * upload 命令处理函数
 *
 * 由 Commander.js 在用户执行 `flashmini upload` 时调用。
 * 完成配置加载、校验、上传执行、结果输出的完整流程。
 *
 * @param options - Commander.js 解析后的命令选项
 */
export async function uploadCommand(options: UploadCommandOptions): Promise<void> {
  // ─── 步骤 1：加载配置文件 ──────────────────────────────────────
  const raw = await loadConfig()

  if (!raw) {
    logger.error('未找到配置文件，请先运行 flashmini init')
    process.exit(1)
  }

  logger.debug(`配置文件路径: ${raw.filepath}`)

  // ─── 步骤 2：Zod Schema 校验 ──────────────────────────────────
  const result = ConfigSchema.safeParse(raw.config)

  if (!result.success) {
    logger.error('配置文件校验失败：')
    // 逐字段输出校验错误，帮助用户快速定位问题
    result.error.errors.forEach(e => {
      logger.error(`  ${e.path.join('.')} — ${e.message}`)
    })
    process.exit(1)
  }

  // ─── 步骤 3：CLI 参数覆盖配置 ─────────────────────────────────
  const config = mergeWithCliOptions(result.data, options)

  // ─── 步骤 4：执行上传 ─────────────────────────────────────────
  const spinner = startSpinner('准备上传...')

  try {
    const runner = new Runner(config)
    const ctx = await runner.run({
      env: options.env,
      platforms: options.platform?.split(','),
      dryRun: options.dryRun,
    })

    spinner.stop()

    // ─── 步骤 5：输出结果 ───────────────────────────────────────
    if (options.json) {
      // CI 场景：JSON 格式输出，便于脚本解析
      console.log(JSON.stringify({
        success: true,
        results: ctx.results,
        version: ctx.version,
        duration: ctx.duration,
      }))
    } else {
      // 交互场景：美观的表格输出
      printSummary(ctx)
    }

    // ─── 步骤 6：设置退出码 ─────────────────────────────────────
    // 有失败平台则非零退出，CI 流水线可感知失败
    if (ctx.failedPlatforms.length > 0) {
      process.exit(1)
    }
  } catch (err) {
    spinner.fail('上传失败')
    logger.error(err instanceof Error ? err.message : String(err))

    // CI 场景下也输出 JSON 格式的错误信息
    if (options.json) {
      console.log(JSON.stringify({
        success: false,
        error: String(err),
      }))
    }

    process.exit(1)
  }
}

/**
 * 将 CLI 参数合并到配置对象中
 *
 * CLI 参数的优先级高于配置文件，用于临时覆盖配置。
 * 例如：`flashmini upload --version 2.0.0` 会覆盖配置文件中的 version 字段。
 *
 * @param config - Zod 校验后的配置对象
 * @param options - CLI 命令选项
 * @returns 合并后的配置对象
 */
function mergeWithCliOptions(
  config: FlashminiConfig,
  options: UploadCommandOptions,
): FlashminiConfig {
  // 创建配置的浅拷贝，避免修改原始对象
  const merged = { ...config }

  // 版本号覆盖
  if (options.version) {
    merged.version = options.version
  }

  // 描述覆盖
  if (options.desc) {
    merged.description = options.desc
  }

  // 禁用通知
  if (!options.notify) {
    merged.notify = {
      feishu: { ...merged.notify.feishu, enabled: false },
      dingtalk: { ...merged.notify.dingtalk, enabled: false },
      webhook: { ...merged.notify.webhook, enabled: false },
    }
  }

  return merged
}
