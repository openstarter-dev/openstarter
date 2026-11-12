/** 轮询结果：确认 / 窗口耗尽。pending 不是终态，不对外暴露。 */
export type PurchaseConfirmationResult = { status: "confirmed" } | { status: "timeout" };

export interface PurchaseConfirmationOptions {
  /**
   * 时钟（注入以便测试）。生产调用方可省略 —— 默认 Date.now；
   * 收敛由探测次数预算保证，时钟只用于跨过截止时间的提前退出。
   */
  clock?: { now: () => number };
  /** 单次探测：返回 true 表示服务端已反映购买。抛错按"本次未确认"处理。 */
  poll: () => Promise<boolean>;
  /** 轮询间隔，默认 2s。 */
  intervalMs?: number;
  /** 总等待上限，默认 30s（2s × 15 次）。 */
  maxWaitMs?: number;
  /** 间隔等待钩子（生产传 sleep，测试可省 —— 假时钟无需真实等待）。 */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_INTERVAL_MS = 2_000;
const DEFAULT_MAX_WAIT_MS = 30_000;

export async function runPurchaseConfirmation(
  options: PurchaseConfirmationOptions,
): Promise<PurchaseConfirmationResult> {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const sleep = options.sleep ?? (async () => undefined);
  const clock = options.clock ?? { now: () => Date.now() };

  const startedAt = clock.now();
  const maxAttempts = Math.max(1, Math.ceil(maxWaitMs / intervalMs) + 1);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let confirmed = false;
    try {
      confirmed = await options.poll();
    } catch {
      confirmed = false;
    }
    if (confirmed) {
      return { status: "confirmed" };
    }
    const elapsed = clock.now() - startedAt;
    if (elapsed >= maxWaitMs) {
      return { status: "timeout" };
    }
    await sleep(intervalMs);
  }
  return { status: "timeout" };
}
