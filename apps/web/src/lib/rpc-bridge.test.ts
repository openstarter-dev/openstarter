import { afterEach, describe, expect, it, vi } from "vitest";

import { client } from "@/lib/api";
import { setRpcFetchBridge } from "@/lib/rpc-bridge";

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

/**
 * 回归：客户端用相对 base（`/`），服务端 `fetch` 无法解析相对 URL
 * （`TypeError: Failed to parse URL`），SSR 的 loader prefetch 会被 `allSettled` 静默吞掉。
 * 桥接必须在服务端接管这些调用，并在浏览器侧如实回落到全局 fetch。
 */
describe("SSR RPC 桥接", () => {
  afterEach(() => {
    setRpcFetchBridge(undefined);
    vi.unstubAllGlobals();
  });

  it("装入桥接后，相对 base 的调用交给桥接且能解析信封", async () => {
    const seen: string[] = [];
    setRpcFetchBridge(async (input) => {
      seen.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      return jsonResponse({ code: 0, message: "ok", data: { status: "ok" } });
    });

    const res = await client.api.health.$get();

    expect(seen).toEqual(["/api/health"]);
    await expect(res.json()).resolves.toEqual({ code: 0, message: "ok", data: { status: "ok" } });
  });

  it("未装桥接（浏览器侧）时回落到全局 fetch，仍是同源相对路径", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ code: 0, message: "ok" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    setRpcFetchBridge(undefined);

    await client.api.health.$get();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/health");
  });
});
