/**
 * 二维码生成工具
 *
 * 封装 qrcode 库，提供两种二维码输出格式：
 * 1. 终端字符画：在 CLI 中直接展示二维码，方便开发者扫码体验
 * 2. Base64 图片：用于嵌入通知消息（如飞书卡片中的图片）
 *
 * 使用场景：
 * - flashmini preview 命令：在终端展示体验版二维码
 * - 通知消息：将二维码图片嵌入飞书/钉钉通知卡片
 *
 * @see https://www.npmjs.com/package/qrcode qrcode 库文档
 */

import QRCode from 'qrcode'

/**
 * 生成终端字符画二维码
 *
 * 将 URL 转换为由 Unicode 字符组成的二维码，
 * 可以直接在终端中显示，用户用手机扫码即可打开。
 *
 * 使用 'small' 类型以减小终端输出的尺寸。
 *
 * @param url - 要编码的 URL 地址
 * @returns 终端可显示的二维码字符串
 *
 * @example
 * ```typescript
 * const qr = await generateTerminalQRCode('https://example.com')
 * console.log(qr)
 * // ▄▄▄▄▄▄▄ ▄▄▄▄▄ ▄▄▄▄▄▄▄
 * // █ ▄▄▄ █ ▀▄▀▄█ █ ▄▄▄ █
 * // ...
 * ```
 */
export async function generateTerminalQRCode(url: string): Promise<string> {
  return QRCode.toString(url, {
    // 使用小尺寸类型，在终端中更紧凑
    type: 'terminal',
    // 最小纠错级别，生成更小的二维码
    errorCorrectionLevel: 'L',
    // 小尺寸模式
    small: true,
  })
}

/**
 * 生成 Base64 编码的二维码图片
 *
 * 将 URL 转换为 PNG 格式的二维码图片，并编码为 Base64 字符串。
 * 返回的字符串包含 data URI 前缀（data:image/png;base64,...），
 * 可以直接用于 HTML img 标签或通知消息的图片字段。
 *
 * @param url - 要编码的 URL 地址
 * @returns Base64 编码的二维码图片（含 data URI 前缀）
 *
 * @example
 * ```typescript
 * const base64 = await generateBase64QRCode('https://example.com')
 * // 'data:image/png;base64,iVBORw0KGgo...'
 * ```
 */
export async function generateBase64QRCode(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    // 中等纠错级别，平衡图片大小和可靠性
    errorCorrectionLevel: 'M',
    // 图片边距（模块数）
    margin: 2,
    // 图片宽度（像素）
    width: 256,
  })
}
