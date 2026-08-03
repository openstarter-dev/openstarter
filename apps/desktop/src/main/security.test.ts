import { describe, expect, it, vi } from "vitest";

import {
  createPermissionRequestHandler,
  createWillNavigateHandler,
  createWindowOpenHandler,
  isAllowedNavigation,
} from "./security";

const ALLOWED_ORIGIN = "https://app.example.com";

describe("isAllowedNavigation", () => {
  it("allows the same origin", () => {
    expect(
      isAllowedNavigation("https://app.example.com/login", ALLOWED_ORIGIN)
    ).toBe(true);
  });

  it("allows the same origin with different casing", () => {
    expect(
      isAllowedNavigation("https://APP.EXAMPLE.COM/login", ALLOWED_ORIGIN)
    ).toBe(true);
  });

  it("rejects a subdomain", () => {
    expect(
      isAllowedNavigation("https://evil.app.example.com", ALLOWED_ORIGIN)
    ).toBe(false);
  });

  it("rejects a different protocol on the same host", () => {
    expect(isAllowedNavigation("http://app.example.com", ALLOWED_ORIGIN)).toBe(
      false
    );
  });

  it("rejects a different port", () => {
    expect(
      isAllowedNavigation("https://app.example.com:8443", ALLOWED_ORIGIN)
    ).toBe(false);
  });

  it("rejects javascript: URLs", () => {
    expect(isAllowedNavigation("javascript:alert(1)", ALLOWED_ORIGIN)).toBe(
      false
    );
  });

  it("rejects file: URLs", () => {
    expect(isAllowedNavigation("file:///etc/passwd", ALLOWED_ORIGIN)).toBe(
      false
    );
  });

  it("rejects data: URLs", () => {
    expect(isAllowedNavigation("data:text/html,hi", ALLOWED_ORIGIN)).toBe(
      false
    );
  });

  it("rejects an unparsable string without throwing", () => {
    expect(isAllowedNavigation("not a url", ALLOWED_ORIGIN)).toBe(false);
  });
});

describe("createWindowOpenHandler", () => {
  it("denies and forwards allowed-origin URLs to the external opener", () => {
    const openExternal = vi.fn();
    const handler = createWindowOpenHandler(openExternal);

    const result = handler({ url: "https://app.example.com/help" });

    expect(result).toEqual({ action: "deny" });
    expect(openExternal).toHaveBeenCalledWith("https://app.example.com/help");
  });

  it("denies and forwards external URLs to the external opener", () => {
    const openExternal = vi.fn();
    const handler = createWindowOpenHandler(openExternal);

    const result = handler({ url: "https://accounts.google.com/oauth" });

    expect(result).toEqual({ action: "deny" });
    expect(openExternal).toHaveBeenCalledWith(
      "https://accounts.google.com/oauth"
    );
  });
});

describe("createWillNavigateHandler", () => {
  it("does not prevent navigation within the allowed origin", () => {
    const openExternal = vi.fn();
    const preventDefault = vi.fn();
    const handler = createWillNavigateHandler(ALLOWED_ORIGIN, openExternal);

    handler({ preventDefault }, "https://app.example.com/settings");

    expect(preventDefault).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("prevents navigation outside the allowed origin and opens it externally", () => {
    const openExternal = vi.fn();
    const preventDefault = vi.fn();
    const handler = createWillNavigateHandler(ALLOWED_ORIGIN, openExternal);

    handler({ preventDefault }, "https://accounts.google.com/oauth");

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(openExternal).toHaveBeenCalledWith(
      "https://accounts.google.com/oauth"
    );
  });
});

describe("createPermissionRequestHandler", () => {
  it("denies every permission request", () => {
    const handler = createPermissionRequestHandler();
    const callback = vi.fn();

    handler({}, "notifications", callback);

    expect(callback).toHaveBeenCalledWith(false);
  });

  it("denies clipboard requests too", () => {
    const handler = createPermissionRequestHandler();
    const callback = vi.fn();

    handler({}, "clipboard-read", callback);

    expect(callback).toHaveBeenCalledWith(false);
  });
});
