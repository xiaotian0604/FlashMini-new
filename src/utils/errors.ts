/**
 * 错误处理模块
 *
 * 定义了 Flashmini 的自定义错误类型和错误码枚举。
 * 通过结构化的错误信息，帮助用户快速定位问题原因。
 *
 * 错误分层设计：
 * - FlashminiError: 所有自定义错误的基类，携带错误码和平台信息
 * - ErrorCode: 枚举所有可能的错误类型，便于程序化处理
 *
 * 使用场景：
 * - 配置文件未找到或校验失败
 * - 平台不支持或上传失败
 * - 网络错误（通知发送失败）
 * - 鉴权失败（密钥错误）
 */

/**
 * 错误码枚举
 *
 * 每个错误码对应一种特定的错误场景，
 * CLI 层可以根据错误码提供针对性的错误提示和修复建议。
 */
export enum ErrorCode {
  /** 配置文件未找到（用户未运行 flashmini init 或配置文件被删除） */
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  /** 配置文件校验失败（Zod Schema 校验不通过） */
  CONFIG_INVALID = 'CONFIG_INVALID',
  /** 平台不支持（用户指定了未注册的平台名称） */
  PLATFORM_NOT_FOUND = 'PLATFORM_NOT_FOUND',
  /** 上传失败（平台 SDK 返回错误） */
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  /** 网络错误（通知发送失败、Webhook 请求超时等） */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** 鉴权失败（密钥错误、token 过期等） */
  AUTH_ERROR = 'AUTH_ERROR',
  /** 插件加载失败（插件文件不存在或导出格式不正确） */
  PLUGIN_ERROR = 'PLUGIN_ERROR',
}

/**
 * Flashmini 自定义错误类
 *
 * 继承自原生 Error，额外携带以下结构化信息：
 * - code: 错误码枚举值，便于程序化判断错误类型
 * - platform: 可选的平台名称，标识错误发生在哪个平台
 *
 * @example
 * ```typescript
 * // 抛出配置未找到错误
 * throw new FlashminiError(
 *   '未找到配置文件，请先运行 flashmini init',
 *   ErrorCode.CONFIG_NOT_FOUND,
 * )
 *
 * // 抛出平台上传失败错误
 * throw new FlashminiError(
 *   '微信小程序上传失败: invalid appid',
 *   ErrorCode.UPLOAD_FAILED,
 *   'wechat',
 * )
 *
 * // 捕获并判断错误类型
 * try {
 *   await runner.run(options)
 * } catch (err) {
 *   if (err instanceof FlashminiError) {
 *     switch (err.code) {
 *       case ErrorCode.CONFIG_NOT_FOUND:
 *         console.log('请先运行 flashmini init 生成配置文件')
 *         break
 *       case ErrorCode.UPLOAD_FAILED:
 *         console.log(`${err.platform} 上传失败: ${err.message}`)
 *         break
 *     }
 *   }
 * }
 * ```
 */
export class FlashminiError extends Error {
  /** 错误码，用于程序化判断错误类型 */
  public readonly code: ErrorCode

  /** 关联的平台名称（仅在平台相关错误时有值） */
  public readonly platform?: string

  /**
   * @param message - 人类可读的错误描述
   * @param code - 错误码枚举值
   * @param platform - 可选的关联平台名称
   */
  constructor(message: string, code: ErrorCode, platform?: string) {
    super(message)
    this.name = 'FlashminiError'
    this.code = code
    this.platform = platform
  }
}
