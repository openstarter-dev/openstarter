import { describe, expect, it } from "vitest";

import { BillingProvider } from "./providers/types";
import { resolveBillingProvider } from "./resolve-provider";

describe("resolveBillingProvider", () => {
  it("defaults to revenuecat when env is unset", () => {
    expect(resolveBillingProvider({})).toBe(BillingProvider.REVENUECAT);
  });

  it("resolves each valid value", () => {
    expect(resolveBillingProvider({ EXPO_PUBLIC_BILLING_PROVIDER: "revenuecat" })).toBe(
      BillingProvider.REVENUECAT,
    );
    expect(resolveBillingProvider({ EXPO_PUBLIC_BILLING_PROVIDER: "superwall" })).toBe(
      BillingProvider.SUPERWALL,
    );
  });

  it("trims surrounding whitespace", () => {
    expect(resolveBillingProvider({ EXPO_PUBLIC_BILLING_PROVIDER: " superwall " })).toBe(
      BillingProvider.SUPERWALL,
    );
  });

  it("treats empty string as unset", () => {
    expect(resolveBillingProvider({ EXPO_PUBLIC_BILLING_PROVIDER: "   " })).toBe(
      BillingProvider.REVENUECAT,
    );
  });

  it("throws on unknown values, listing valid ones", () => {
    expect(() => resolveBillingProvider({ EXPO_PUBLIC_BILLING_PROVIDER: "wexin" })).toThrow(
      /EXPO_PUBLIC_BILLING_PROVIDER.*revenuecat.*superwall/,
    );
  });

  it("is case-sensitive (rejects mixed case)", () => {
    expect(() => resolveBillingProvider({ EXPO_PUBLIC_BILLING_PROVIDER: "RevenueCat" })).toThrow(
      /EXPO_PUBLIC_BILLING_PROVIDER/,
    );
  });
});
