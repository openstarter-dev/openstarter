// apps/extension/src/lib/i18n.test.ts —— Tests for locale detection.
import { describe, expect, it, vi } from "vitest";

describe("getLocale", () => {
  it("exports a getLocale function", async () => {
    const { getLocale } = await import("./i18n");
    expect(getLocale).toBeDefined();
    expect(typeof getLocale).toBe("function");
  });
});