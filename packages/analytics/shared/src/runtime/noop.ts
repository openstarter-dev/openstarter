// noop 策略 —— 未配置任何供应商时的空实现。
//
// 让消费方无需判空：facade 恒返回可用对象，业务代码不必区分「已配置/未配置」，
// 也就不会在各处散落 `if (analytics)` 分支。

import type { AnalyticsProvider } from "../types";

export function createNoopProvider(): AnalyticsProvider {
  return {
    async identify() {},
    name: "noop",
    async reset() {},
    async setScreenName() {},
    async track() {},
  };
}
