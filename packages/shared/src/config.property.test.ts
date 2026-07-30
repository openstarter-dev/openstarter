import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PROTECTED_CONFIG_KEYS,
  isMaskedConfigValue,
  isSecretConfigKey,
  maskConfigValue,
} from "./config";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("DATABASE_PROVIDER", "sqlite");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("config defaults and masks (Property 3, 3.7)", () => {
  it("P3.7 protected keys remain in the protected predicate set", () => {
    for (const name of PROTECTED_CONFIG_KEYS) {
      expect(PROTECTED_CONFIG_KEYS.has(name)).toBe(true);
    }
    expect(PROTECTED_CONFIG_KEYS.has("auth_secret")).toBe(true);
    expect(PROTECTED_CONFIG_KEYS.has("database_url")).toBe(true);
    expect(PROTECTED_CONFIG_KEYS.has("db_schema")).toBe(true);
  });

  it("P3.7 maskConfigValue round-trips through isMaskedConfigValue", () => {
    expect(maskConfigValue("abcdefgh").startsWith("••••")).toBe(true);
    expect(isMaskedConfigValue(maskConfigValue("abcdefgh"))).toBe(true);
    expect(isMaskedConfigValue("plain")).toBe(false);
  });

  it("P3.7 short secret values are fully masked, long ones keep last 4 chars", () => {
    const short = maskConfigValue("abc");
    const long = maskConfigValue("abcdefghij");

    // value.length <= 8 -> MASK_PREFIX only
    expect(short.length).toBe(8);
    expect(short.startsWith("••••")).toBe(true);

    // value.length > 8 -> MASK_PREFIX + last 4 chars
    expect(long.endsWith("ghij")).toBe(true);
    expect(long.startsWith("••••")).toBe(true);
  });
});

const SECRET_NAMES = [
  "stripe_secret_key",
  "google_client_secret",
  "wechat_api_v3_key",
  "github_client_secret",
  "r2_secret_key",
  "openai_api_key",
  "fal_api_key",
  "anthropic_api_key",
  "replicate_api_token",
];

const NON_SECRET_NAMES = ["app_name", "app_url", "app_description", "app_logo"];

describe("isSecretConfigKey suffix detection", () => {
  it.each(SECRET_NAMES)("flags %s as secret", (name) => {
    expect(isSecretConfigKey(name)).toBe(true);
  });

  it.each(NON_SECRET_NAMES)("flags %s as non-secret", (name) => {
    expect(isSecretConfigKey(name)).toBe(false);
  });
});
