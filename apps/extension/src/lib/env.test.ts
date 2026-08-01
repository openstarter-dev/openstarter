import { describe, expect, it } from "vitest";

import { resolveEnv } from "./env";

describe("resolveEnv", () => {
  it("returns ok with the parsed origin for a valid URL", () => {
    const result = resolveEnv("http://localhost:3000");

    expect(result).toEqual({
      appUrl: "http://localhost:3000",
      ok: true,
      origin: "http://localhost:3000",
    });
  });

  it("strips any path from the origin", () => {
    const result = resolveEnv("https://app.example.com/some/path");

    expect(result).toEqual({
      appUrl: "https://app.example.com/some/path",
      ok: true,
      origin: "https://app.example.com",
    });
  });

  it("fails when the value is undefined", () => {
    const result = resolveEnv(undefined);

    expect(result).toEqual({
      ok: false,
      reason: "VITE_APP_URL is not set",
    });
  });

  it("fails when the value is an empty string", () => {
    const result = resolveEnv("");

    expect(result).toEqual({
      ok: false,
      reason: "VITE_APP_URL is not set",
    });
  });

  it("fails when the value is not a valid URL", () => {
    const result = resolveEnv("not-a-url");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("not-a-url");
    }
  });
});
