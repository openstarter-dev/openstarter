import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  bindReferralAfterSignup,
  captureReferralAttribution,
  clearReferralAttribution,
  readStoredReferralCode,
} from "./referral-attribution";

const STORAGE_KEY = "ref:code";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

describe("referral 归因存储", () => {
  beforeEach(() => localStorage.clear());

  it("capture 存 { code, at }，read 返回 code", () => {
    captureReferralAttribution("abc123");
    expect(readStoredReferralCode()).toBe("abc123");
  });
  it("过期（>30 天）read 返回 null", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now() - TTL_MS - 1, code: "x" }));
    expect(readStoredReferralCode()).toBe(null);
  });
  it("损坏 JSON → null（不抛错）", () => {
    localStorage.setItem(STORAGE_KEY, "not json");
    expect(readStoredReferralCode()).toBe(null);
  });
  it("clear 清除", () => {
    captureReferralAttribution("abc");
    clearReferralAttribution();
    expect(readStoredReferralCode()).toBe(null);
  });
  it("bindReferralAfterSignup 有码时 POST /api/referral/bind", async () => {
    captureReferralAttribution("testcode");
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200 } as Response));
    await bindReferralAfterSignup();
    expect(fetch).toHaveBeenCalledWith(
      "/api/referral/bind",
      expect.objectContaining({
        body: JSON.stringify({ code: "testcode" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
    expect(readStoredReferralCode()).toBe(null);
  });
  it("bindReferralAfterSignup 无码时跳过", async () => {
    clearReferralAttribution();
    global.fetch = vi.fn(() => Promise.resolve({ ok: true } as Response));
    await bindReferralAfterSignup();
    expect(fetch).not.toHaveBeenCalled();
  });
});
