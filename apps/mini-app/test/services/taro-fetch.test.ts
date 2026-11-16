import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockRequest } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
}));

vi.mock("@tarojs/taro", () => ({
  default: {
    request: mockRequest,
    getStorageSync: vi.fn(),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    reLaunch: vi.fn(),
  },
}));
vi.mock("@/utils/storage", () => ({
  getToken: vi.fn(() => "test-token"),
}));

describe("taro-fetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create MiniResponse with correct status and ok", async () => {
    const mod = await import("../../src/services/taro-fetch");
    const resp = new mod.MiniResponse({ message: "ok" }, 200, {
      "content-type": "application/json",
    });
    expect(resp.status).toBe(200);
    expect(resp.ok).toBe(true);
    expect(await resp.json()).toEqual({ message: "ok" });
  });

  it("should handle 4xx status", async () => {
    const mod = await import("../../src/services/taro-fetch");
    const resp = new mod.MiniResponse({ error: "not found" }, 404, {});
    expect(resp.status).toBe(404);
    expect(resp.ok).toBe(false);
  });

  it("should get header case-insensitively", async () => {
    const mod = await import("../../src/services/taro-fetch");
    const resp = new mod.MiniResponse({}, 200, { "Content-Type": "application/json" });
    expect(resp.headers.get("content-type")).toBe("application/json");
    expect(resp.headers.get("Content-Type")).toBe("application/json");
  });

  it("should make Taro.request with bearer token", async () => {
    const mod = await import("../../src/services/taro-fetch");
    const fetch = mod.createTaroFetch();

    mockRequest.mockResolvedValue({
      statusCode: 200,
      data: { result: "success" },
      header: { "content-type": "application/json" },
    } as any);

    const response = await fetch("https://api.example.com/test", {
      method: "POST",
      headers: { "X-Custom": "value" },
      body: JSON.stringify({ key: "value" }),
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://api.example.com/test",
        method: "POST",
        header: expect.objectContaining({
          Authorization: "Bearer test-token",
          "X-Custom": "value",
        }),
      }),
    );
    expect(response.status).toBe(200);
  });

  it("should call onUnauthorized on 401", async () => {
    const onUnauth = vi.fn();
    const mod = await import("../../src/services/taro-fetch");
    const fetch = mod.createTaroFetch(onUnauth);

    mockRequest.mockResolvedValue({
      statusCode: 401,
      data: { error: "unauthorized" },
      header: {},
    } as any);

    await fetch("https://api.example.com/test");
    expect(onUnauth).toHaveBeenCalled();
  });

  it("should reject without requesting when signal is already aborted", async () => {
    const mod = await import("../../src/services/taro-fetch");
    const fetch = mod.createTaroFetch();
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetch("https://api.example.com/test", { signal: controller.signal as any }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("should abort the RequestTask and reject when signal aborts mid-flight", async () => {
    const mod = await import("../../src/services/taro-fetch");
    const fetch = mod.createTaroFetch();

    const abort = vi.fn();
    const task = Object.assign(new Promise(() => {}), { abort });
    mockRequest.mockReturnValue(task);

    const controller = new AbortController();
    const pending = fetch("https://api.example.com/test", { signal: controller.signal as any });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(abort).toHaveBeenCalled();
  });

  it("should remove the abort listener after completion", async () => {
    const mod = await import("../../src/services/taro-fetch");
    const fetch = mod.createTaroFetch();

    const abort = vi.fn();
    const task = Object.assign(Promise.resolve({ statusCode: 200, data: {}, header: {} }), {
      abort,
    });
    mockRequest.mockReturnValue(task);

    const controller = new AbortController();
    const removeSpy = vi.spyOn(controller.signal, "removeEventListener");

    await fetch("https://api.example.com/test", { signal: controller.signal as any });

    expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
    controller.abort();
    expect(abort).not.toHaveBeenCalled();
  });
});
