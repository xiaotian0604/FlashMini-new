/**
 * preview 命令实现
 *
 * 生成小程序体验版二维码，在终端中直接展示。
 * 开发者可以用手机扫码快速体验最新版本。
 *
 * 命令格式：
 * ```bash
 * flashmini preview [options]
 * ```
 *
 * 支持的选项：
 * -p, --platform <platform>  指定平台（默认 wechat）
 *
 * 执行流程：
 * 1. 加载并校验配置文件
 * 2. 创建指定平台的上传器
 * 3. 调用上传器的 preview() 方法生成二维码
 * 4. 在终端中展示二维码字符画
 */

import { loadConfig } from '../../core/config/loader'
import { ConfigSchema } from '../../core/config/schema'
import { Context } from '../../core/context'
import { PlatformFactory } from '../../platforms/factory'
import { generateTerminalQRCode } from '../../utils/qrcode'
import { resolveVersion, resolveDescription } from '../../utils/env'
import { logger } from '../ui/logger'
import { startSpinner } from '../ui/spinner'

/**
 * preview 命令的 CLI 选项类型
 */
export interface PreviewCommandOptions {
  /** 目标平台（默认 wechat） */
  platform: string
}

/**
 * preview 命令处理函数
 *
 * 由 Commander.js 在用户执行 `flashmini preview` 时调用。
 *
 * @param options - Commander.js 解析后的命令选项
 */
export async function previewCommand(options: PreviewCommandOptions): Promise<void> {
  // ─── 加载配置文件 ──────────────────────────────────────────────
  const raw = await loadConfig()

  if (!raw) {
    logger.error('未找到配置文件，请先运行 flashmini init')
    process.exit(1)
  }

  // ─── Zod Schema 校验 ──────────────────────────────────────────
  const result = ConfigSchema.safeParse(raw.config)

  if (!result.success) {
    logger.error('配置文件校验失败：')
    result.error.errors.forEach(e => {
      logger.error(`  ${e.path.join('.')} — ${e.message}`)
    })
    process.exit(1)
  }

  const config = result.data
  const platformName = options.platform

  // ─── 检查平台配置是否存在 ──────────────────────────────────────
  const platformConfig = (config.platforms as any)[platformName]

  if (!platformConfig) {
    logger.error(`未找到平台 "${platformName}" 的配置，请检查配置文件`)
    process.exit(1)
  }

  // ─── 生成预览二维码 ────────────────────────────────────────────
  const spinner = startSpinner(`正在生成 ${platformName} 预览二维码...`)

  try {
    // 创建上下文（preview 也需要版本号等信息）
    const ctx = new Context(config, 'preview')
    ctx.version = await resolveVersion(config.version)
    ctx.description = await resolveDescription(config.description)

    // 创建平台上传器并生成预览
    const uploader = PlatformFactory.create(platformName, platformConfig)
    const qrcodeData = await uploader.preview(ctx)

    spinner.succeed(`${platformName} 预览二维码已生成`)

    // 如果返回的是 URL，生成终端二维码
    if (qrcodeData.startsWith('http')) {
      const terminalQR = await generateTerminalQRCode(qrcodeData)
      console.log()
      console.log(terminalQR)
      logger.info(`二维码链接: ${qrcodeData}`)
    } else if (qrcodeData) {
      logger.info('二维码数据已生成（Base64 格式）')
    } else {
      logger.warn('未能获取到预览二维码')
    }
  } catch (err) {
    spinner.fail('预览二维码生成失败')
    logger.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}
