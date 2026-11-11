// 运行时策略测试：供应商选择、实例缓存、gtag/plausible 映射、身份收敛、全局缺失时安全 no-op。
// node 环境下以 defineProperty 注入 window 桩（策略只读取全局对象，不触碰 DOM 路由）。

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAnalyticsStrategy, resetAnalyticsStrategyForTests } from "./strategy";

import type { AnalyticsConfig } from "./internal/types";

const GA_ID = "G-ABCDEF1234";
const DOMAIN = "example.com";

const config = (overrides: Partial<AnalyticsConfig> = {}): AnalyticsConfig => ({
  googleAnalyticsId: "",
  plausibleDomain: "",
  plausibleSrc: "",
  ...overrides,
});

const gtag = vi.fn();
const plausible = vi.fn();

function stubWindow(value: unknown): void {
  Object.defineProperty(globalThis, "window", { configurable: true, value, writable: true });
}

function removeWindow(): void {
  Reflect.deleteProperty(globalThis, "window");
}

describe("createAnalyticsStrategy — selection", () => {
  beforeEach(() => {
    resetAnalyticsStrategyForTests();
    stubWindow({ gtag, plausible });
  });

  afterEach(() => {
    vi.clearAllMocks();
    removeWindow();
  });

  it("returns noop when there is no config", () => {
    expect(createAnalyticsStrategy(undefined).name).toBe("noop");
  });

  it("returns noop when every identifier is invalid", () => {
    const strategy = createAnalyticsStrategy(
      config({ googleAnalyticsId: "G-x'</script>", plausibleDomain: "a b" }),
    );

    expect(strategy.name).toBe("noop");
  });

  it("selects Google Analytics when only its id is configured", () => {
    expect(createAnalyticsStrategy(config({ googleAnalyticsId: GA_ID })).name).toBe(
      "google-analytics",
    );
  });

  it("selects Plausible when only its domain is configured", () => {
    expect(createAnalyticsStrategy(config({ plausibleDomain: DOMAIN })).name).toBe("plausible");
  });

  it("composes both providers when both are configured", async () => {
    const strategy = createAnalyticsStrategy(
      config({ googleAnalyticsId: GA_ID, plausibleDomain: DOMAIN }),
    );

    expect(strategy.name).toBe("composite");

    await strategy.track("signup", { plan: "pro" });

    expect(gtag).toHaveBeenCalledWith("event", "signup", { plan: "pro" });
    expect(plausible).toHaveBeenCalledWith("signup", { props: { plan: "pro" } });
  });

  it("caches the strategy instance for identical configs", () => {
    const first = createAnalyticsStrategy(config({ googleAnalyticsId: GA_ID }));
    const second = createAnalyticsStrategy(config({ googleAnalyticsId: GA_ID }));
    const other = createAnalyticsStrategy(config({ googleAnalyticsId: "G-OTHER" }));

    expect(second).toBe(first);
    expect(other).not.toBe(first);
  });
});

describe("google-analytics strategy", () => {
  beforeEach(() => {
    resetAnalyticsStrategyForTests();
    stubWindow({ gtag });
  });

  afterEach(() => {
    vi.clearAllMocks();
    removeWindow();
  });

  it("maps track to the gtag event command", async () => {
    await createAnalyticsStrategy(config({ googleAnalyticsId: GA_ID })).track("login", {
      method: "google",
    });

    expect(gtag).toHaveBeenCalledWith("event", "login", { method: "google" });
  });

  it("sanitizes properties before sending", async () => {
    await createAnalyticsStrategy(config({ googleAnalyticsId: GA_ID })).track("login", {
      dropped: () => {},
      kept: "ok",
    });

    expect(gtag).toHaveBeenCalledWith("event", "login", { kept: "ok" });
  });

  it("maps identify to user_id plus user_properties", async () => {
    await createAnalyticsStrategy(config({ googleAnalyticsId: GA_ID })).identify("user-1", {
      plan: "pro",
    });

    expect(gtag).toHaveBeenNthCalledWith(1, "set", { user_id: "user-1" });
    expect(gtag).toHaveBeenNthCalledWith(2, "set", "user_properties", { plan: "pro" });
  });

  it("clears both user_id and user_properties on reset", async () => {
    await createAnalyticsStrategy(config({ googleAnalyticsId: GA_ID })).reset();

    expect(gtag).toHaveBeenNthCalledWith(1, "set", { user_id: null });
    expect(gtag).toHaveBeenNthCalledWith(2, "set", "user_properties", {});
  });

  it("maps setScreenName to a page_view event", async () => {
    await createAnalyticsStrategy(config({ googleAnalyticsId: GA_ID })).setScreenName("/pricing", {
      locale: "en",
    });

    expect(gtag).toHaveBeenCalledWith("event", "page_view", {
      locale: "en",
      page_title: "/pricing",
    });
  });

  it("is a safe no-op when the gtag script has not loaded", async () => {
    removeWindow();
    stubWindow({});

    const strategy = createAnalyticsStrategy(config({ googleAnalyticsId: GA_ID }));

    await expect(strategy.track("e")).resolves.toBeUndefined();
    expect(gtag).not.toHaveBeenCalled();
  });
});

describe("plausible strategy", () => {
  beforeEach(() => {
    resetAnalyticsStrategyForTests();
    stubWindow({ plausible });
  });

  afterEach(() => {
    vi.clearAllMocks();
    removeWindow();
  });

  it("only forwards low-cardinality traits (no userId, no PII)", async () => {
    const strategy = createAnalyticsStrategy(config({ plausibleDomain: DOMAIN }));

    await strategy.identify("user-1", { email: "a@b.com", name: "Ada", plan: "pro" });
    await strategy.track("click", { target: "cta" });

    expect(plausible).toHaveBeenCalledWith("click", {
      props: { plan: "pro", target: "cta" },
    });
  });

  it("sends no event on identify (Plausible has no identity API)", async () => {
    await createAnalyticsStrategy(config({ plausibleDomain: DOMAIN })).identify("user-1");

    expect(plausible).not.toHaveBeenCalled();
  });

  it("clears identity on reset", async () => {
    const strategy = createAnalyticsStrategy(config({ plausibleDomain: DOMAIN }));

    await strategy.identify("user-1", { plan: "pro" });
    await strategy.reset();
    await strategy.track("click");

    expect(plausible).toHaveBeenCalledWith("click", undefined);
  });

  it("maps setScreenName to a pageview event with the path prop", async () => {
    await createAnalyticsStrategy(config({ plausibleDomain: DOMAIN })).setScreenName("/pricing");

    expect(plausible).toHaveBeenCalledWith("pageview", { props: { path: "/pricing" } });
  });

  it("is a safe no-op when the plausible script has not loaded", async () => {
    removeWindow();
    stubWindow({});

    const strategy = createAnalyticsStrategy(config({ plausibleDomain: DOMAIN }));

    await expect(strategy.track("e")).resolves.toBeUndefined();
    expect(plausible).not.toHaveBeenCalled();
  });
});
