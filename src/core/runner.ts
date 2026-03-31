/**
 * 主流程编排器（Runner）
 *
 * Runner 是 Flashmini 的核心调度模块，负责编排整个上传流程。
 * 它将配置读取、插件加载、平台上传、通知发送等步骤串联起来，
 * 形成一个完整的上传生命周期。
 *
 * 完整的执行流程：
 *
 * ┌─────────────────────────────────────────────┐
 * │ 1. 加载插件，注册钩子                        │
 * │ 2. 解析版本号和描述                          │
 * │ 3. 读取 git 信息（分支、commit、changelog）   │
 * │ 4. 执行 beforeAll 钩子                       │
 * │ 5. 获取启用的平台列表                        │
 * │ 6. 并行或串行上传各平台                      │
 * │    ├─ beforeUpload 钩子                      │
 * │    ├─ 执行上传（带重试）                     │
 * │    └─ afterUpload 钩子                       │
 * │ 7. 执行 afterAll 钩子                        │
 * │ 8. 发送通知                                  │
 * └─────────────────────────────────────────────┘
 *
 * 设计原则：
 * - Runner 本身不包含任何平台特定的逻辑
 * - 所有平台逻辑都委托给策略层（platforms/）
 * - 所有扩展逻辑都通过插件系统注入
 * - Runner 只负责流程编排和错误处理
 */

import type { FlashminiConfig } from '../types/config'
import type { UploadResult } from '../types/platform'
import { Context } from './context'
import { HookManager } from '../plugins/hook-manager'
import { loadPlugins } from '../plugins/plugin-loader'
import { PlatformFactory } from '../platforms/factory'
import { sendNotifications } from '../notifiers/factory'
import { retry } from '../utils/retry'
import { getGitBranch, getGitCommit, getGitLog } from '../utils/git'
import { resolveVersion, resolveDescription } from '../utils/env'
import { dirname } from 'path'
import { resolveEnabledPlatforms } from './platform-selection'

/**
 * Runner 运行选项
 *
 * 由 CLI 命令或 Node.js API 调用时传入，
 * 用于覆盖配置文件中的部分设置。
 */
export interface RunOptions {
  /** 运行环境标识（如 'dev'、'test'、'prod'） */
  env: string
  /** 指定要上传的平台列表（覆盖配置文件中的 enabled 设置） */
  platforms?: string[]
  /** 试运行模式，不实际执行上传 */
  dryRun?: boolean
}

/**
 * 主流程编排器
 *
 * 接收配置对象，编排整个上传流程。
 * 每次上传创建一个新的 Runner 实例。
 *
 * @example
 * ```typescript
 * const runner = new Runner(config)
 * const ctx = await runner.run({ env: 'prod' })
 * console.log(ctx.results) // 上传结果
 * ```
 */
export class Runner {
  /** 钩子管理器，管理所有插件注册的生命周期钩子 */
  private hookManager: HookManager

  /** 经过校验的完整配置对象 */
  private config: FlashminiConfig

  /** 配置文件所在目录，用于解析相对插件路径 */
  private readonly configDir: string

  /**
   * @param config - 经过 Zod 校验的完整配置对象
   */
  constructor(
    config: FlashminiConfig,
    options: { configFilepath?: string } = {},
  ) {
    this.config = config
    this.hookManager = new HookManager()
    this.configDir = options.configFilepath
      ? dirname(options.configFilepath)
      : process.cwd()
  }

