/**
 * 字节跳动小程序上传策略
 *
 * 封装字节跳动小程序上传工具（tt-ide-cli），实现字节平台的上传和预览功能。
 *
 * 字节跳动小程序支持两种鉴权方式：
 * 1. 邮箱 + 密码
 * 2. Token 鉴权
 *
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/developer-instrument/development-assistance/ide-cli
 */

import { z } from 'zod'
import { BaseUploader } from '../base'
import { BytedanceSchema } from './schema'
import type { Context } from '../../core/context'
import type { UploadResult } from '../../types/platform'
import { FlashminiError, ErrorCode } from '../../utils/errors'

/**
 * 字节跳动小程序上传器
 *
 * 继承 BaseUploader，实现字节跳动平台特定的上传和预览逻辑。
 */
export class BytedanceUploader extends BaseUploader {
  /** 经过 Zod 校验的字节跳动平台配置 */
  private bytedanceConfig: z.infer<typeof BytedanceSchema>

  /**
   * @param rawConfig - 字节跳动平台的原始配置对象
   * @throws ZodError 当配置校验失败时
   */
  constructor(rawConfig: unknown) {
    super(rawConfig)
    this.bytedanceConfig = BytedanceSchema.parse(rawConfig)
  }

  /** 平台中文显示名称 */
  get platformName(): string {
    return '字节跳动小程序'
  }

  /**
   * 执行字节跳动小程序上传
   *
   * 通过 tt-ide-cli 工具执行上传操作。
   * 根据配置选择使用 token 或邮箱密码进行鉴权。
   *
   * @param ctx - 上传上下文
   * @returns 上传结果对象
   */
  async upload(ctx: Context): Promise<UploadResult> {
    const start = Date.now()

    try {
      const { execFileSync } = await import('child_process')

      // 构建鉴权参数数组（使用数组避免 shell 注入风险）
      const authArgs = this.bytedanceConfig.token
        ? ['--token', this.bytedanceConfig.token]
        : ['--email', this.bytedanceConfig.email, '--password', this.bytedanceConfig.password]

      // 使用 execFileSync + 参数数组，避免 shell 注入风险
      execFileSync('npx', [
        'tt-ide-cli', 'upload',
        ...authArgs,
        '--project', this.bytedanceConfig.projectPath,
        '--version', ctx.version,
        '--desc', ctx.description,
      ], {
        stdio: 'pipe',
        encoding: 'utf-8',
      })

      return {
        platform: 'bytedance',
        success: true,
        version: ctx.version,
        duration: Date.now() - start,
      }
    } catch (err) {
      throw new FlashminiError(
        `字节跳动小程序上传失败: ${(err as Error).message}`,
        ErrorCode.UPLOAD_FAILED,
        'bytedance',
      )
    }
  }

  /**
   * 生成字节跳动小程序预览二维码
   *
   * @param ctx - 上传上下文
   * @returns 二维码 URL 或 Base64 字符串
   */
  async preview(ctx: Context): Promise<string> {
    try {
      const { execFileSync } = await import('child_process')

      // 构建鉴权参数数组
      const authArgs = this.bytedanceConfig.token
        ? ['--token', this.bytedanceConfig.token]
        : ['--email', this.bytedanceConfig.email, '--password', this.bytedanceConfig.password]

      // 使用 execFileSync + 参数数组，避免 shell 注入风险
      const output = execFileSync('npx', [
        'tt-ide-cli', 'preview',
        ...authArgs,
        '--project', this.bytedanceConfig.projectPath,
      ], {
        stdio: 'pipe',
        encoding: 'utf-8',
      })

      const urlMatch = output.match(/https?:\/\/[^\s]+/)
      return urlMatch ? urlMatch[0] : ''
    } catch (err) {
      throw new FlashminiError(
        `字节跳动小程序预览失败: ${(err as Error).message}`,
        ErrorCode.UPLOAD_FAILED,
        'bytedance',
      )
    }
  }

  /** 校验字节跳动平台配置 */
  validateConfig(): void {
    BytedanceSchema.parse(this.config)
  }
}
