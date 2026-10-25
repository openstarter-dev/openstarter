/**
 * 计费结算 + assistant 落库的挂载点。
 *
 * ChatMiddleware 契约：每次运行恰好触发 onFinish / onAbort / onError 之一
 * （types.d.ts「Exactly one of onFinish/onAbort/onError will be called per run」）。
 * 只实现 onFinish 即天然满足 spec §5：正常完成才 settle+落库；客户端断开/
 * stop 触发 onAbort、流错误触发 onError，二者均保留预扣。FinishInfo 直接携带
 * 最终文本（info.content）与用量（info.usage?.totalTokens），无需自建流包装。
 *
 * 副作用异常一律在此吞掉并交由 onFinished 内部记 warn —— 绝不 rethrow，
 * 避免破坏已产出的响应流。
 */

import type { ChatMiddleware } from "@tanstack/ai";

export function createBillingMiddleware(deps: {
  onFinished: (result: { text: string; totalTokens: number | undefined }) => Promise<void>;
}): ChatMiddleware {
  return {
    name: "billing-settle-persist",
    async onFinish(_ctx, info) {
      try {
        await deps.onFinished({
          text: info.content,
          totalTokens: info.usage?.totalTokens,
        });
      } catch {
        // onFinished 内部已 warn；此处为兜底，保证中间件永不抛错。
      }
    },
  };
}
