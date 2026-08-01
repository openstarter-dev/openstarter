import { describe, expect, it } from "vitest";

import { getDesktopMode, isUpdaterDisabled, resolveAppUrl } from "./config";

describe("getDesktopMode", () => {
  it("returns dev when not packaged", () => {
    expect(getDesktopMode(false)).toBe("dev");
  });

  it("returns prod when packaged", () => {
    expect(getDesktopMode(true)).toBe("prod");
  });
});

describe("resolveAppUrl", () => {
  it("prefers the runtime env override over the build-time URL", () => {
    const result = resolveAppUrl({
      buildTimeUrl: "https://build-time.example.com",
      env: { OPENSTARTER_DESKTOP_APP_URL: "https://runtime.example.com" },
      isPackaged: true,
    });

    expect(result).toEqual({ ok: true, url: "https://runtime.example.com/" });
  });

  it("falls back to the build-time URL when no runtime override is set", () => {
    const result = resolveAppUrl({
      buildTimeUrl: "https://build-time.example.com",
      env: {},
      isPackaged: true,
    });

    expect(result).toEqual({
      ok: true,
      url: "https://build-time.example.com/",
    });
  });

  it("normalizes a URL without a trailing slash", () => {
    const result = resolveAppUrl({
      buildTimeUrl: "https://example.com",
      env: {},
      isPackaged: true,
    });

    expect(result).toEqual({ ok: true, url: "https://example.com/" });
  });

  it("rejects a non-http(s) protocol", () => {
    const result = resolveAppUrl({
      buildTimeUrl: "file:///etc/passwd",
      env: {},
      isPackaged: true,
    });

    expect(result.ok).toBe(false);
  });

  it("rejects an unparsable string", () => {
    const result = resolveAppUrl({
      buildTimeUrl: "not a url",
      env: {},
      isPackaged: true,
    });

    expect(result.ok).toBe(false);
  });

  it("falls back to localhost:3000 in dev when nothing resolves", () => {
    const result = resolveAppUrl({
      buildTimeUrl: "",
      env: {},
      isPackaged: false,
    });

    expect(result).toEqual({ ok: true, url: "http://localhost:3000/" });
  });

  it("returns a failure result in prod when nothing resolves, without throwing", () => {
    const result = resolveAppUrl({
      buildTimeUrl: "",
      env: {},
      isPackaged: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("prefers a valid runtime override even if the build-time URL is invalid", () => {
    const result = resolveAppUrl({
      buildTimeUrl: "not a url",
      env: { OPENSTARTER_DESKTOP_APP_URL: "https://runtime.example.com" },
      isPackaged: true,
    });

    expect(result).toEqual({ ok: true, url: "https://runtime.example.com/" });
  });

  it("falls back to the build-time URL when the runtime override is invalid", () => {
    const result = resolveAppUrl({
      buildTimeUrl: "https://build-time.example.com",
      env: { OPENSTARTER_DESKTOP_APP_URL: "not a url" },
      isPackaged: true,
    });

    expect(result).toEqual({
      ok: true,
      url: "https://build-time.example.com/",
    });
  });
});

describe("isUpdaterDisabled", () => {
  it("is false when the env var is unset", () => {
    expect(isUpdaterDisabled({})).toBe(false);
  });

  it("is true when the env var is 'true'", () => {
    expect(
      isUpdaterDisabled({ OPENSTARTER_DESKTOP_DISABLE_UPDATER: "true" })
    ).toBe(true);
  });

  it("is false for any other value", () => {
    expect(
      isUpdaterDisabled({ OPENSTARTER_DESKTOP_DISABLE_UPDATER: "false" })
    ).toBe(false);
    expect(
      isUpdaterDisabled({ OPENSTARTER_DESKTOP_DISABLE_UPDATER: "1" })
    ).toBe(false);
  });
});
