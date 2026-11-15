import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../middleware/auth", () => ({
  requireAuth: (_c: unknown, next: () => Promise<void>) => next(),
}));

const mapRevenueCatEventMock = vi.hoisted(() => vi.fn());
vi.mock("./payment/revenuecat", async () => {
  const actual = await vi.importActual<typeof import("./payment/revenuecat")>(
    "./payment/revenuecat",
  );
  return {
    ...actual,
    mapRevenueCatEvent: (...args: unknown[]) => mapRevenueCatEventMock(...args),
  };
});

import { billingRouter } from "./router";

const SECRET = "whsec_route_test";

function signBody(t: number, rawBody: string): string {
  const v1 = createHmac("sha256", SECRET).update(`${t}.${rawBody}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

const RAW_BODY = JSON.stringify({
  event: { type: "TEST", app_user_id: "user-1" },
});

function postWebhook(headers: Record<string, string>, body: string) {
  return billingRouter.request("/payment/webhook/revenuecat", {
    body,
    headers,
    method: "POST",
  });
}

function enabledHeaders() {
  return {
    "content-type": "application/json",
    "x-revenuecat-webhook-signature": signBody(Math.floor(Date.now() / 1000), RAW_BODY),
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  mapRevenueCatEventMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /payment/webhook/revenuecat", () => {
  it("returns 401 when REVENUECAT_ENABLED is not true (fail-closed)", async () => {
    const response = await postWebhook(enabledHeaders(), RAW_BODY);

    expect(response.status).toBe(401);
    expect(mapRevenueCatEventMock).not.toHaveBeenCalled();
  });

  it("returns 401 when webhook secret is missing even if enabled", async () => {
    vi.stubEnv("REVENUECAT_ENABLED", "true");
    const response = await postWebhook(enabledHeaders(), RAW_BODY);

    expect(response.status).toBe(401);
    expect(mapRevenueCatEventMock).not.toHaveBeenCalled();
  });

  it("returns 401 on an invalid signature", async () => {
    vi.stubEnv("REVENUECAT_ENABLED", "true");
    vi.stubEnv("REVENUECAT_WEBHOOK_SECRET", SECRET);
    const response = await postWebhook(
      { "x-revenuecat-webhook-signature": "t=1,v1=deadbeef" },
      RAW_BODY,
    );

    expect(response.status).toBe(401);
    expect(mapRevenueCatEventMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the signature header is absent", async () => {
    vi.stubEnv("REVENUECAT_ENABLED", "true");
    vi.stubEnv("REVENUECAT_WEBHOOK_SECRET", SECRET);
    const response = await postWebhook({ "content-type": "application/json" }, RAW_BODY);

    expect(response.status).toBe(401);
    expect(mapRevenueCatEventMock).not.toHaveBeenCalled();
  });

  it("delegates to mapRevenueCatEvent and returns received:true on a valid webhook", async () => {
    vi.stubEnv("REVENUECAT_ENABLED", "true");
    vi.stubEnv("REVENUECAT_WEBHOOK_SECRET", SECRET);
    const response = await postWebhook(enabledHeaders(), RAW_BODY);

    expect(response.status).toBe(200);
    const data = (await response.json()) as { data?: { received?: boolean } };
    expect(data.data?.received).toBe(true);
    expect(mapRevenueCatEventMock).toHaveBeenCalledTimes(1);

    const payload = mapRevenueCatEventMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toEqual({ event: { app_user_id: "user-1", type: "TEST" } });
  });
});
