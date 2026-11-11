// 门面测试：provider 选择/组合/降级、预 init no-op、幂等。
// 两个 SDK 的 provider 工厂均以 vi.mock 替身注入，避免触真实模块。

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MobileAnalyticsProvider } from "./internal/types";

// —— mock provider 工厂 ——
const makeFakeProvider = (name: MobileAnalyticsProvider["name"]): MobileAnalyticsProvider => ({
  identify: vi.fn(),
  init: vi.fn(),
  name,
  reset: vi.fn(),
  setScreenName: vi.fn(),
  setUserId: vi.fn(),
  track: vi.fn(),
});

const mockOpenPanelProvider = makeFakeProvider("openpanel");
const mockFirebaseProvider = makeFakeProvider("firebase");

vi.mock("./providers/openpanel", () => ({
  createOpenPanelProvider: vi.fn(async () => mockOpenPanelProvider),
}));
vi.mock("./providers/firebase", () => ({
  createFirebaseProvider: vi.fn(async () => mockFirebaseProvider),
}));

import {
  identify,
  initAnalytics,
  reset,
  resetAnalyticsForTests,
  setScreenName,
  setUserId,
  track,
} from "./facade";
import { createOpenPanelProvider } from "./providers/openpanel";
import { createFirebaseProvider } from "./providers/firebase";

const fullConfig = {
  gaMobileEnabled: true,
  openpanelClientId: "op-client",
  openpanelClientSecret: "op-secret",
};

describe("initAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAnalyticsForTests();
  });

  it("returns noop provider and creates nothing when config is empty", async () => {
    const provider = await initAnalytics({
      gaMobileEnabled: false,
      openpanelClientId: "",
      openpanelClientSecret: "",
    });

    expect(provider.name).toBe("noop");
    expect(createOpenPanelProvider).not.toHaveBeenCalled();
    expect(createFirebaseProvider).not.toHaveBeenCalled();
  });

  it("creates only OpenPanel when only OP keys are set", async () => {
    const provider = await initAnalytics({
      gaMobileEnabled: false,
      openpanelClientId: "op-client",
      openpanelClientSecret: "op-secret",
    });

    expect(provider.name).toBe("openpanel");
    expect(createFirebaseProvider).not.toHaveBeenCalled();
  });

  it("creates only Firebase when gaMobileEnabled without OP keys", async () => {
    const provider = await initAnalytics({
      gaMobileEnabled: true,
      openpanelClientId: "",
      openpanelClientSecret: "",
    });

    expect(provider.name).toBe("firebase");
    expect(createOpenPanelProvider).not.toHaveBeenCalled();
  });

  it("composes both providers when both are configured", async () => {
    const provider = await initAnalytics(fullConfig);

    expect(createOpenPanelProvider).toHaveBeenCalledTimes(1);
    expect(createFirebaseProvider).toHaveBeenCalledTimes(1);
    // composite 转发：一次 track 双写
    await provider.track("e");
    expect(mockOpenPanelProvider.track).toHaveBeenCalledWith("e", undefined);
    expect(mockFirebaseProvider.track).toHaveBeenCalledWith("e", undefined);
  });

  it("skips a provider whose factory throws and warns once", async () => {
    vi.mocked(createOpenPanelProvider).mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const provider = await initAnalytics(fullConfig);

    expect(provider.name).toBe("firebase");
    expect(console.warn).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it("is idempotent: second init returns the same instance without re-creating", async () => {
    const first = await initAnalytics(fullConfig);
    const second = await initAnalytics(fullConfig);

    expect(second).toBe(first);
    expect(createOpenPanelProvider).toHaveBeenCalledTimes(1);
    expect(createFirebaseProvider).toHaveBeenCalledTimes(1);
  });

  it("convenience forwarders are safe no-ops before init", async () => {
    await expect(track("e")).resolves.toBeUndefined();
    await expect(identify("u")).resolves.toBeUndefined();
    await expect(reset()).resolves.toBeUndefined();
    await expect(setUserId("u")).resolves.toBeUndefined();
    await expect(setScreenName("/")).resolves.toBeUndefined();
    // 未 init：任何工厂都不该被创建
    expect(createOpenPanelProvider).not.toHaveBeenCalled();
    expect(createFirebaseProvider).not.toHaveBeenCalled();
  });

  it("convenience forwarders reach the active provider after init", async () => {
    await initAnalytics(fullConfig);

    await track("event", { a: 1 });
    await identify("user-1", { plan: "pro" });
    await setUserId("user-1");
    await setScreenName("/home");
    await reset();

    expect(mockOpenPanelProvider.track).toHaveBeenCalledWith("event", { a: 1 });
    expect(mockOpenPanelProvider.identify).toHaveBeenCalledWith("user-1", {
      plan: "pro",
    });
    expect(mockOpenPanelProvider.setUserId).toHaveBeenCalledWith("user-1");
    expect(mockOpenPanelProvider.setScreenName).toHaveBeenCalledWith("/home", undefined);
    expect(mockOpenPanelProvider.reset).toHaveBeenCalledTimes(1);
    expect(mockFirebaseProvider.reset).toHaveBeenCalledTimes(1);
    // composite 双写同步落到 firebase
    expect(mockFirebaseProvider.track).toHaveBeenCalledWith("event", { a: 1 });
  });
});
