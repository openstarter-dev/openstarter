import { describe, expect, it, vi } from "vitest";

// 被测对象 use-customer.tsx 是 React hook 且顶层 import RC SDK / react-native
// （node 环境不可解析），全部 mock。本文件只验证 linkToPortal 的 URL 组装与
// store 校验 —— 通过注入 fake React hooks 直接调用 hook 函数体。
const hookState = { current: 0 };

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useCallback: (fn: unknown) => fn,
    useMemo: (factory: () => unknown) => factory(),
  };
});

vi.mock("react-native-purchases", () => ({
  default: {
    showManageSubscriptions: vi.fn().mockResolvedValue(undefined),
    getCustomerInfo: vi.fn(),
    logIn: vi.fn(),
    logOut: vi.fn(),
    isAnonymous: vi.fn(),
    setAttributes: vi.fn(),
    addCustomerInfoUpdateListener: vi.fn(),
    removeCustomerInfoUpdateListener: vi.fn(),
  },
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios", select: (options: Record<string, unknown>) => options.ios },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined }),
}));

vi.mock("expo-linking", () => ({
  openURL: vi.fn().mockResolvedValue(undefined),
}));

import * as Linking from "expo-linking";
import { Platform } from "react-native";
import Purchases from "react-native-purchases";

import { MobileStore } from "../../../constants";
import { useCustomer } from "./use-customer";

const { linkToPortal } = useCustomer();
void hookState;

describe("linkToPortal（管理订阅跳转）", () => {
  it("iOS + APP_STORE → showManageSubscriptions（不走 openURL 深链）", async () => {
    (Platform.OS as string) = "ios";
    await linkToPortal({ store: MobileStore.APP_STORE });
    expect(Purchases.showManageSubscriptions).toHaveBeenCalledTimes(1);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it("Android + PLAY_STORE + variantId → Play Store 订阅页带 ?sku= 参数", async () => {
    (Platform.OS as string) = "android";
    await linkToPortal({
      store: MobileStore.PLAY_STORE,
      variantId: "premium_monthly",
    });
    expect(Linking.openURL).toHaveBeenCalledWith(
      "https://play.google.com/store/account/subscriptions?sku=premium_monthly",
    );
  });

  it("Android + PLAY_STORE 无 variantId → Play Store 订阅页裸链接", async () => {
    (Platform.OS as string) = "android";
    await linkToPortal({ store: MobileStore.PLAY_STORE });
    expect(Linking.openURL).toHaveBeenCalledWith(
      "https://play.google.com/store/account/subscriptions",
    );
  });

  it("非法 store → 抛错且不发起跳转", async () => {
    (Platform.OS as string) = "android";
    vi.mocked(Linking.openURL).mockClear();
    await expect(linkToPortal({ store: "unknown_store" })).rejects.toThrow(
      "Invalid store: unknown_store",
    );
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});
