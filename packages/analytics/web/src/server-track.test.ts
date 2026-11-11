// 服务端策略测试：GA4 Measurement Protocol 的请求形状、client_id 归属、失败吞噬。

import { describe, expect, it, vi } from "vitest";

import { createGA4ServerStrategy } from "./server-track";
import { ANALYTICS_EVENTS } from "@openstarter/analytics";

import type { ServerFetchLike } from "./server-track";

interface FetchCall {
  body: {
    client_id: string;
    events: { name: string; params: Record<string, unknown> }[];
  };
  headers: Record<string, string>;
  input: string;
  method: string;
}

function createFetchStub(status = 204): { calls: FetchCall[]; fetch: ServerFetchLike } {
  const calls: FetchCall[] = [];
  const fetchStub: ServerFetchLike = async (input, init) => {
    calls.push({
      body: JSON.parse(init.body) as FetchCall["body"],
      headers: init.headers,
      input,
      method: init.method,
    });
    return { ok: status < 400, status };
  };
  return { calls, fetch: fetchStub };
}

const baseOptions = { apiSecret: "s3cret", measurementId: "G-TEST123" };

describe("createGA4ServerStrategy", () => {
  it("posts to the measurement protocol endpoint with credentials in the query", async () => {
    const stub = createFetchStub();
    const strategy = createGA4ServerStrategy({ ...baseOptions, fetch: stub.fetch });

    await strategy.track(ANALYTICS_EVENTS.PURCHASE, { value: 99, currency: "USD" });

    expect(stub.calls).toHaveLength(1);
    const [call] = stub.calls;
    expect(call?.input).toBe(
      "https://www.google-analytics.com/mp/collect?measurement_id=G-TEST123&api_secret=s3cret",
    );
    expect(call?.method).toBe("POST");
    expect(call?.headers["Content-Type"]).toBe("application/json");
    expect(call?.body.events).toEqual([
      { name: "purchase", params: { currency: "USD", value: 99 } },
    ]);
  });

  it("uses an explicit clientId and strips it from event params", async () => {
    const stub = createFetchStub();
    const strategy = createGA4ServerStrategy({ ...baseOptions, fetch: stub.fetch });

    await strategy.track("signup", { clientId: "user-42", plan: "pro" });

    expect(stub.calls[0]?.body.client_id).toBe("user-42");
    expect(stub.calls[0]?.body.events[0]?.params).toEqual({ plan: "pro" });
  });

  it("generates a client_id when none is provided", async () => {
    const stub = createFetchStub();
    const strategy = createGA4ServerStrategy({ ...baseOptions, fetch: stub.fetch });

    await strategy.track("signup");

    expect(stub.calls[0]?.body.client_id).toMatch(/.+/u);
  });

  it("sanitizes properties before sending", async () => {
    const stub = createFetchStub();
    const strategy = createGA4ServerStrategy({ ...baseOptions, fetch: stub.fetch });

    await strategy.track("event", { dropped: () => {}, kept: "ok", nan: Number.NaN });

    expect(stub.calls[0]?.body.events[0]?.params).toEqual({ kept: "ok" });
  });

  it("reports non-2xx responses without throwing", async () => {
    const stub = createFetchStub(500);
    const onError = vi.fn();
    const strategy = createGA4ServerStrategy({ ...baseOptions, fetch: stub.fetch, onError });

    await expect(strategy.track("event")).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("reports network failures without throwing", async () => {
    const onError = vi.fn();
    const failing: ServerFetchLike = async () => {
      throw new Error("network down");
    };
    const strategy = createGA4ServerStrategy({ ...baseOptions, fetch: failing, onError });

    await expect(strategy.track("event")).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("is a safe no-op when no fetch implementation is available", async () => {
    vi.stubGlobal("fetch", undefined);

    try {
      const onError = vi.fn();
      const strategy = createGA4ServerStrategy({ ...baseOptions, onError });

      await expect(strategy.track("event")).resolves.toBeUndefined();
      expect(onError).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
