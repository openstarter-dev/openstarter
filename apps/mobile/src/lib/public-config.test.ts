import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveEnabledProviders, resolvePasswordlessModes } from "./public-config";

describe("resolveEnabledProviders", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to email/password only when no env flags are set", () => {
    expect(resolveEnabledProviders({})).toEqual({
      emailPassword: true,
      passwordReset: false,
      socialProviders: [],
    });
  });

  it("reads process.env EXPO_PUBLIC flags by default", () => {
    vi.stubEnv("EXPO_PUBLIC_EMAIL_AUTH_ENABLED", "false");
    vi.stubEnv("EXPO_PUBLIC_GOOGLE_AUTH_ENABLED", "true");
    vi.stubEnv("EXPO_PUBLIC_APPLE_AUTH_ENABLED", "true");
    vi.stubEnv("EXPO_PUBLIC_PASSWORD_RESET_ENABLED", "true");

    expect(resolveEnabledProviders()).toEqual({
      emailPassword: false,
      passwordReset: true,
      socialProviders: ["google", "apple"],
    });
  });

  it("gates email/password only when explicitly false", () => {
    expect(resolveEnabledProviders({ EXPO_PUBLIC_EMAIL_AUTH_ENABLED: "false" }).emailPassword).toBe(
      false,
    );
    expect(resolveEnabledProviders({ EXPO_PUBLIC_EMAIL_AUTH_ENABLED: "true" }).emailPassword).toBe(
      true,
    );
  });

  it("enables social providers only for exact string 'true'", () => {
    expect(
      resolveEnabledProviders({ EXPO_PUBLIC_GOOGLE_AUTH_ENABLED: "true" }).socialProviders,
    ).toEqual(["google"]);
    for (const value of ["1", "yes", "false", "", "TRUE"]) {
      expect(
        resolveEnabledProviders({ EXPO_PUBLIC_GOOGLE_AUTH_ENABLED: value }).socialProviders,
      ).toEqual([]);
    }
    expect(
      resolveEnabledProviders({
        EXPO_PUBLIC_APPLE_AUTH_ENABLED: "true",
        EXPO_PUBLIC_GOOGLE_AUTH_ENABLED: "true",
      }).socialProviders,
    ).toEqual(["google", "apple"]);
  });

  it("toggles password reset visibility via explicit 'true'", () => {
    expect(
      resolveEnabledProviders({ EXPO_PUBLIC_PASSWORD_RESET_ENABLED: "true" }).passwordReset,
    ).toBe(true);
    expect(
      resolveEnabledProviders({ EXPO_PUBLIC_PASSWORD_RESET_ENABLED: "false" }).passwordReset,
    ).toBe(false);
  });
});

describe("resolvePasswordlessModes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("disables all passwordless modes by default", () => {
    expect(resolvePasswordlessModes({})).toEqual({ emailOtp: false, magicLink: false });
  });

  it("enables magic link or email otp only for exact string 'true'", () => {
    expect(resolvePasswordlessModes({ EXPO_PUBLIC_MAGIC_LINK_ENABLED: "true" }).magicLink).toBe(
      true,
    );
    expect(resolvePasswordlessModes({ EXPO_PUBLIC_EMAIL_OTP_ENABLED: "true" }).emailOtp).toBe(true);
    for (const value of ["1", "false", "", "TRUE"]) {
      expect(resolvePasswordlessModes({ EXPO_PUBLIC_MAGIC_LINK_ENABLED: value }).magicLink).toBe(
        false,
      );
      expect(resolvePasswordlessModes({ EXPO_PUBLIC_EMAIL_OTP_ENABLED: value }).emailOtp).toBe(
        false,
      );
    }
  });
});
