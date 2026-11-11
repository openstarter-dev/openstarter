// Plausible provider 单元测试：以 fetch 桩验证请求形状、身份合并、错误吞噬。

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPlausibleProvider, plausibleDefinition } from "./index";

import type { ExtensionAnalyticsConfig, FetchLike } from "../../internal/types";

const config: ExtensionAnalyticsConfig = {
  plausibleDomain: "example.com",
  plausibleHost: "https://plausible.example.com",
  siteUrl: "https://app.example.com",
};

interface FetchCall {
  body: Record<string, unknown>;
  headers: Record<string, string>;
  input: string;
  method: string;
}

function createFetchStub(result: { ok: boolean; status: number } = { ok: true, status: 202 }): {
  calls: FetchCall[];
  fetch: FetchLike;
} {
  const calls: FetchCall[] = [];
  const fetchStub: FetchLike = async (input, init) => {
    calls.push({
      body: JSON.parse(init.body) as Record<string, unknown>,
      headers: init.headers,
      input,
      method: init.method,
    });
    return result;
  };
  return { calls, fetch: fetchStub };
}

describe("createPlausibleProvider", () => {
  let stub: ReturnType<typeof createFetchStub>;

  beforeEach(() => {
    stub = createFetchStub();
  });

  it("posts events to {host}/api/event with domain + url", async () => {
    const provider = createPlausibleProvider(config, { fetch: stub.fetch });

    await provider.track("signup", { plan: "pro" });

    expect(stub.calls).toHaveLength(1);
    const [call] = stub.calls;
    expect(call?.input).toBe("https://plausible.example.com/api/event");
    expect(call?.method).toBe("POST");
    expect(call?.headers["Content-Type"]).toBe("application/json");
    expect(call?.body).toEqual({
      domain: "example.com",
      name: "signup",
      props: { plan: "pro" },
      url: "https://app.example.com",
    });
  });

  it("omits props when neither traits nor properties are given", async () => {
    const provider = createPlausibleProvider(config, { fetch: stub.fetch });

    await provider.track("install");

    expect(stub.calls[0]?.body).toEqual({
      domain: "example.com",
      name: "install",
      url: "https://app.example.com",
    });
  });

  it("only forwards low-cardinality traits (no userId, no PII)", async () => {
    const provider = createPlausibleProvider(config, { fetch: stub.fetch });

    await provider.identify("user-1", { email: "a@b.com", name: "Ada", plan: "pro" });
    await provider.track("click", { target: "cta" });

    expect(stub.calls[0]?.body.props).toEqual({
      plan: "pro",
      target: "cta",
    });
  });

  it("identify does not send an event of its own", async () => {
    const provider = createPlausibleProvider(config, { fetch: stub.fetch });

    await provider.identify("user-1", { plan: "pro" });

    expect(stub.calls).toHaveLength(0);
  });

  it("reset clears the identity for later events", async () => {
    const provider = createPlausibleProvider(config, { fetch: stub.fetch });

    await provider.identify("user-1", { plan: "pro" });
    await provider.reset();
    await provider.track("click");

    expect(stub.calls[0]?.body.props).toBeUndefined();
  });

  it("maps setScreenName to a pageview event with the path as prop", async () => {
    const provider = createPlausibleProvider(config, { fetch: stub.fetch });

    await provider.setScreenName("/popup", { variant: "b" });

    expect(stub.calls[0]?.body).toEqual({
      domain: "example.com",
      name: "pageview",
      props: { path: "/popup", variant: "b" },
      url: "https://app.example.com",
    });
  });

  it("swallows network failures", async () => {
    const failing: FetchLike = async () => {
      throw new Error("network down");
    };
    const provider = createPlausibleProvider(config, { fetch: failing });

    await expect(provider.track("event")).resolves.toBeUndefined();
  });

  it("is a safe no-op when no fetch implementation is available", async () => {
    // Node 18+ 自带 fetch；stub 成 undefined 才能覆盖「运行时无 fetch」分支，
    // 否则会真的向 plausible.example.com 发请求（测试变慢且依赖网络）。
    vi.stubGlobal("fetch", undefined);

    try {
      const provider = createPlausibleProvider(config, {});

      await expect(provider.track("event")).resolves.toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not implement init (nothing to warm up)", () => {
    const provider = createPlausibleProvider(config, { fetch: stub.fetch });

    expect(provider.init).toBeUndefined();
    expect(provider.name).toBe("plausible");
  });

  it("does not throw on non-2xx responses but reports them", async () => {
    const failing = createFetchStub({ ok: false, status: 500 });
    const report = vi.fn();
    const provider = createPlausibleProvider(config, { fetch: failing.fetch }, report);

    await expect(provider.track("event")).resolves.toBeUndefined();
    expect(report).toHaveBeenCalledWith(expect.any(Error), {
      method: "track",
      provider: "plausible",
    });
  });
});

describe("plausibleDefinition", () => {
  it("requires both a valid domain and a valid site url", () => {
    expect(plausibleDefinition.isConfigured(config)).toBe(true);

    expect(plausibleDefinition.isConfigured({ ...config, plausibleDomain: "" })).toBe(false);
    expect(plausibleDefinition.isConfigured({ ...config, plausibleDomain: "bad domain" })).toBe(
      false,
    );
    expect(plausibleDefinition.isConfigured({ ...config, siteUrl: "" })).toBe(false);
    expect(plausibleDefinition.isConfigured({ ...config, siteUrl: "app://extension" })).toBe(false);
  });
});
