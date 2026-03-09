/**
 * 平台上传器抽象基类
 *
 * 定义了所有平台上传器必须实现的接口契约。
 * 每个平台（微信、支付宝、百度、字节）都需要继承此基类，
 * 并实现 upload()、preview()、validateConfig() 等抽象方法。
 *
 * 设计模式：模板方法模式（Template Method Pattern）
 * - 基类定义了上传流程的骨架（接口契约）
 * - 子类实现具体的上传逻辑（与各平台 SDK 对接）
 * - 新增平台只需创建新的子类，不修改已有代码
 *
 * 配合工厂模式使用：
 * PlatformFactory.create('wechat', config) 会根据平台名称
 * 创建对应的子类实例，调用方无需关心具体的上传器类。
 */

import type { Context } from '../core/context'
import type { UploadResult } from '../types/platform'

/**
 * 平台上传器抽象基类
 *
 * 所有平台上传器的父类，定义了统一的接口。
 * 子类在构造函数中接收平台配置，并通过 Zod Schema 进行校验。
 *
 * @example
 * ```typescript
 * class WechatUploader extends BaseUploader {
 *   get platformName() { return '微信小程序' }
 *
 *   async upload(ctx: Context): Promise<UploadResult> {
 *     // 调用微信 miniprogram-ci SDK 执行上传
 *   }
 *
 *   async preview(ctx: Context): Promise<string> {
 *     // 生成体验版二维码
 *   }
 *
 *   validateConfig(): void {
 *     // 使用 Zod Schema 校验配置
 *   }
 * }
 * ```
 */
export abstract class BaseUploader {
  /**
   * 平台原始配置（由子类在构造函数中通过 Zod 校验后赋值）
   *
   * 使用 unknown 类型是因为不同平台的配置结构不同，
   * 具体类型由子类通过 Zod Schema 在构造时确定。
   */
  protected config: unknown

  /**
   * @param config - 平台的原始配置对象（尚未校验）
   */
  constructor(config: unknown) {
    this.config = config
  }

  /**
   * 执行上传操作
   *
   * 子类必须实现此方法，封装与平台 SDK 的交互逻辑。
   * 返回的 UploadResult 包含上传是否成功、耗时、二维码等信息。
   *
   * @param ctx - 上传上下文对象，包含版本号、描述等信息
   * @returns 上传结果对象
   * @throws 当上传失败时应抛出错误（由 Runner 的重试机制处理）
   */
  abstract upload(ctx: Context): Promise<UploadResult>

  /**
   * 生成体验版/预览版二维码
   *
   * 子类必须实现此方法，调用平台 SDK 生成预览二维码。
   * 返回的字符串可以是 URL 或 Base64 编码的图片数据。
   *
   * @param ctx - 上传上下文对象
   * @returns 二维码 URL 或 Base64 编码字符串
   */
  abstract preview(ctx: Context): Promise<string>

  /**
   * 校验平台配置
   *
   * 子类必须实现此方法，使用 Zod Schema 校验平台配置。
   * 通常在构造函数中调用，确保配置错误在上传前就被发现。
   *
   * @throws 当配置校验失败时抛出 ZodError
   */
  abstract validateConfig(): void

  /**
   * 获取平台的中文显示名称
   *
   * 用于 CLI 输出和通知消息中的平台名称展示。
   * 例如：'微信小程序'、'支付宝小程序'
   */
  abstract get platformName(): string
}