  /**
   * 执行完整的上传流程
   *
   * 这是 Runner 的核心方法，按照预定义的生命周期顺序执行所有步骤。
   * 返回的 Context 对象包含所有上传结果和运行时数据。
   *
   * @param options - 运行选项（环境、平台过滤、试运行等）
   * @returns 包含所有上传结果的 Context 对象
   */
  async run(options: RunOptions): Promise<Context> {
    // 创建上下文对象，贯穿整个流程
    const ctx = new Context(this.config, options.env)

    // ─── 步骤 1：加载插件，注册钩子 ─────────────────────────────
    await loadPlugins(this.config.plugins, this.hookManager, this.configDir)

    // ─── 步骤 2：解析版本号和描述 ───────────────────────────────
    ctx.version = await resolveVersion(this.config.version)
    ctx.description = await resolveDescription(this.config.description)

    // ─── 步骤 3：读取 git 信息 ──────────────────────────────────
    ctx.gitBranch = await getGitBranch()
    ctx.gitCommit = await getGitCommit()
    ctx.changelog = await getGitLog(5)

    // ─── 步骤 4：执行 beforeAll 钩子 ────────────────────────────
    // 插件可以在此修改 ctx 的属性（如动态修改版本号、描述等）
    await this.hookManager.call('beforeAll', ctx)

    // ─── 步骤 5：获取启用的平台列表 ─────────────────────────────
    const enabledPlatforms = this.getEnabledPlatforms(options.platforms)

    // ─── 步骤 6：执行上传（并行或串行） ─────────────────────────
    if (!options.dryRun) {
      if (this.config.options.parallel) {
        await this.uploadParallel(enabledPlatforms, ctx)
      } else {
        await this.uploadSerial(enabledPlatforms, ctx)
      }
    }

    // ─── 步骤 7：执行 afterAll 钩子 ─────────────────────────────
    await this.hookManager.call('afterAll', ctx)

    // ─── 步骤 8：发送通知 ───────────────────────────────────────
    if (ctx.successCount > 0 || this.config.options.continueOnError) {
      await sendNotifications(this.config.notify, ctx, this.hookManager)
    }

    return ctx
  }

  /**
   * 上传单个平台
   *
   * 为指定平台创建上传器实例，执行上传操作（带重试机制）。
   * 在上传前后分别触发 beforeUpload 和 afterUpload 钩子。
   *
   * @param platformName - 平台名称
   * @param ctx - 上传上下文
   */
  private async uploadOne(platformName: string, ctx: Context): Promise<void> {
    // 通过工厂创建对应平台的上传器
    const platformConfig = (this.config.platforms as any)[platformName]
    const uploader = PlatformFactory.create(platformName, platformConfig)

    // 触发 beforeUpload 钩子
    await this.hookManager.call('beforeUpload', ctx, platformName)

    try {
      // 执行上传，带重试机制
      const result = await retry(
        () => uploader.upload(ctx),
        this.config.options.retry,
        this.config.options.retryDelay,
      )

      // 将结果存入上下文
      ctx.results.push(result)

      // 触发 afterUpload 钩子
      await this.hookManager.call('afterUpload', ctx, result)
    } catch (err) {
      // 上传失败，记录失败结果
      const failResult: UploadResult = {
        platform: platformName,
        success: false,
        error: err as Error,
        version: ctx.version,
        duration: 0,
      }
      ctx.results.push(failResult)

      // 触发 afterUpload 钩子（无论成功或失败都应触发，与钩子文档一致）
      await this.hookManager.call('afterUpload', ctx, failResult)

      // 触发 onError 钩子
      await this.hookManager.call('onError', ctx, err as Error, platformName)

      // 如果不允许继续上传其他平台，重新抛出错误
      if (!this.config.options.continueOnError) {
        throw err
      }
    }
  }

  /**
   * 并行上传所有平台
   *
   * 使用 Promise.all 同时启动所有平台的上传任务。
   * 如果 continueOnError 为 true，单个平台失败不会中断其他平台。
   *
   * @param platforms - 要上传的平台名称列表
   * @param ctx - 上传上下文
   */
  private async uploadParallel(platforms: string[], ctx: Context): Promise<void> {
    const tasks = platforms.map(p =>
      this.uploadOne(p, ctx).catch(err => {
        // continueOnError 为 false 时，uploadOne 已经 throw 了
        // 这里的 catch 只处理 continueOnError 为 true 的情况
        if (!this.config.options.continueOnError) {
          throw err
        }
      }),
    )
    await Promise.all(tasks)
  }

  /**
   * 串行上传所有平台
   *
   * 按顺序依次上传每个平台，前一个完成后才开始下一个。
   * 适用于需要严格控制上传顺序的场景。
   *
   * @param platforms - 要上传的平台名称列表
   * @param ctx - 上传上下文
   */
  private async uploadSerial(platforms: string[], ctx: Context): Promise<void> {
    for (const platform of platforms) {
      await this.uploadOne(platform, ctx)
    }
  }

  /**
   * 获取启用的平台列表
   *
   * 根据配置文件中各平台的 enabled 字段和 CLI 参数中的平台过滤，
   * 确定最终需要上传的平台列表。
   *
   * 优先级：CLI --platform 参数 > 配置文件 enabled 字段
   *
   * @param cliPlatforms - CLI 参数中指定的平台列表（可选）
   * @returns 最终启用的平台名称数组
   */
  private getEnabledPlatforms(cliPlatforms?: string[]): string[] {
    return resolveEnabledPlatforms(this.config, cliPlatforms)
  }
}
