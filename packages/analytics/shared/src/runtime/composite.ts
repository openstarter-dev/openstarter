// composite 策略 —— 多个供应商同时启用时的转发聚合。
//
// 串行 `for…of` 而非 `Promise.all`：各供应商的队列彼此独立，串行保证调用顺序稳定
// （测试断言不受调度影响），且单个 provider 的错误已被自身边界消化，不会中断后续转发。

import type { AnalyticsProvider } from "../types";

export function createCompositeProvider(
  providers: readonly AnalyticsProvider[],
): AnalyticsProvider {
  const forward = async (
    action: (provider: AnalyticsProvider) => Promise<void>,
  ): Promise<void> => {
    for (const provider of providers) {
      await action(provider);
    }
  };

  return {
    identify: (profileId, traits) => forward((p) => p.identify(profileId, traits)),
    async init() {
      for (const provider of providers) {
        await provider.init?.();
      }
    },
    name: "composite",
    reset: () => forward((p) => p.reset()),
    setScreenName: (name, params) => forward((p) => p.setScreenName(name, params)),
    track: (event, properties) => forward((p) => p.track(event, properties)),
  };
}
