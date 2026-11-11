// noop provider —— 未配置任何供应商时的空实现。
//
// 复用 @openstarter/analytics/runtime 的 noop（三端同一份），只补移动端契约扩展
// setUserId —— 这样「永不抛错」的空实现只有一处来源，不会三端各写一版。

import { createNoopProvider as createBaseNoopProvider } from "@openstarter/analytics/runtime";

import type { MobileAnalyticsProvider } from "../../internal/types";

export function createNoopProvider(): MobileAnalyticsProvider {
  return {
    ...createBaseNoopProvider(),
    async init(): Promise<void> {},
    async setUserId(): Promise<void> {},
  };
}
