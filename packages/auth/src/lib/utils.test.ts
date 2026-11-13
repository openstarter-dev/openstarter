import { afterEach, describe, expect, it, vi } from "vitest";

import { getAppUrl, isLoopbackAppUrl, mobileSchemeOrigin, parseOriginList } from "./utils";

const DEFAULT_APP_URL = "http://localhost:3000";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAppUrl", () => {
  it("strips trailing slashes", () => {
    vi.stubEnv("VITE_APP_URL", "https://openstarter.dev//");
    expect(getAppUrl()).toBe("https://openstarter.dev");
  });

  it("falls back to the default when unset", () => {
    vi.stubEnv("VITE_APP_URL", "");
    expect(getAppUrl()).toBe(DEFAULT_APP_URL);
  });

  it("treats a blank value as missing instead of returning an empty baseURL", () => {
    vi.stubEnv("VITE_APP_URL", "   ");
    expect(getAppUrl()).toBe(DEFAULT_APP_URL);
  });
});

describe("isLoopbackAppUrl", () => {
  it.each([
    "http://localhost:3000",
    "http://localhost",
    "https://localhost",
    "http://127.0.0.1:8080",
    "http://[::1]:3000",
  ])("treats %s as loopback", (url) => {
    expect(isLoopbackAppUrl(url)).toBe(true);
  });

  it.each([
    "https://openstarter.dev",
    "https://app.localhost.evil.com",
    "http://localhost.evil.com",
    "https://192.168.1.10:3000",
    "https://appleid.apple.com",
    "http://127.0.0.1.evil.com",
    "http://localhost:3000/",
  ])("does not treat %s as loopback", (url) => {
    expect(isLoopbackAppUrl(url)).toBe(false);
  });
});

describe("parseOriginList", () => {
  it("splits, trims and dedupes comma separated origins", () => {
    expect(parseOriginList(" https://a.com , https://b.com,,https://a.com ")).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
  });

  it("returns an empty list for missing values", () => {
    expect(parseOriginList(undefined)).toEqual([]);
    expect(parseOriginList("")).toEqual([]);
    expect(parseOriginList(" , ")).toEqual([]);
  });
});

describe("mobileSchemeOrigin", () => {
  it("builds the deep link origin from the configured scheme", () => {
    expect(mobileSchemeOrigin("openstarter")).toBe("openstarter://");
    expect(mobileSchemeOrigin(" MyApp ")).toBe("myapp://");
  });

  it("falls back to openstarter for blank or malformed schemes", () => {
    expect(mobileSchemeOrigin("")).toBe("openstarter://");
    expect(mobileSchemeOrigin(undefined)).toBe("openstarter://");
    expect(mobileSchemeOrigin("://bad scheme")).toBe("openstarter://");
  });
});
