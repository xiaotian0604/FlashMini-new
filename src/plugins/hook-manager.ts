/**
 * 钩子管理器（HookManager）
 *
 * 这是 Flashmini 插件系统的核心，参考了 Webpack 的 Tapable 库设计，
 * 但做了大幅简化以保持轻量（Tapable 本身依赖 webpack，引入会带入大量不必要依赖）。
 *
 * 核心功能：
 * 1. tap(hookName, fn) — 注册钩子回调（插件调用）
 * 2. call(hookName, ...args) — 串行执行所有回调（Runner 调用）
 * 3. waterfall(hookName, initial, ...args) — 瀑布流执行（每个回调的返回值传给下一个）
 *
 * 设计模式：观察者模式（Observer Pattern）
 * - HookManager 是被观察者（Subject），维护钩子回调列表
 * - 插件是观察者（Observer），通过 tap() 注册回调
 * - Runner 在适当的时机调用 call() 通知所有观察者
 *
 * 与 Tapable 的区别：
 * - 不区分 SyncHook / AsyncSeriesHook 等类型，统一使用 async
 * - 不支持 tapAsync / tapPromise 等多种注册方式，只有 tap
 * - 不支持 bail / loop 等高级钩子类型
 * - 代码量从 Tapable 的数千行精简到不足百行
 */

import { HOOK_NAMES } from './hooks'

/**
 * 钩子回调函数类型
 *
 * 使用宽泛的类型签名，因为不同钩子的参数和返回值不同。
 * 类型安全由 Hooks 接口在插件开发时保证。
 */
type HookFn = (...args: any[]) => any | Promise<any>

/**
 * 钩子管理器
 *
 * 管理所有生命周期钩子的注册和执行。
 * 每个 Runner 实例持有一个 HookManager 实例，
 * 插件通过 apply(hookManager) 方法注册钩子回调。
 *
 * @example
 * ```typescript
 * const hookManager = new HookManager()
 *
 * // 插件注册钩子
 * hookManager.tap('beforeAll', async (ctx) => {
 *   console.log('上传即将开始')
 * })
 *
 * // Runner 在适当时机调用钩子
 * await hookManager.call('beforeAll', ctx)
 * ```
 */
export class HookManager {
  /**
   * 钩子回调存储
   *
   * 使用 Map 结构，key 为钩子名称，value 为回调函数数组。
   * 同一个钩子可以注册多个回调，按注册顺序串行执行。
   */
  private hooks: Map<string, HookFn[]> = new Map()

  /**
   * 注册钩子回调
   *
   * 插件通过此方法在指定的生命周期钩子上注册回调函数。
   * 同一个钩子可以被多个插件注册多个回调，按注册顺序执行。
   *
   * @param hookName - 钩子名称（必须是 Hooks 接口中定义的合法名称）
   * @param fn - 回调函数（可以是同步或异步函数）
   * @throws 当钩子名称不合法时在控制台输出警告
   *
   * @example
   * ```typescript
   * // 注册 beforeUpload 钩子
   * hookManager.tap('beforeUpload', (ctx, platform) => {
   *   console.log(`即将上传到 ${platform}`)
   * })
   * ```
   */
  tap(hookName: string, fn: HookFn): void {
    // 校验钩子名称是否合法
    if (!HOOK_NAMES.includes(hookName as any)) {
      console.warn(`[flashmini] 警告: 未知的钩子名称 "${hookName}"，可用钩子: ${HOOK_NAMES.join(', ')}`)
    }

    // 如果该钩子还没有回调列表，先创建空数组
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, [])
    }

    // 将回调函数追加到列表末尾
    this.hooks.get(hookName)!.push(fn)
  }

  /**
   * 串行执行钩子的所有回调
   *
   * 按注册顺序依次执行所有回调函数，每个回调执行完毕后才执行下一个。
   * 如果某个回调抛出异常，后续回调不会执行，异常会向上传播。
   *
   * 适用于：beforeAll、beforeUpload、afterUpload、afterAll、onError
   *
   * @param hookName - 要执行的钩子名称
   * @param args - 传递给回调函数的参数
   *
   * @example
   * ```typescript
   * // 执行 beforeAll 钩子，传入 Context 对象
   * await hookManager.call('beforeAll', ctx)
   *
   * // 执行 beforeUpload 钩子，传入 Context 和平台名称
   * await hookManager.call('beforeUpload', ctx, 'wechat')
   * ```
   */
  async call(hookName: string, ...args: any[]): Promise<void> {
    // 获取该钩子的所有回调，没有注册则返回空数组
    const fns = this.hooks.get(hookName) ?? []

    // 串行执行每个回调
    for (const fn of fns) {
      await fn(...args)
    }
  }

  /**
   * 瀑布流执行钩子
   *
   * 与 call() 不同，waterfall 会将每个回调的返回值传递给下一个回调。
   * 如果某个回调返回 undefined/null，则保持上一个回调的返回值不变。
   * 最终返回最后一个回调的返回值。
   *
   * 适用于：beforeNotify（允许插件链式修改通知消息内容）
   *
   * @typeParam T - 瀑布流传递的值类型
   * @param hookName - 要执行的钩子名称
   * @param initial - 初始值（传递给第一个回调）
   * @param args - 额外参数（传递给每个回调）
   * @returns 经过所有回调处理后的最终值
   *
   * @example
   * ```typescript
   * // 初始通知消息经过多个插件的修改
   * const finalMessage = await hookManager.waterfall('beforeNotify', initialMessage, ctx)
   * ```
   */
  async waterfall<T>(hookName: string, initial: T, ...args: any[]): Promise<T> {
    const fns = this.hooks.get(hookName) ?? []
    let value = initial

    for (const fn of fns) {
      // 如果回调返回了新值则使用新值，否则保持原值
      const result = await fn(value, ...args)
      if (result !== undefined && result !== null) {
        value = result
      }
    }

    return value
  }

  /**
   * 获取指定钩子已注册的回调数量
   *
   * 用于调试和日志输出，了解有多少插件注册了某个钩子。
   *
   * @param hookName - 钩子名称
   * @returns 已注册的回调函数数量
   */
  getHookCount(hookName: string): number {
    return this.hooks.get(hookName)?.length ?? 0
  }

  /**
   * 清空所有已注册的钩子回调
   *
   * 主要用于测试场景，在每个测试用例前重置钩子状态。
   */
  clear(): void {
    this.hooks.clear()
  }
}
