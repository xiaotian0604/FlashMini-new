/**
 * 默认配置值
 *
 * 定义 Flashmini 配置文件的默认值。
 * 当用户未在配置文件中指定某些字段时，将使用这些默认值。
 *
 * 注意：大部分默认值已在 Zod Schema 中通过 .default() 定义，
 * 本文件主要用于需要在代码中引用默认值的场景（如 init 命令生成模板）。
 */

/**
 * 默认的上传行为选项
 *
 * - parallel: 默认并行上传，提高多平台上传效率
 * - retry: 默认重试 2 次，应对网络波动
 * - retryDelay: 默认 3 秒间隔，配合指数退避策略
 * - continueOnError: 默认某平台失败后停止，确保问题及时暴露
 */
export const DEFAULT_OPTIONS = {
  /** 多平台并行上传 */
  parallel: true,
  /** 失败重试次数 */
  retry: 2,
  /** 重试间隔（毫秒） */
  retryDelay: 3000,
  /** 某平台失败后是否继续其他平台 */
  continueOnError: false,
} as const

/**
 * 默认的版本号策略
 *
 * 'auto' 表示自动从项目的 package.json 中读取 version 字段。
 * 这样用户无需在每次上传时手动指定版本号。
 */
export const DEFAULT_VERSION = 'auto' as const

/**
 * 默认的描述策略
 *
 * 'git' 表示自动读取最近一条 git commit message 作为上传描述。
 * 这样上传备注能自动反映最新的代码变更。
 */
export const DEFAULT_DESCRIPTION = 'git' as const

/**
 * 微信平台默认机器人编号
 *
 * CI 机器人编号范围 1-30，不同编号在微信后台的上传记录中会分开显示。
 * 默认使用 1 号机器人。
 */
export const DEFAULT_WECHAT_ROBOT = 1

/**
 * 配置文件搜索名称
 *
 * Cosmiconfig 会按照此名称自动查找配置文件。
 * 支持的文件格式：.ts / .js / .mjs / .json / package.json 字段
 */
export const CONFIG_MODULE_NAME = 'flashmini'
