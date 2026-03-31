/**
 * 微信小程序上传策略
 *
 * 封装微信小程序 CI SDK（miniprogram-ci），实现微信平台的上传和预览功能。
 *
 * miniprogram-ci 是微信官方提供的 CI/CD 工具包，支持：
 * - 代码上传（对应微信开发者工具的"上传"功能）
 * - 预览（生成体验版二维码）
 * - 构建 npm 等
 *
 * 鉴权方式：
 * 使用上传密钥文件（privateKeyPath），需要在微信公众平台下载。
 * 每个小程序最多可配置 30 个 CI 机器人，不同机器人的上传记录独立。
 *
 * @see https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html
 */

import { z } from 'zod'
import { BaseUploader } from '../base'
import { WechatSchema } from './schema'
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
 * 微信小程序上传器
 *
 * 继承 BaseUploader，实现微信平台特定的上传和预览逻辑。
 * 在构造时通过 Zod Schema 校验配置，确保配置错误提前暴露。
 */
export class WechatUploader extends BaseUploader {
  /** 经过 Zod 校验的微信平台配置（类型安全） */
  private wechatConfig: z.infer<typeof WechatSchema>

  /**
   * @param rawConfig - 微信平台的原始配置对象
   * @throws ZodError 当配置校验失败时
   */
  constructor(rawConfig: unknown) {
    super(rawConfig)
    // 构造时立即校验配置，错误提前暴露
    this.wechatConfig = WechatSchema.parse(rawConfig)
  }

  /** 平台中文显示名称 */
  get platformName(): string {
    return '微信小程序'
  }

  /**
   * 执行微信小程序上传
   *
   * 调用 miniprogram-ci 的 upload API 将构建产物上传到微信后台。
   * 上传成功后，可以在微信公众平台的版本管理中看到新版本。
   *
   * 流程：
   * 1. 创建 ci.Project 实例（指定 appid、项目路径、密钥路径）
   * 2. 调用 ci.upload() 执行上传
   * 3. 返回包含耗时等信息的 UploadResult
   *
   * @param ctx - 上传上下文，提供版本号和描述信息
   * @returns 上传结果对象
   */
  async upload(ctx: Context): Promise<UploadResult> {
    const mockReason = this.getMockReason(ctx)

    if (mockReason) {
      return simulateUpload({
        platform: 'wechat',
        projectPath: this.wechatConfig.projectPath,
        reason: mockReason,
        ctx,
      })
    }

    this.assertRealUploadConfig()
    const start = Date.now()

    try {
      // 动态导入 miniprogram-ci，避免未安装时影响其他平台
      const ci = await import('miniprogram-ci')

      // 创建项目实例
      const project = new ci.Project({
        appid: this.wechatConfig.appId,
        type: 'miniProgram',
        projectPath: this.wechatConfig.projectPath,
        privateKeyPath: this.wechatConfig.privateKeyPath,
        ignores: ['node_modules/**/*'],
      })

      // 执行上传
      await ci.upload({
        project,
        version: ctx.version,
        desc: ctx.description,
        robot: this.wechatConfig.robot,
        onProgressUpdate: () => {},
      })

      return {
        platform: 'wechat',
        success: true,
        version: ctx.version,
        duration: Date.now() - start,
      }
    } catch (err) {
      throw new FlashminiError(
        `微信小程序上传失败: ${(err as Error).message}`,
        ErrorCode.UPLOAD_FAILED,
        'wechat',
      )
    }
  }

  /**
   * 生成微信小程序体验版二维码
   *
   * 调用 miniprogram-ci 的 preview API 生成体验版二维码。
   * 返回 Base64 编码的二维码图片，可用于通知消息。
   *
   * @param ctx - 上传上下文
   * @returns Base64 编码的二维码图片字符串
   */
  async preview(ctx: Context): Promise<string> {
    const mockReason = this.getMockReason(ctx)

    if (mockReason) {
      return simulatePreview({
        platform: 'wechat',
        projectPath: this.wechatConfig.projectPath,
        reason: mockReason,
        ctx,
      })
    }

    this.assertRealUploadConfig()

    try {
      const ci = await import('miniprogram-ci')

      const project = new ci.Project({
        appid: this.wechatConfig.appId,
        type: 'miniProgram',
        projectPath: this.wechatConfig.projectPath,
        privateKeyPath: this.wechatConfig.privateKeyPath,
        ignores: ['node_modules/**/*'],
      })

      const result = await ci.preview({
        project,
        version: ctx.version,
        desc: ctx.description || '预览版',
        robot: this.wechatConfig.robot,
        qrcodeFormat: 'base64',
        qrcodeOutputDest: '',
        onProgressUpdate: () => {},
      })

      // miniprogram-ci preview 返回的 subPackageInfo 中可能包含二维码
      return (result as any)?.qrcodeImageBuffer?.toString('base64') || ''
    } catch (err) {
      throw new FlashminiError(
        `微信小程序预览失败: ${(err as Error).message}`,
        ErrorCode.UPLOAD_FAILED,
        'wechat',
      )
    }
  }

  /**
   * 校验微信平台配置
   *
   * 使用 Zod Schema 进行严格校验，确保所有必填字段都已正确填写。
   * 校验规则包括：appId 必须以 'wx' 开头、robot 必须在 1-30 之间等。
   */
  validateConfig(): void {
    WechatSchema.parse(this.config)
  }

  private getMockReason(ctx: Context): string | null {
    const missingFields: string[] = []

    if (!this.isConfiguredWechatAppId()) {
      missingFields.push('appId')
    }

    if (!hasConfiguredValue(this.wechatConfig.privateKeyPath)) {
      missingFields.push('privateKeyPath')
    }

    return shouldUseMockStrategy({
      env: ctx.env,
      explicitMock: this.wechatConfig.mock,
      missingFields,
    })
  }

  private assertRealUploadConfig(): void {
    const missingFields: string[] = []

    if (!this.isConfiguredWechatAppId()) {
      missingFields.push('appId')
    }

    if (!hasConfiguredValue(this.wechatConfig.privateKeyPath)) {
      missingFields.push('privateKeyPath')
    }

    if (missingFields.length > 0) {
      throw new FlashminiError(
        `微信小程序上传缺少配置: ${missingFields.join(', ')}。dev 环境下可留空自动走模拟上传，或显式配置 mock: true。`,
        ErrorCode.CONFIG_INVALID,
        'wechat',
      )
    }
  }

  private isConfiguredWechatAppId(): boolean {
    const appId = this.wechatConfig.appId.trim()
    return hasConfiguredValue(appId) && !/^wx_+$/.test(appId)
  }
}
