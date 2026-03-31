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
 * -e, --env <env>           运行环境（默认 dev）
 * --config <path>           指定配置文件路径
 *
 * 执行流程：
 * 1. 加载并校验配置文件
 * 2. 创建指定平台的上传器
 * 3. 调用上传器的 preview() 方法生成二维码
 * 4. 在终端中展示二维码字符画
 */

import { Context } from '../../core/context'
import {
  loadValidatedConfig,
} from '../../core/config/runtime'
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
  /** 运行环境 */
  env: string
  /** 配置文件路径 */
  config?: string
}

/**
 * preview 命令处理函数
 *
 * 由 Commander.js 在用户执行 `flashmini preview` 时调用。
 *
 * @param options - Commander.js 解析后的命令选项
 */
export async function previewCommand(options: PreviewCommandOptions): Promise<void> {
  let spinner: ReturnType<typeof startSpinner> | undefined

  try {
    const resolved = await loadValidatedConfig(options.config)
    const config = resolved.config
    const platformName = options.platform
    const platformConfig = (config.platforms as any)[platformName]

    if (!platformConfig) {
      logger.error(`未找到平台 "${platformName}" 的配置，请检查配置文件`)
      process.exit(1)
    }

    spinner = startSpinner(`正在生成 ${platformName} 预览二维码...`)

    // 创建上下文（preview 也需要版本号等信息）
    const ctx = new Context(config, options.env)
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
      if (qrcodeData.includes('mock.flashmini.local')) {
        logger.info(`模拟二维码链接: ${qrcodeData}`)
      } else {
        logger.info(`二维码链接: ${qrcodeData}`)
      }
    } else if (qrcodeData) {
      logger.info('二维码数据已生成（Base64 格式）')
    } else {
      logger.warn('未能获取到预览二维码')
    }
  } catch (err) {
    spinner?.fail('预览二维码生成失败')
    logger.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}
