import { Provider as StrategyProvider, useCustomer } from "@openstarter/billing-mobile";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { authClient } from "./auth-client";

/** 客户信息变化需要刷新的查询缓存（账单三屏 + 方案徽章）。 */
const BILLING_QUERY_KEYS: ReadonlySet<string> = new Set([
  "user-plan",
  "user-subscription",
  "user-credits",
  "user-orders",
]);

/** 按 queryKey 首段失效账单查询（["user-orders", page] 这类带参键一并命中）。 */
function invalidateBillingQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  for (const key of BILLING_QUERY_KEYS) {
    void queryClient.invalidateQueries({ queryKey: [key] });
  }
}

/**
 * 会话联动决策：isPending 期间不动（避免把读会话中间态当成登出），
 * 有 userId → identify，否则 → reset。纯函数便于单测；BillingLifecycle 内消费。
 */
export function resolveLifecycleAction(input: {
  isPending: boolean;
  userId?: string | null;
}): "identify" | "reset" | null {
  if (input.isPending) {
    return null;
  }
  return input.userId ? "identify" : "reset";
}

function BillingLifecycle() {
  const { identify, reset, addCustomerInfoListener } = useCustomer();
  const queryClient = useQueryClient();
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    const action = resolveLifecycleAction({ isPending, userId });
    if (action === "identify") {
      if (userId) {
        identify(userId);
      }
    } else if (action === "reset") {
      reset();
    }
  }, [isPending, userId, identify, reset]);

  useEffect(
    () => addCustomerInfoListener(() => invalidateBillingQueries(queryClient)),
    [addCustomerInfoListener, queryClient],
  );

  return null;
}

export function BillingProvider({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale?: string;
}) {
  return (
    <StrategyProvider locale={locale}>
      <BillingLifecycle />
      {children}
    </StrategyProvider>
  );
}
