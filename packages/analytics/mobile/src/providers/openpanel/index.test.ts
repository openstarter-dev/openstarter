// OpenPanel provider 单元测试：mock @openpanel/react-native 模块，
// 验证官方 SDK 签名与 provider 接口之间的映射与降级行为。

import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock 会被 hoist 到文件顶部；工厂里先造可变的 mock 记录器。
// 实现必须用普通 function（vitest v4 对 new 走 Reflect.construct，箭头函数不可构造）。
const mockInstance = {
  identify: vi.fn(),
  setGlobalProperties: vi.fn(),
  track: vi.fn(),
};
vi.mock("@openpanel/react-native", () => ({
  OpenPanel: vi.fn(function () {
    return mockInstance;
  }),
}));

import { createOpenPanelProvider } from "./openpanel";

describe("createOpenPanelProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the official constructor with clientId + clientSecret", async () => {
    const provider = await createOpenPanelProvider({
      clientId: "op-client",
      clientSecret: "op-secret",
    });
    await provider.init();

    const { OpenPanel } = await import("@openpanel/react-native");
    expect(OpenPanel).toHaveBeenCalledWith({
      clientId: "op-client",
      clientSecret: "op-secret",
    });
    expect(provider.name).toBe("openpanel");
  });

  it("maps track() to instance.track with properties", async () => {
    const provider = await createOpenPanelProvider({
      clientId: "op-client",
      clientSecret: "op-secret",
    });
    await provider.init();
    await provider.track("button_clicked", { button_name: "signup" });

    expect(mockInstance.track).toHaveBeenCalledWith("button_clicked", {
      button_name: "signup",
    });
  });

  it("maps identify() to instance.identify with firstName/email hoisted and rest in properties", async () => {
    const provider = await createOpenPanelProvider({
      clientId: "op-client",
      clientSecret: "op-secret",
    });
    await provider.init();
    await provider.identify("user-1", {
      email: "a@b.c",
      firstName: "Yang",
      plan: "pro",
    });

    expect(mockInstance.identify).toHaveBeenCalledWith({
      email: "a@b.c",
      firstName: "Yang",
      profileId: "user-1",
      properties: { plan: "pro" },
    });
  });

  it("maps setUserId() to setGlobalProperties({ userId })", async () => {
    const provider = await createOpenPanelProvider({
      clientId: "op-client",
      clientSecret: "op-secret",
    });
    await provider.init();
    await provider.setUserId("user-1");

    expect(mockInstance.setGlobalProperties).toHaveBeenCalledWith({
      userId: "user-1",
    });
  });

  it("maps setScreenName() to a screen_view track event", async () => {
    const provider = await createOpenPanelProvider({
      clientId: "op-client",
      clientSecret: "op-secret",
    });
    await provider.init();
    await provider.setScreenName("/settings", { locale: "zh" });

    expect(mockInstance.track).toHaveBeenCalledWith("screen_view", {
      locale: "zh",
      screen_name: "/settings",
    });
  });

  it("degrades to failed state (no-throw) when the SDK module is missing", async () => {
    vi.resetModules();
    vi.doMock("@openpanel/react-native", () => {
      throw new Error("module not installed");
    });
    // 动态 import 失败路径：重新取被 doMock 影响的工厂
    const { createOpenPanelProvider: createWithBrokenSdk } = await import("./openpanel");
    const provider = await createWithBrokenSdk({
      clientId: "op-client",
      clientSecret: "op-secret",
    });

    // 不抛错；调用静默 no-op
    await expect(provider.init()).resolves.toBeUndefined();
    await expect(provider.track("e")).resolves.toBeUndefined();
    expect(provider.name).toBe("openpanel");
  });
});
