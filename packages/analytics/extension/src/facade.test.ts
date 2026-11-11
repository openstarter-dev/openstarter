// 门面测试：配置选择、幂等、预 init no-op、转发与错误吞噬。

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  configureAnalyticsErrors,
  identify,
  initAnalytics,
  reset,
  resetAnalyticsForTests,
  setScreenName,
  track,
} from "./facade";

import type { ExtensionAnalyticsConfig, FetchLike } from "./internal/types";

const enabledConfig: ExtensionAnalyticsConfig = {
  plausibleDomain: "example.com",
  plausibleHost: "https://plausible.example.com",
  siteUrl: "https://app.example.com",
};

const disabledConfig: ExtensionAnalyticsConfig = {
  plausibleDomain: "",
  plausibleHost: "https://plausible.io",
  siteUrl: "",
};

function createFetchStub(): { calls: number; fetch: FetchLike } {
  const stub = {
    calls: 0,
    fetch: (async () => {
      stub.calls += 1;
      return { ok: true, status: 202 };
    }) satisfies FetchLike,
  };
  return stub;
}

describe("initAnalytics", () => {
  beforeEach(() => {
    resetAnalyticsForTests();
  });

  it("returns noop when no provider is configured", () => {
    const provider = initAnalytics(disabledConfig);

    expect(provider.name).toBe("noop");
  });

  it("returns the plausible provider when configured", () => {
    const provider = initAnalytics(enabledConfig, { fetch: createFetchStub().fetch });

    expect(provider.name).toBe("plausible");
  });

  it("is idempotent: second init returns the same instance", () => {
    const first = initAnalytics(enabledConfig);
    const second = initAnalytics(disabledConfig);

    expect(second).toBe(first);
  });
});

describe("convenience forwarders", () => {
  beforeEach(() => {
    resetAnalyticsForTests();
    // 错误出口是模块级状态：每个用例复位成静默，避免相互影响
    configureAnalyticsErrors({});
  });

  it("are safe no-ops before init", async () => {
    await expect(track("e")).resolves.toBeUndefined();
    await expect(identify("u")).resolves.toBeUndefined();
    await expect(setScreenName("/")).resolves.toBeUndefined();
    await expect(reset()).resolves.toBeUndefined();
  });

  it("reach the active provider after init", async () => {
    const stub = createFetchStub();
    initAnalytics(enabledConfig, { fetch: stub.fetch });

    await identify("user-1", { plan: "pro" });
    await track("event", { a: 1 });
    await setScreenName("/popup");
    await reset();
    await track("after-reset");

    // identify/reset 不发请求；track + setScreenName 各一次
    expect(stub.calls).toBe(3);
  });

  it("swallow provider failures", async () => {
    const failing: FetchLike = async () => {
      throw new Error("boom");
    };
    initAnalytics(enabledConfig, { fetch: failing });

    await expect(track("event")).resolves.toBeUndefined();
  });

  it("forward provider failures to the configured error handler", async () => {
    const onError = vi.fn();
    configureAnalyticsErrors({ onError });

    const failing: FetchLike = async () => {
      throw new Error("boom");
    };
    initAnalytics(enabledConfig, { fetch: failing });

    await track("event");

    expect(onError).toHaveBeenCalledWith(expect.any(Error), {
      method: "track",
      provider: "plausible",
    });
  });

  it("expose debug logging through configureAnalyticsErrors", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    configureAnalyticsErrors({ debug: true });

    const failing: FetchLike = async () => {
      throw new Error("boom");
    };
    initAnalytics(enabledConfig, { fetch: failing });

    await track("event");

    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
