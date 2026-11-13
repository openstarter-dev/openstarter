import { beforeEach, describe, expect, it, vi } from "vitest";

const configsState = vi.hoisted(() => ({
  map: {} as Record<string, string>,
}));

vi.mock("@openstarter/shared/config", () => ({
  getAllConfigs: () => Promise.resolve(configsState.map),
}));

vi.mock("../admin/analytics", () => ({
  getPublicAnalyticsConfig: () => Promise.resolve({}),
}));

import { configRouter } from "./router";

beforeEach(() => {
  configsState.map = {};
});

describe("GET /config/public", () => {
  it("exposes revenuecat_enabled when set", async () => {
    configsState.map = { revenuecat_enabled: "true" };
    const response = await configRouter.request("/config/public");

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Record<string, string> };
    expect(body.data.revenuecat_enabled).toBe("true");
  });

  it("exposes anonymous_auth_enabled when set", async () => {
    configsState.map = { anonymous_auth_enabled: "true" };
    const response = await configRouter.request("/config/public");

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Record<string, string> };
    expect(body.data.anonymous_auth_enabled).toBe("true");
  });

  it("never exposes secret config keys", async () => {
    configsState.map = {
      revenuecat_enabled: "true",
      revenuecat_webhook_secret: "whsec_danger",
      revenuecat_secret_api_key: "sk_danger",
      stripe_secret_key: "sk_live_danger",
    };
    const response = await configRouter.request("/config/public");
    const body = (await response.json()) as { data: Record<string, string> };

    expect(body.data.revenuecat_webhook_secret).toBeUndefined();
    expect(body.data.revenuecat_secret_api_key).toBeUndefined();
    expect(body.data.stripe_secret_key).toBeUndefined();
  });
});
