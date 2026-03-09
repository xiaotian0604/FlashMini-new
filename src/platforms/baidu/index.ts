/**
 * 百度智能小程序上传策略
 *
 * 封装百度智能小程序 CI 工具（swan-toolkit），实现百度平台的上传和预览功能。
 *
 * 百度智能小程序上传使用 token 进行鉴权，
 * token 可在百度智能小程序开发者平台获取。
 *
 * @see https://smartprogram.baidu.com/docs/develop/devtools/commandtool/
 */

import { z } from 'zod'
import { BaseUploader } from '../base'
import { BaiduSchema } from './schema'
import type { Context } from '../../core/context'
import type { UploadResult } from '../../types/platform'
import { FlashminiError, ErrorCode } from '../../utils/errors'

/**
 * 百度智能小程序上传器
 *
 * 继承 BaseUploader，实现百度平台特定的上传和预览逻辑。
 */
export class BaiduUploader extends BaseUploader {
  /** 经过 Zod 校验的百度平台配置 */
  private baiduConfig: z.infer<typeof BaiduSchema>

  /**
   * @param rawConfig - 百度平台的原始配置对象
   * @throws ZodError 当配置校验失败时
   */
  constructor(rawConfig: unknown) {
    super(rawConfig)
    this.baiduConfig = BaiduSchema.parse(rawConfig)
  }

  /** 平台中文显示名称 */
  get platformName(): string {
    return '百度智能小程序'
  }

  /**
   * 执行百度智能小程序上传
   *
   * 通过 swan-toolkit 的 CLI 命令执行上传。
   * 由于 swan-toolkit 主要提供 CLI 接口，这里通过 child_process 调用。
   *
   * @param ctx - 上传上下文
   * @returns 上传结果对象
   */
  async upload(ctx: Context): Promise<UploadResult> {
    const start = Date.now()

    try {
      const { execFileSync } = await import('child_process')

      // 使用 execFileSync + 参数数组，避免 shell 注入风险
      execFileSync('npx', [
        'swan-toolkit', 'upload',
        '--token', this.baiduConfig.token,
        '--project-path', this.baiduConfig.projectPath,
        '--release-version', ctx.version,
        '--desc', ctx.description,
      ], {
        stdio: 'pipe',
        encoding: 'utf-8',
      })

      return {
        platform: 'baidu',
        success: true,
        version: ctx.version,
        duration: Date.now() - start,
      }
    } catch (err) {
      throw new FlashminiError(
        `百度智能小程序上传失败: ${(err as Error).message}`,
        ErrorCode.UPLOAD_FAILED,
        'baidu',
      )
    }
  }

  /**
   * 生成百度智能小程序预览二维码
   *
   * @param ctx - 上传上下文
   * @returns 二维码 URL 或 Base64 字符串
   */
  async preview(ctx: Context): Promise<string> {
    try {
      const { execFileSync } = await import('child_process')

      // 使用 execFileSync + 参数数组，避免 shell 注入风险
      const output = execFileSync('npx', [
        'swan-toolkit', 'preview',
        '--token', this.baiduConfig.token,
        '--project-path', this.baiduConfig.projectPath,
      ], {
        stdio: 'pipe',
        encoding: 'utf-8',
      })

      const urlMatch = output.match(/https?:\/\/[^\s]+/)
      return urlMatch ? urlMatch[0] : ''
    } catch (err) {
      throw new FlashminiError(
        `百度智能小程序预览失败: ${(err as Error).message}`,
        ErrorCode.UPLOAD_FAILED,
        'baidu',
      )
    }
  }

  /** 校验百度平台配置 */
  validateConfig(): void {
    BaiduSchema.parse(this.config)
  }
}
