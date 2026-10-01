import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getSettingGroups,
  getSettings,
  isMaskedConfigValue,
  isSecretConfigKey,
  maskConfigValue,
  PROTECTED_CONFIG_KEYS,
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

describe("getSettingGroups — mobile analytics groups", () => {
  it("exposes the openpanel group on the analytics tab", () => {
    const groups = getSettingGroups();
    const openpanel = groups.find((g) => g.name === "openpanel");
    expect(openpanel?.tab).toBe("analytics");
    expect(openpanel?.title).toBe("OpenPanel");
  });

  it("keeps google_analytics group on the analytics tab (hosts ga_mobile_enabled)", () => {
    const groups = getSettingGroups();
    const ga = groups.find((g) => g.name === "google_analytics");
    expect(ga?.tab).toBe("analytics");
  });
});

describe("getSettingGroups — RevenueCat group", () => {
  const SECRET_NAMES = ["revenuecat_webhook_secret", "revenuecat_secret_api_key"];

  it.each(SECRET_NAMES)("flags %s as secret", (name) => {
    expect(isSecretConfigKey(name)).toBe(true);
  });

  it("exposes the revenuecat group on the payment tab", () => {
    const groups = getSettingGroups();
    const revenuecat = groups.find((g) => g.name === "revenuecat");
    expect(revenuecat?.tab).toBe("payment");
    expect(revenuecat?.title).toBe("RevenueCat");
  });
});

describe("getSettingGroups — AI provider groups", () => {
  it("exposes the AI provider groups on the ai tab", () => {
    const groups = getSettingGroups()
      .filter((g) => g.tab === "ai")
      .map((g) => g.name);
    for (const name of [
      "openai",
      "anthropic",
      "google",
      "openrouter",
      "deepseek",
      "ollama",
      "replicate",
      "fal",
    ]) {
      expect(groups).toContain(name);
    }
  });
});

describe("getSettings — LLM provider config keys", () => {
  it("registers the six LLM provider config keys", () => {
    const names = getSettings().map((s) => s.name);
    for (const key of [
      "google_api_key",
      "openrouter_api_key",
      "openrouter_base_url",
      "deepseek_api_key",
      "deepseek_base_url",
      "ollama_base_url",
      "default_llm_provider",
    ]) {
      expect(names).toContain(key);
    }
  });
});
