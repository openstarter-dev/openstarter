import { describe, expect, it, vi } from "vitest";

vi.mock("@openstarter/shared/config", () => ({
  getAllConfigs: vi.fn(async () => ({
    ga_mobile_enabled: "true", // 移动端键：绝不允许出现在公开配置里
    google_analytics_id: "G-ABC123",
    openpanel_client_id: "op-client", // 移动端键：绝不允许出现在公开配置里
    openpanel_client_secret: "op-secret", // 移动端键：绝不允许出现在公开配置里
    plausible_domain: "example.com",
    plausible_src: "https://plausible.example.com/js/script.js",
    stripe_secret_key: "sk_live_danger",
  })),
}));

import { getPublicAnalyticsConfig } from "./service";

describe("getPublicAnalyticsConfig — web keys only", () => {
  it("returns the three web keys and never mobile/sensitive keys", async () => {
    const config = await getPublicAnalyticsConfig();

    expect(config).toEqual({
      googleAnalyticsId: "G-ABC123",
      plausibleDomain: "example.com",
      plausibleSrc: "https://plausible.example.com/js/script.js",
    });
  });

  it("maps missing keys to empty strings", async () => {
    vi.mocked(await import("@openstarter/shared/config")).getAllConfigs.mockImplementation(
      async () => ({}),
    );

    expect(await getPublicAnalyticsConfig()).toEqual({
      googleAnalyticsId: "",
      plausibleDomain: "",
      plausibleSrc: "",
    });
  });
});
