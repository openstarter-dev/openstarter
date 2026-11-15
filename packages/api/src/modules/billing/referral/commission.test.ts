import { describe, expect, it } from "vitest";

import {
  calcCommissionCredits,
  CommissionStatus,
  DEFAULT_MIN_SETTLE_CREDITS,
  DEFAULT_REFERRAL_RATE_BPS,
  REFERRAL_RATE_MAX_BPS,
  resolveRate,
} from "./commission";

describe("resolveRate", () => {
  it("customRate 优先于全局默认", () => {
    expect(resolveRate(3000, 1000)).toBe(3000);
  });
  it("customRate 为 null/undefined 时用默认", () => {
    expect(resolveRate(null, 1000)).toBe(1000);
    expect(resolveRate(undefined, 1000)).toBe(1000);
  });
});

describe("calcCommissionCredits", () => {
  it("基本计算：100 元实付 × 10% = 10 积分（万分比 1000）", () => {
    expect(calcCommissionCredits(100, 1000)).toBe(10);
  });
  it("四舍五入：123 × 12.34% → round(123 × 1234 / 10000) = 15", () => {
    expect(calcCommissionCredits(123, 1234)).toBe(15);
  });
  it("非法输入返回 0（负数/NaN/零比例）", () => {
    expect(calcCommissionCredits(-100, 1000)).toBe(0);
    expect(calcCommissionCredits(Number.NaN, 1000)).toBe(0);
    expect(calcCommissionCredits(100, 0)).toBe(0);
  });
});

describe("constants", () => {
  it("status 枚举与默认分销常量", () => {
    expect(CommissionStatus.PENDING).toBe("pending");
    expect(CommissionStatus.SETTLED).toBe("settled");
    expect(CommissionStatus.VOID).toBe("void");
    expect(DEFAULT_REFERRAL_RATE_BPS).toBe(1000);
    expect(DEFAULT_MIN_SETTLE_CREDITS).toBe(100);
    expect(REFERRAL_RATE_MAX_BPS).toBe(5000);
  });
});
