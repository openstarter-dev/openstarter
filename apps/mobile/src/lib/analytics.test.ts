// apps/mobile 分析薄壳测试：env → 配置解析转发 + useScreenTracking 纯路径。
// mobile 无 @testing-library/react，hook 不渲染组件 —— useScreenTracking
// 的转发语义已由包内门面测试覆盖，此处验证模块导出完整性 + env 解析
// 转发语义（app 侧真正的接线点）。

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-router", () => ({
  usePathname: vi.fn(() => "/"),
}));

vi.mock("@openstarter/analytics-mobile", () => ({
  configureAnalyticsErrors: vi.fn(),
  initAnalytics: vi.fn(async () => ({
    identify: async () => undefined,
    init: async () => undefined,
    name: "noop",
    setScreenName: async () => undefined,
    setUserId: async () => undefined,
    track: async () => undefined,
  })),
  resolveMobileAnalyticsConfig: vi.fn(() => ({
    gaMobileEnabled: false,
    openpanelClientId: "",
    openpanelClientSecret: "",
  })),
  setScreenName: vi.fn(async () => undefined),
}));

import { initAnalyticsFromEnv, useScreenTracking } from "./analytics";
import {
  initAnalytics,
  resolveMobileAnalyticsConfig as resolveConfig,
} from "@openstarter/analytics-mobile";

const mockedInitAnalytics = vi.mocked(initAnalytics);
const mockedResolveConfig = vi.mocked(resolveConfig);

afterEach(() => {
  vi.clearAllMocks();
});

describe("module exports", () => {
  it("exposes the app-side analytics surface", () => {
    expect(typeof initAnalyticsFromEnv).toBe("function");
    expect(typeof useScreenTracking).toBe("function");
  });
});

describe("initAnalyticsFromEnv", () => {
  it("resolves config from process.env and initializes the facade with it", async () => {
    process.env.EXPO_PUBLIC_ANALYTICS_GA_ENABLED = "true";
    process.env.EXPO_PUBLIC_ANALYTICS_OPENPANEL_CLIENT_ID = "op-client";
    process.env.EXPO_PUBLIC_ANALYTICS_OPENPANEL_CLIENT_SECRET = "op-secret";

    await initAnalyticsFromEnv();

    expect(mockedResolveConfig).toHaveBeenCalledWith(process.env);
    expect(mockedInitAnalytics).toHaveBeenCalledWith({
      gaMobileEnabled: false, // mocked resolver's canned return
      openpanelClientId: "",
      openpanelClientSecret: "",
    });
  });

  it("still initializes (facade decides noop) when env is empty", async () => {
    delete process.env.EXPO_PUBLIC_ANALYTICS_GA_ENABLED;
    delete process.env.EXPO_PUBLIC_ANALYTICS_OPENPANEL_CLIENT_ID;
    delete process.env.EXPO_PUBLIC_ANALYTICS_OPENPANEL_CLIENT_SECRET;

    await expect(initAnalyticsFromEnv()).resolves.toBeUndefined();
    expect(mockedInitAnalytics).toHaveBeenCalledTimes(1);
  });
});
