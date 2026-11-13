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
