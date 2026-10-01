import { describe, expect, it } from "vitest";

// drizzle 表对象内部列集合经 symbol 键取值，tsc 严格模式要求先收窄为 symbol 索引记录。
const columnsOf = (table: unknown): Record<string, unknown> =>
  (table as Record<symbol, unknown>)[Symbol.for("drizzle:Columns")] as Record<string, unknown>;

// 经 barrel 导入：active 方言（默认 sqlite）三表必须同名导出。
import { commission, referral, referralRelation } from "./schema.sqlite";
import {
  commission as pgCommission,
  referral as pgReferral,
  referralRelation as pgReferralRelation,
} from "./schema.postgres";
import {
  commission as mysqlCommission,
  referral as mysqlReferral,
  referralRelation as mysqlReferralRelation,
} from "./schema.mysql";

describe("referral schema 表结构", () => {
  it("referral: userId/code 唯一约束存在", () => {
    const sql = columnsOf(referral);
    expect(sql).toBeTruthy();
    // drizzle 表对象可解构列名集合做存在性断言
    expect(Object.keys(sql)).toEqual(
      expect.arrayContaining([
        "id",
        "userId",
        "code",
        "customRate",
        "note",
        "createdAt",
        "updatedAt",
      ]),
    );
  });

  it("referralRelation: 一人一条关系（referredUserId 唯一）", () => {
    const sql = columnsOf(referralRelation);
    expect(Object.keys(sql)).toEqual(
      expect.arrayContaining(["id", "referrerId", "referredUserId", "code", "createdAt"]),
    );
  });

  it("commission: 幂等键 orderNo 与状态字段存在", () => {
    const sql = columnsOf(commission);
    expect(Object.keys(sql)).toEqual(
      expect.arrayContaining([
        "id",
        "orderNo",
        "referrerId",
        "referredUserId",
        "baseAmount",
        "baseCurrency",
        "rate",
        "commissionCredits",
        "cashAmount",
        "status",
        "settledAt",
        "settledBy",
        "transactionNo",
        "note",
        "createdAt",
        "updatedAt",
      ]),
    );
  });
});

describe("referral schema 表结构（postgres）", () => {
  it("referral: userId/code 唯一约束存在", () => {
    const sql = columnsOf(pgReferral);
    expect(sql).toBeTruthy();
    expect(Object.keys(sql)).toEqual(
      expect.arrayContaining([
        "id",
        "userId",
        "code",
        "customRate",
        "note",
        "createdAt",
        "updatedAt",
      ]),
    );
  });

  it("referralRelation: 一人一条关系（referredUserId 唯一）", () => {
    const sql = columnsOf(pgReferralRelation);
    expect(Object.keys(sql)).toEqual(
      expect.arrayContaining(["id", "referrerId", "referredUserId", "code", "createdAt"]),
    );
  });

  it("commission: 幂等键 orderNo 与状态字段存在", () => {
    const sql = columnsOf(pgCommission);
    expect(Object.keys(sql)).toEqual(
      expect.arrayContaining([
        "id",
        "orderNo",
        "referrerId",
        "referredUserId",
        "baseAmount",
        "baseCurrency",
        "rate",
        "commissionCredits",
        "cashAmount",
        "status",
        "settledAt",
        "settledBy",
        "transactionNo",
        "note",
        "createdAt",
        "updatedAt",
      ]),
    );
  });
});

describe("referral schema 表结构（mysql）", () => {
  it("referral: userId/code 唯一约束存在", () => {
    const sql = columnsOf(mysqlReferral);
    expect(sql).toBeTruthy();
    expect(Object.keys(sql)).toEqual(
      expect.arrayContaining([
        "id",
        "userId",
        "code",
        "customRate",
        "note",
        "createdAt",
        "updatedAt",
      ]),
    );
  });

  it("referralRelation: 一人一条关系（referredUserId 唯一）", () => {
    const sql = columnsOf(mysqlReferralRelation);
    expect(Object.keys(sql)).toEqual(
      expect.arrayContaining(["id", "referrerId", "referredUserId", "code", "createdAt"]),
    );
  });

  it("commission: 幂等键 orderNo 与状态字段存在", () => {
    const sql = columnsOf(mysqlCommission);
    expect(Object.keys(sql)).toEqual(
      expect.arrayContaining([
        "id",
        "orderNo",
        "referrerId",
        "referredUserId",
        "baseAmount",
        "baseCurrency",
        "rate",
        "commissionCredits",
        "cashAmount",
        "status",
        "settledAt",
        "settledBy",
        "transactionNo",
        "note",
        "createdAt",
        "updatedAt",
      ]),
    );
  });
});
