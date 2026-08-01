import { describe, expect, it } from "vitest";

import { isSupportedLocale, resolveInitialLocale } from "./locale";

describe("isSupportedLocale", () => {
  it("accepts the supported locales", () => {
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("zh")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isSupportedLocale("fr")).toBe(false);
    expect(isSupportedLocale("zh-Hans")).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
    expect(isSupportedLocale(undefined)).toBe(false);
    expect(isSupportedLocale("")).toBe(false);
  });
});

describe("resolveInitialLocale", () => {
  it("prefers the persisted choice over the device language", () => {
    expect(resolveInitialLocale(["en-US"], "zh")).toBe("zh");
  });

  it("ignores an unsupported persisted value and falls back to the device", () => {
    expect(resolveInitialLocale(["zh-Hans-CN"], "fr")).toBe("zh");
  });

  it("matches the device language by its primary subtag", () => {
    expect(resolveInitialLocale(["zh-Hans-CN"], null)).toBe("zh");
    expect(resolveInitialLocale(["en-GB"], null)).toBe("en");
  });

  it("scans past unsupported device locales to the first supported one", () => {
    expect(resolveInitialLocale(["fr-FR", "de-DE", "zh-CN"], null)).toBe("zh");
  });

  it("falls back to the default locale when nothing matches", () => {
    expect(resolveInitialLocale(["fr-FR"], null)).toBe("en");
  });

  it("falls back to the default locale for an empty device list", () => {
    expect(resolveInitialLocale([], null)).toBe("en");
  });

  it("is case-insensitive about the device tag", () => {
    expect(resolveInitialLocale(["ZH-CN"], null)).toBe("zh");
  });
});
