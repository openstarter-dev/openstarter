// apps/desktop/src/main/oauth-window.test.ts —— OAuth 窗口纯函数测试

import { describe, it, expect } from "vitest";
import { buildOAuthUrl, extractTokenFromCookies } from "./oauth-window";

describe("buildOAuthUrl", () => {
  it("should build URL with provider and callback", () => {
    const url = buildOAuthUrl(
      "http://localhost:3000",
      "google",
      "openstarter://oauth-callback"
    );

    expect(url).toContain("/api/auth/sign-in/social");
    expect(url).toContain("provider=google");
    expect(url).toContain("callbackURL=openstarter%3A%2F%2Foauth-callback");
    expect(url).toContain("errorCallbackURL=openstarter%3A%2F%2Foauth-callback");
  });

  it("should support github provider", () => {
    const url = buildOAuthUrl(
      "http://localhost:3000",
      "github",
      "openstarter://oauth-callback"
    );

    expect(url).toContain("provider=github");
  });
});

describe("extractTokenFromCookies", () => {
  it("should extract session token from cookies", () => {
    const cookies = [
      { name: "openstarter.session_token", value: "signed-token-123" },
      { name: "other-cookie", value: "unrelated" },
    ];

    expect(extractTokenFromCookies(cookies)).toBe("signed-token-123");
  });

  it("should return null when no session cookie", () => {
    const cookies = [{ name: "other-cookie", value: "unrelated" }];

    expect(extractTokenFromCookies(cookies)).toBeNull();
  });

  it("should return null for empty cookies", () => {
    expect(extractTokenFromCookies([])).toBeNull();
  });
});