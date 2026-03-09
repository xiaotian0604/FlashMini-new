/**
 * 重试工具函数
 *
 * 提供带指数退避（Exponential Backoff）的重试机制。
 * 在网络不稳定的 CI/CD 环境中，上传操作可能因网络波动而失败，
 * 通过自动重试可以显著提高上传的成功率。
 *
 * 指数退避策略：
 * - 第 1 次重试：等待 delay * 1 毫秒
 * - 第 2 次重试：等待 delay * 2 毫秒
 * - 第 N 次重试：等待 delay * N 毫秒
 *
 * 这样设计的好处是：
 * 1. 给服务端足够的恢复时间
 * 2. 避免短时间内大量重试导致服务端压力更大
 */

/**
 * 休眠指定时间
 *
 * 将 setTimeout 封装为 Promise，便于在 async/await 中使用。
 *
 * @param ms - 休眠时间（毫秒）
 * @returns 在指定时间后 resolve 的 Promise
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 带指数退避的重试函数
 *
 * 执行给定的异步函数，如果失败则按照指数退避策略进行重试。
 * 当所有重试次数用尽后，抛出最后一次的错误。
 *
 * @typeParam T - 异步函数的返回值类型
 * @param fn - 要执行的异步函数
 * @param times - 最大重试次数（0 表示不重试，只执行一次）
 * @param delay - 基础重试间隔（毫秒），实际间隔 = delay * 当前重试次数
 * @returns 异步函数的返回值
 * @throws 当所有重试次数用尽后，抛出最后一次执行的错误
 *
 * @example
 * ```typescript
 * // 最多重试 3 次，基础间隔 2000ms
 * // 实际等待：2000ms → 4000ms → 6000ms
 * const result = await retry(
 *   () => uploadToWechat(project),
 *   3,
 *   2000,
 * )
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  times: number,
  delay: number,
): Promise<T> {
  /** 保存最后一次错误，用于在所有重试失败后抛出 */
  let lastError: Error

  // i = 0 是首次执行，i > 0 是重试
  for (let i = 0; i <= times; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err as Error

      // 还有重试机会，等待后继续
      if (i < times) {
        // 指数退避：每次重试的等待时间递增
        const waitTime = delay * (i + 1)
        console.warn(`第 ${i + 1} 次重试，等待 ${waitTime}ms...`)
        await sleep(waitTime)
      }
    }
  }

  // 所有重试次数用尽，抛出最后一次错误
  throw lastError!
}
