import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api";
import { getSessionCookie } from "@/lib/auth-client";

vi.mock("@/lib/env", () => ({
  getEnv: vi.fn(() => ({ ok: true, apiUrl: "http://localhost:3000" })),
}));

vi.mock("@/lib/auth-client", () => ({
  getSessionCookie: vi.fn(async () => "openstarter.session_token=abc"),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function lastInit(): RequestInit {
  return fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
  vi.mocked(getSessionCookie).mockResolvedValue("openstarter.session_token=abc");
});

describe("apiClient (mobile)", () => {
  it("get 序列化 query 并跳过 undefined", async () => {
    await apiClient.get("/api/user/orders", {
      query: { page: 2, pageSize: 20, extra: undefined },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/user/orders?page=2&pageSize=20",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("get 无 query 时不拼接问号", async () => {
    await apiClient.get("/api/user/plan");
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("http://localhost:3000/api/user/plan");
  });

  it("注入 session cookie 头", async () => {
    await apiClient.get("/api/user/plan");
    expect(lastInit().headers).toEqual({ cookie: "openstarter.session_token=abc" });
  });

  it("无 cookie 时不携带 cookie 头", async () => {
    vi.mocked(getSessionCookie).mockResolvedValue("");
    await apiClient.get("/api/user/plan");
    expect(lastInit().headers).toEqual({});
  });

  it("post 序列化 body 并带 Content-Type", async () => {
    await apiClient.post("/api/referral/bind", { code: "REF1234" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/referral/bind",
      expect.objectContaining({ method: "POST" }),
    );
    expect(lastInit().body).toBe(JSON.stringify({ code: "REF1234" }));
    expect(lastInit().headers).toEqual({
      cookie: "openstarter.session_token=abc",
      "Content-Type": "application/json",
    });
  });

  it("post 无 body 时不带 body 与 Content-Type", async () => {
    await apiClient.post("/api/user/billing-portal");
    expect(lastInit().body).toBeUndefined();
    expect(lastInit().headers).toEqual({ cookie: "openstarter.session_token=abc" });
  });

  it("透传 abort signal", async () => {
    const controller = new AbortController();
    await apiClient.get("/api/user/plan", { signal: controller.signal });
    expect(lastInit().signal).toBe(controller.signal);
  });

  it("env 读取失败时兜底 127.0.0.1", async () => {
    vi.resetModules();
    const envModule = await import("@/lib/env");
    vi.mocked(envModule.getEnv).mockReturnValue({ ok: false, reason: "missing" });
    const { apiClient: fallbackClient } = await import("@/lib/api");
    await fallbackClient.get("/api/user/plan");
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("http://127.0.0.1/api/user/plan");
  });
});
