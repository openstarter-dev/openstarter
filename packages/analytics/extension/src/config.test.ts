// config 解析测试：构建期 env（VITE_*）→ ExtensionAnalyticsConfig。
// 键组合语义由单元用例锁定；「任意 shape 不抛错」用参数化用例覆盖（与 mobile 的
// property 测试同目标，本包不引入 fast-check 依赖）。

import { describe, expect, it } from "vitest";

import {
  ANALYTICS_ENV_KEYS,
  DEFAULT_PLAUSIBLE_HOST,
  resolveExtensionAnalyticsConfig,
} from "./config";

describe("resolveExtensionAnalyticsConfig — unit", () => {
  it("returns disabled config for undefined/null env", () => {
    const disabled = {
      plausibleDomain: "",
      plausibleHost: DEFAULT_PLAUSIBLE_HOST,
      siteUrl: "",
    };
    expect(resolveExtensionAnalyticsConfig(undefined)).toEqual(disabled);
    expect(resolveExtensionAnalyticsConfig(null)).toEqual(disabled);
  });

  it("maps empty keys to disabled config", () => {
    expect(resolveExtensionAnalyticsConfig({})).toEqual({
      plausibleDomain: "",
      plausibleHost: DEFAULT_PLAUSIBLE_HOST,
      siteUrl: "",
    });
  });

  it("trims values and reads the documented env keys", () => {
    expect(
      resolveExtensionAnalyticsConfig({
        [ANALYTICS_ENV_KEYS.plausibleDomain]: "  example.com  ",
        [ANALYTICS_ENV_KEYS.plausibleHost]: "  https://plausible.example.com  ",
        [ANALYTICS_ENV_KEYS.siteUrl]: "  https://app.example.com  ",
      }),
    ).toEqual({
      plausibleDomain: "example.com",
      plausibleHost: "https://plausible.example.com",
      siteUrl: "https://app.example.com",
    });
  });

  it("falls back to the official host for empty / non-http host values", () => {
    expect(
      resolveExtensionAnalyticsConfig({ [ANALYTICS_ENV_KEYS.plausibleHost]: "" }).plausibleHost,
    ).toBe(DEFAULT_PLAUSIBLE_HOST);
    expect(
      resolveExtensionAnalyticsConfig({ [ANALYTICS_ENV_KEYS.plausibleHost]: "ftp://x.io" })
        .plausibleHost,
    ).toBe(DEFAULT_PLAUSIBLE_HOST);
    expect(
      resolveExtensionAnalyticsConfig({ [ANALYTICS_ENV_KEYS.plausibleHost]: "not-a-url" })
        .plausibleHost,
    ).toBe(DEFAULT_PLAUSIBLE_HOST);
  });

  it("strips trailing slashes from the host", () => {
    expect(
      resolveExtensionAnalyticsConfig({
        [ANALYTICS_ENV_KEYS.plausibleHost]: "https://plausible.example.com///",
      }).plausibleHost,
    ).toBe("https://plausible.example.com");
  });

  it("ignores non-string values instead of throwing", () => {
    const env = {
      [ANALYTICS_ENV_KEYS.plausibleDomain]: 42,
      [ANALYTICS_ENV_KEYS.siteUrl]: null,
    } as unknown as Record<string, string | undefined>;

    expect(resolveExtensionAnalyticsConfig(env)).toEqual({
      plausibleDomain: "",
      plausibleHost: DEFAULT_PLAUSIBLE_HOST,
      siteUrl: "",
    });
  });
});

describe("resolveExtensionAnalyticsConfig — robustness", () => {
  const weirdValues: unknown[] = [0, 1, true, false, null, undefined, [], {}, () => {}, Symbol("x")];

  it("never throws and always returns parseable string fields for arbitrary values", () => {
    for (const value of weirdValues) {
      const env = {
        [ANALYTICS_ENV_KEYS.plausibleDomain]: value,
        [ANALYTICS_ENV_KEYS.plausibleHost]: value,
        [ANALYTICS_ENV_KEYS.siteUrl]: value,
      } as unknown as Record<string, string | undefined>;

      const config = resolveExtensionAnalyticsConfig(env);

      expect(typeof config.plausibleDomain).toBe("string");
      expect(typeof config.plausibleHost).toBe("string");
      expect(typeof config.siteUrl).toBe("string");
      // host 永远可解析为 http(s) URL（回退值保证）
      expect(new URL(config.plausibleHost).protocol).toMatch(/^https?:$/u);
    }
  });
});
