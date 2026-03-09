/**
 * 平台工厂（Platform Factory）
 *
 * 使用工厂模式根据平台名称创建对应的上传器实例。
 * 调用方只需提供平台名称和配置，无需关心具体的上传器类。
 *
 * 设计模式：工厂模式（Factory Pattern）
 * - 通过 PLATFORM_MAP 注册表维护平台名称到上传器类的映射
 * - create() 方法根据名称查找并实例化对应的上传器
 * - register() 方法允许外部注册自定义平台（扩展点）
 *
 * 扩展性：
 * 新增平台只需两步：
 * 1. 创建新的上传器类（继承 BaseUploader）
 * 2. 在 PLATFORM_MAP 中注册
 * 主流程代码（Runner）完全不需要修改。
 */

import { BaseUploader } from './base'
import { WechatUploader } from './wechat'
import { AlipayUploader } from './alipay'
import { BaiduUploader } from './baidu'
import { BytedanceUploader } from './bytedance'
import { FlashminiError, ErrorCode } from '../utils/errors'

/**
 * 平台注册表
 *
 * 维护平台名称到上传器构造函数的映射关系。
 * 使用 Record 类型确保每个值都是 BaseUploader 的子类构造函数。
 *
 * 新增平台时只需在此处添加一行映射即可。
 */
const PLATFORM_MAP: Record<string, new (config: any) => BaseUploader> = {
  wechat: WechatUploader,
  alipay: AlipayUploader,
  baidu: BaiduUploader,
  bytedance: BytedanceUploader,
}

/**
 * 平台工厂类
 *
 * 提供静态方法来创建和注册平台上传器。
 * 使用静态方法而非实例方法，因为工厂本身不需要维护状态。
 */
export class PlatformFactory {
  /**
   * 根据平台名称创建上传器实例
   *
   * 从注册表中查找对应的上传器类，并用配置实例化。
   * 上传器在构造时会自动进行 Zod 配置校验。
   *
   * @param platform - 平台名称（如 'wechat'、'alipay'）
   * @param config - 该平台的配置对象
   * @returns 对应平台的上传器实例
   * @throws FlashminiError 当平台名称不在注册表中时
   *
   * @example
   * ```typescript
   * const uploader = PlatformFactory.create('wechat', config.platforms.wechat)
   * const result = await uploader.upload(ctx)
   * ```
   */
  static create(platform: string, config: unknown): BaseUploader {
    const Uploader = PLATFORM_MAP[platform]

    if (!Uploader) {
      throw new FlashminiError(
        `不支持的平台: ${platform}。支持的平台: ${Object.keys(PLATFORM_MAP).join(', ')}`,
        ErrorCode.PLATFORM_NOT_FOUND,
        platform,
      )
    }

    return new Uploader(config)
  }

  /**
   * 注册自定义平台上传器
   *
   * 允许用户或第三方插件注册新的平台支持。
   * 注册后即可在配置文件中使用该平台名称。
   *
   * @param name - 平台名称（不能与已有平台重名）
   * @param uploader - 上传器类（必须继承 BaseUploader）
   * @throws 当平台名称已存在时抛出错误
   *
   * @example
   * ```typescript
   * // 注册自定义平台
   * PlatformFactory.register('kuaishou', KuaishouUploader)
   *
   * // 之后就可以在配置中使用
   * // platforms: { kuaishou: { enabled: true, ... } }
   * ```
   */
  static register(
    name: string,
    uploader: new (config: any) => BaseUploader,
  ): void {
    if (PLATFORM_MAP[name]) {
      throw new Error(`平台 ${name} 已存在，请使用不同的名称`)
    }
    PLATFORM_MAP[name] = uploader
  }

  /**
   * 获取所有已注册的平台名称列表
   *
   * 用于 CLI 帮助信息和错误提示中展示支持的平台。
   *
   * @returns 平台名称数组
   */
  static getPlatformNames(): string[] {
    return Object.keys(PLATFORM_MAP)
  }
}
