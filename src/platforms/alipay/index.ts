/**
 * 支付宝小程序上传策略
 *
 * 封装支付宝小程序开发工具 SDK（minidev），实现支付宝平台的上传和预览功能。
 *
 * 支付宝小程序上传依赖 minidev 工具，支持两种鉴权方式：
 * 1. 直接提供私钥字符串（privateKey）
 * 2. 提供私钥文件路径（privateKeyPath）
 *
 * @see https://opendocs.alipay.com/mini/ide/overview 支付宝小程序 IDE 文档
 */

import { readFileSync } from 'fs'
import { z } from 'zod'
import { BaseUploader } from '../base'
import { AlipaySchema } from './schema'
import type { Context } from '../../core/context'
import type { UploadResult } from '../../types/platform'
import { FlashminiError, ErrorCode } from '../../utils/errors'
import {
  hasConfiguredValue,
  shouldUseMockStrategy,
  simulatePreview,
  simulateUpload,
} from '../mock'

/**
 * 支付宝小程序上传器
 *
 * 继承 BaseUploader，实现支付宝平台特定的上传和预览逻辑。
 */
export class AlipayUploader extends BaseUploader {
  /** 经过 Zod 校验的支付宝平台配置 */
  private alipayConfig: z.infer<typeof AlipaySchema>

  /**
   * @param rawConfig - 支付宝平台的原始配置对象
   * @throws ZodError 当配置校验失败时
   */
  constructor(rawConfig: unknown) {
    super(rawConfig)
    this.alipayConfig = AlipaySchema.parse(rawConfig)
    // 如果提供了 privateKeyPath 但没有 privateKey，自动读取文件内容
    if (!this.alipayConfig.privateKey && this.alipayConfig.privateKeyPath) {
      this.alipayConfig = {
        ...this.alipayConfig,
        privateKey: readFileSync(this.alipayConfig.privateKeyPath, 'utf-8'),
      }
    }
  }

  /** 平台中文显示名称 */
  get platformName(): string {
    return '支付宝小程序'
  }

  /**
   * 执行支付宝小程序上传
   *
   * 调用 minidev SDK 将构建产物上传到支付宝开放平台。
   *
   * @param ctx - 上传上下文
   * @returns 上传结果对象
   */
  async upload(ctx: Context): Promise<UploadResult> {
    const mockReason = this.getMockReason(ctx)

    if (mockReason) {
      return simulateUpload({
        platform: 'alipay',
        projectPath: this.alipayConfig.projectPath,
        reason: mockReason,
        ctx,
      })
    }

    this.assertRealUploadConfig()
    const start = Date.now()

    try {
      // 动态导入 minidev SDK
      const minidev = await import('minidev')

      await minidev.minidev.upload({
        project: this.alipayConfig.projectPath,
        appId: this.alipayConfig.appId,
        toolId: this.alipayConfig.toolId,
        privateKey: this.alipayConfig.privateKey,
        version: ctx.version,
        experience: true,
        onProgressUpdate: () => {},
      })

      return {
        platform: 'alipay',
        success: true,
        version: ctx.version,
        duration: Date.now() - start,
      }
    } catch (err) {
      throw new FlashminiError(
        `支付宝小程序上传失败: ${(err as Error).message}`,
        ErrorCode.UPLOAD_FAILED,
        'alipay',
      )
    }
  }

  /**
   * 生成支付宝小程序预览二维码
   *
   * @param ctx - 上传上下文
   * @returns 二维码 URL 或 Base64 字符串
   */
  async preview(ctx: Context): Promise<string> {
    const mockReason = this.getMockReason(ctx)

    if (mockReason) {
      return simulatePreview({
        platform: 'alipay',
        projectPath: this.alipayConfig.projectPath,
        reason: mockReason,
        ctx,
      })
    }

    this.assertRealUploadConfig()

    try {
      const minidev = await import('minidev')

      const result = await minidev.minidev.preview({
        project: this.alipayConfig.projectPath,
        appId: this.alipayConfig.appId,
        toolId: this.alipayConfig.toolId,
        privateKey: this.alipayConfig.privateKey,
      })

      return (result as any)?.qrcodeUrl || ''
    } catch (err) {
      throw new FlashminiError(
        `支付宝小程序预览失败: ${(err as Error).message}`,
        ErrorCode.UPLOAD_FAILED,
        'alipay',
      )
    }
  }

  /** 校验支付宝平台配置 */
  validateConfig(): void {
    AlipaySchema.parse(this.config)
  }

  private getMockReason(ctx: Context): string | null {
    const missingFields: string[] = []

    if (!hasConfiguredValue(this.alipayConfig.appId)) {
      missingFields.push('appId')
    }

    if (!hasConfiguredValue(this.alipayConfig.privateKey)) {
      missingFields.push('privateKey/privateKeyPath')
    }

    return shouldUseMockStrategy({
      env: ctx.env,
      explicitMock: this.alipayConfig.mock,
      missingFields,
    })
  }

  private assertRealUploadConfig(): void {
    const missingFields: string[] = []

    if (!hasConfiguredValue(this.alipayConfig.appId)) {
      missingFields.push('appId')
    }

    if (!hasConfiguredValue(this.alipayConfig.privateKey)) {
      missingFields.push('privateKey/privateKeyPath')
    }

    if (missingFields.length > 0) {
      throw new FlashminiError(
        `支付宝小程序上传缺少配置: ${missingFields.join(', ')}。dev 环境下可留空自动走模拟上传，或显式配置 mock: true。`,
        ErrorCode.CONFIG_INVALID,
        'alipay',
      )
    }
  }
}
