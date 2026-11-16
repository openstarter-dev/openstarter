// Provider 注册表（spec §3）：唯一切换点。新增供应商 = 新建 provider 目录 +
// 此处一行；业务侧（apps/mobile）零改动。loader 惰性 require 各策略模块：
// bundle 里两个子树都在（备胎随时可切），但只有被选中的 provider 在运行期
// 求值——未选中方不 configure、不挂载 Provider；其顶层原生模块缺失（Expo Go
// 的 requireNativeModule 抛错）也只影响被选中的场景，捕获后降级（spec §6）。
import { createDegradedStrategy } from "./degraded";
import { resolveBillingProvider } from "./resolve-provider";

import { BillingProvider } from "./providers/types";
import type { BillingProviderClientStrategy } from "./providers/types";

const LOADERS: Record<BillingProvider, () => BillingProviderClientStrategy> = {
  [BillingProvider.REVENUECAT]: () =>
    require("./providers/revenuecat").strategy as BillingProviderClientStrategy,
  [BillingProvider.SUPERWALL]: () =>
    require("./providers/superwall").strategy as BillingProviderClientStrategy,
};

function loadStrategy(provider: BillingProvider): BillingProviderClientStrategy {
  try {
    return LOADERS[provider]();
  } catch (error) {
    if (__DEV__) {
      console.warn(`[billing] provider "${provider}" failed to load, degraded to no-op`, error);
    }
    return createDegradedStrategy(provider);
  }
}

export const strategy: BillingProviderClientStrategy = loadStrategy(
  resolveBillingProvider(process.env),
);
