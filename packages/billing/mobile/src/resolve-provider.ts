// Provider 选择器（spec §3）：EXPO_PUBLIC_BILLING_PROVIDER → BillingProvider。
// 纯函数 + 全量入参（不直读 process.env），便于单测；strategy.ts 负责传入。
// 非法值抛错（fail-fast）：配置错误必须立刻暴露，而不是运行到支付环节才炸。
import { BillingProvider } from "./providers/types";

const VALID_VALUES = Object.values(BillingProvider) as readonly string[];

export function resolveBillingProvider(env: Record<string, string | undefined>): BillingProvider {
  const raw = env.EXPO_PUBLIC_BILLING_PROVIDER?.trim();

  if (!raw) {
    // 未设置 = 默认 revenuecat：零配置可用，与既有部署兼容。
    return BillingProvider.REVENUECAT;
  }

  const match = VALID_VALUES.find((value) => value === raw);
  if (!match) {
    throw new Error(
      `EXPO_PUBLIC_BILLING_PROVIDER "${raw}" is invalid. Valid values: ${VALID_VALUES.join(" | ")}`,
    );
  }

  return match as BillingProvider;
}
