// 供应商策略模块加载失败时的降级实现（spec §6：抛错被吞 → 不可用）。
// 典型场景：选中 superwall 但原生模块缺失（Expo Go）——require 求值期抛错，
// strategy.ts 捕获后落到这里。所有操作 no-op，isAvailable 恒 false，永不抛错。
import type { ReactNode } from "react";

import { BillingProvider } from "./providers/types";
import { PaywallResult } from "./types";

import type { BillingProviderClientStrategy } from "./providers/types";
import type { PaywallCallbacks } from "./types";

export function createDegradedStrategy(provider: BillingProvider): BillingProviderClientStrategy {
  // 模块级常量保证引用稳定：app 侧 useEffect 以 identify/reset/addCustomerInfoListener
  // 为依赖，身份不稳定会导致效果反复重跑。
  const identify = (): void => {};
  const reset = (): void => {};
  const restore = (): Promise<boolean> => Promise.resolve(false);
  const noopUnsubscribe = (): void => {};
  const addCustomerInfoListener = (): (() => void) => noopUnsubscribe;
  const linkToPortal = (): Promise<void> => Promise.resolve();

  const Provider = ({ children }: { children: ReactNode }): ReactNode => children;

  const useCustomer = () => ({
    customer: null,
    entitlements: [],
    identify,
    reset,
    restore,
    addCustomerInfoListener,
    linkToPortal,
  });

  const usePaywall = (_callbacks?: PaywallCallbacks) => ({
    present: async (): Promise<void> => {
      // 降级态弹墙必失败：走既有 onError 通道（app 侧会退回 billing 屏）。
      _callbacks?.onError?.();
    },
    result: PaywallResult.IDLE,
  });

  return {
    provider,
    Provider,
    isAvailable: () => false,
    useCustomer,
    usePaywall,
  };
}
