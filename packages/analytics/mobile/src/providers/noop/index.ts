// noop provider —— 未配置任何供应商时的空实现。
//
// 门面在「无配置」与「全部门 provider 降级失败」两种情况下返回它，
// 使消费方无需判空：拿到 provider 即可无脑调用。

import type { AnalyticsProvider, EventProperties, UserTraits } from "./types";

export function createNoopProvider(): AnalyticsProvider {
  return {
    async identify(_profileId: string, _traits?: UserTraits): Promise<void> {},
    async init(): Promise<void> {},
    name: "noop",
    async setScreenName(_name: string, _params?: EventProperties): Promise<void> {},
    async setUserId(_userId: string | null): Promise<void> {},
    async track(_event: string, _properties?: EventProperties): Promise<void> {},
  };
}
