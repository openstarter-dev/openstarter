import { describe, it, expect, beforeEach, vi } from "vitest";

describe("env", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("should return API_BASE_URL when defined", async () => {
    (globalThis as any).API_BASE_URL = "https://api.example.com";
    const mod = await import("../../src/lib/env");
    expect(mod.getApiBaseUrl()).toBe("https://api.example.com");
  });

  it("should return fallback when undefined", async () => {
    (globalThis as any).API_BASE_URL = undefined;
    const mod = await import("../../src/lib/env");
    expect(mod.getApiBaseUrl()).toBe("http://localhost:3000");
  });
});
