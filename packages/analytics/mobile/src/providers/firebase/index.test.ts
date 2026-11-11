// Firebase (GA4) provider 单元测试：mock @react-native-firebase/analytics，
// 验证 GA 事件名 sanitize 与官方 API 映射、失败降级与 warn 去重。

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAnalyticsInstance = {
  logEvent: vi.fn(),
  setUserProperties: vi.fn(),
  setUserId: vi.fn(),
};
vi.mock("@react-native-firebase/analytics", () => ({
  __esModule: true,
  // v23+ 模块化 API：实例取值器是具名导出 getAnalytics（v26 起无 default 导出）。
  getAnalytics: vi.fn(() => mockAnalyticsInstance),
}));

import { createFirebaseProvider, sanitizeGaEventName } from "./firebase";

describe("sanitizeGaEventName", () => {
  it("keeps valid names untouched", () => {
    expect(sanitizeGaEventName("button_clicked")).toBe("button_clicked");
    expect(sanitizeGaEventName("A1_b2")).toBe("A1_b2");
  });

  it("replaces disallowed characters with underscores", () => {
    expect(sanitizeGaEventName("button-clicked")).toBe("button_clicked");
    expect(sanitizeGaEventName("user login!")).toBe("user_login_");
    expect(sanitizeGaEventName("a.b:c")).toBe("a_b_c");
  });

  it("truncates to the 40-character GA cap without dropping the event", () => {
    const long = "a".repeat(50);
    expect(sanitizeGaEventName(long)).toBe("a".repeat(40));
  });
});

describe("createFirebaseProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps track() to logEvent with params", async () => {
    const provider = await createFirebaseProvider();
    await provider.init();
    await provider.track("login", { method: "Google" });

    expect(mockAnalyticsInstance.logEvent).toHaveBeenCalledWith("login", {
      method: "Google",
    });
    expect(provider.name).toBe("firebase");
  });

  it("sanitizes event names before logEvent", async () => {
    const provider = await createFirebaseProvider();
    await provider.init();
    await provider.track("sign-up now");

    expect(mockAnalyticsInstance.logEvent).toHaveBeenCalledWith("sign_up_now", undefined);
  });

  it("maps identify() to setUserProperties with flattened traits", async () => {
    const provider = await createFirebaseProvider();
    await provider.init();
    await provider.identify("user-1", { plan: "pro" });

    expect(mockAnalyticsInstance.setUserProperties).toHaveBeenCalledWith({
      plan: "pro",
    });
  });

  it("maps setUserId(null) to clearing the user id", async () => {
    const provider = await createFirebaseProvider();
    await provider.init();

    await provider.setUserId("user-1");
    expect(mockAnalyticsInstance.setUserId).toHaveBeenLastCalledWith("user-1");

    await provider.setUserId(null);
    expect(mockAnalyticsInstance.setUserId).toHaveBeenLastCalledWith(null);
  });

  it("maps setScreenName() to a screen_view logEvent (extras pass through)", async () => {
    const provider = await createFirebaseProvider();
    await provider.init();
    await provider.setScreenName("/profile", { tab: "credits" });

    // 不走 logScreenView：__DEV__ 下它对 ScreenView 结构外的附加参数会抛错
    // （superstruct 只认 screen_class/screen_name）；logEvent 仅校验事件名，
    // 附加 params 全平台都能透传。
    expect(mockAnalyticsInstance.logEvent).toHaveBeenCalledWith("screen_view", {
      screen_name: "/profile",
      tab: "credits",
    });
  });

  it("deduplicates warnings when calls repeatedly throw (missing plist)", async () => {
    mockAnalyticsInstance.logEvent.mockRejectedValue(new Error("No Firebase app config"));
    const provider = await createFirebaseProvider();
    await provider.init();

    await provider.track("a");
    await provider.track("b");

    expect(console.warn).toHaveBeenCalledTimes(1);
    // 不向业务层抛错
    await expect(provider.track("c")).resolves.toBeUndefined();
  });
});
