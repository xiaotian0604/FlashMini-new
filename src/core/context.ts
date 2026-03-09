/**
 * 上下文对象（Context）
 *
 * Context 是贯穿整个上传生命周期的核心数据载体。
 * 从配置加载到上传完成，所有模块都通过 Context 共享状态，
 * 避免使用全局变量，确保数据流向清晰可追踪。
 *
 * Context 的生命周期：
 * 1. Runner.run() 创建 Context 实例
 * 2. 解析版本号、描述、git 信息，写入 Context
 * 3. 插件通过钩子读写 Context（如 beforeAll 钩子修改描述）
 * 4. 各平台上传器读取 Context 获取版本号等信息
 * 5. 上传结果写入 Context.results
 * 6. 通知系统读取 Context 生成通知消息
 * 7. CLI 层读取 Context 输出结果汇总
 *
 * 设计模式：上下文对象模式（Context Object Pattern）
 * 优势：替代全局变量，数据流向明确，便于测试和调试
 */

import type { FlashminiConfig } from '../types/config'
import type { UploadResult } from '../types/platform'

/**
 * 上传生命周期上下文
 *
 * 包含配置信息、运行时状态、上传结果等所有流程数据。
 * 插件可以通过 extra 字段存储自定义数据。
 */
export class Context {
  /** 经过 Zod 校验的完整配置对象（只读，运行时不可修改配置） */
  readonly config: FlashminiConfig

  /** 当前运行环境标识（如 'dev'、'test'、'prod'） */
  readonly env: string

  /** 流程开始的时间戳（毫秒），用于计算总耗时 */
  readonly startTime: number

  // ─── 运行时填充的数据（由 Runner 在流程中逐步填充） ────────────

  /** 最终使用的版本号（可能来自配置、package.json 或 CLI 参数） */
  version: string = ''

  /** 最终使用的上传描述（可能来自配置、git commit 或 CLI 参数） */
  description: string = ''

  /** 当前 git 分支名称 */
  gitBranch: string = ''

  /** 当前 git commit 的完整哈希值 */
  gitCommit: string = ''

  /** 最近的 git commit 日志列表（用于通知消息中的变更日志） */
  changelog: string[] = []

  /** 所有平台的上传结果列表（按完成顺序排列） */
  results: UploadResult[] = []

  // ─── 插件扩展数据 ──────────────────────────────────────────────

  /**
   * 插件可写入的自定义数据存储
   *
   * 插件可以在此对象上存储任意数据，供其他插件或后续流程使用。
   * 使用 Record<string, unknown> 类型，插件需自行进行类型断言。
   *
   * @example
   * ```typescript
   * // 在 beforeAll 钩子中写入
   * ctx.extra.buildTime = Date.now()
   * // 在 afterAll 钩子中读取
   * const buildTime = ctx.extra.buildTime as number
   * ```
   */
  extra: Record<string, unknown> = {}

  /**
   * 创建上下文实例
   *
   * @param config - 经过 Zod 校验的完整配置对象
   * @param env - 运行环境标识
   */
  constructor(config: FlashminiConfig, env: string) {
    this.config = config
    this.env = env
    this.startTime = Date.now()
  }

  /**
   * 获取从流程开始到当前的总耗时（毫秒）
   *
   * 这是一个计算属性，每次访问都会重新计算。
   * 用于在结果汇总和通知消息中展示总耗时。
   */
  get duration(): number {
    return Date.now() - this.startTime
  }

  /**
   * 获取上传成功的平台数量
   *
   * 遍历 results 数组，统计 success 为 true 的结果数量。
   */
  get successCount(): number {
    return this.results.filter(r => r.success).length
  }

  /**
   * 获取上传失败的平台名称列表
   *
   * 用于判断是否有失败的平台，以及在通知消息中展示失败信息。
   */
  get failedPlatforms(): string[] {
    return this.results.filter(r => !r.success).map(r => r.platform)
  }

  /**
   * 获取上传成功的平台名称列表
   *
   * 用于在通知消息中展示成功的平台信息。
   */
  get successPlatforms(): string[] {
    return this.results.filter(r => r.success).map(r => r.platform)
  }

  /**
   * 判断是否所有平台都上传成功
   */
  get isAllSuccess(): boolean {
    return this.results.length > 0 && this.results.every(r => r.success)
  }
}
