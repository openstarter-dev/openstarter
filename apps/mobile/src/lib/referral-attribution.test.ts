import { describe, expect, it, vi } from "vitest";

import {
  captureReferralAttribution,
  clearReferralAttribution,
  readStoredReferralCode,
} from "@/lib/referral-attribution";

vi.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    deleteItemAsync: (key: string) => {
      store.delete(key);
    },
  };
});

vi.mock("@/lib/api", () => ({
  apiClient: {},
}));

describe("referral-attribution (mobile)", () => {
  it("capture → read → 有效归因码", () => {
    captureReferralAttribution("REF1234");
    expect(readStoredReferralCode()).toBe("REF1234");
  });

  it("read 过期码返回 null", async () => {
    const { setItem } = await import("expo-secure-store");
    const past = Date.now() - 31 * 24 * 60 * 60 * 1000;
    setItem("openstarter_referral_code", JSON.stringify({ at: past, code: "OLD" }));
    expect(readStoredReferralCode()).toBeNull();
  });

  it("capture 损坏 JSON 后 read 返回 null", async () => {
    const { setItem } = await import("expo-secure-store");
    setItem("openstarter_referral_code", "not-json");
    expect(readStoredReferralCode()).toBeNull();
  });

  it("clear 后 read 返回 null", async () => {
    captureReferralAttribution("REF9999");
    await clearReferralAttribution();
    expect(readStoredReferralCode()).toBeNull();
  });
});
