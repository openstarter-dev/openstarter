// 分销记账服务测试（db-backed，对齐同包 subscriptions.property.test.ts 的内存库注入模式）。
//
// 通过 vi.mock("@openstarter/db/server") 将 db() 重定向到内存 sqlite，再走正常 drizzle
// 查询断言 recordCommission 的记账行为（幂等 / 旁路 / 代理比例 / 关闭开关等）。

import type { Database } from "@openstarter/db/server";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";

import { commission, config, referral, referralRelation } from "@openstarter/db/schema";
import { getUuid } from "@openstarter/shared/id";

import { recordCommission } from "./service";
import {
  closeBillingTestDatabase,
  createBillingTestDatabase,
  resetBillingTestDatabase,
} from "../test/billing-test-database";

// ─── 测试夹具状态 ────────────────────────────────────────────────────────────────

const state = vi.hoisted(() => ({
  database: undefined as Database | undefined,
}));

vi.mock("@openstarter/db/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@openstarter/db/server")>();
  return {
    ...actual,
    db: () => {
      if (!state.database) {
        throw new Error("billing test database not initialized");
      }
      return state.database;
    },
  };
});

/** 在内存库中插入 userA(referrer) + userB(referred) + 推荐关系 + 默认 enabled 配置。 */
async function seedReferralFixture(
  overrides: {
    config?: { enabled: boolean; defaultRate: number };
    customRate?: number | null;
  } = {},
) {
  const db = state.database!;
  // 推荐人 A 的 referral 行
  await db.insert(referral).values({
    code: "abc",
    customRate: overrides.customRate ?? null,
    id: getUuid(),
    userId: "userA",
  });
  // 被推荐人 B 的关系
  await db.insert(referralRelation).values({
    code: "abc",
    id: getUuid(),
    referrerId: "userA",
    referredUserId: "userB",
  });
  // 分销配置
  await db.insert(config).values({
    name: "referral",
    value: JSON.stringify(
      overrides.config ?? { enabled: true, defaultRate: 1000, minSettleCredits: 100 },
    ),
  });
}

// ─── 套件 ───────────────────────────────────────────────────────────────────────

describe("recordCommission", () => {
  beforeAll(async () => {
    state.database = await createBillingTestDatabase("referral-service");
  });

  beforeEach(async () => {
    if (state.database) {
      await resetBillingTestDatabase(state.database);
    }
  });

  it("有推荐关系 + 已启用 → 记 pending 佣金", async () => {
    await seedReferralFixture();
    const tx = state.database!;
    await recordCommission(tx, {
      orderNo: "ORD1",
      paymentAmount: 1000,
      paymentCurrency: "usd",
      userId: "userB",
    });
    const rows = await tx.select().from(commission);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("pending");
    expect(rows[0]!.commissionCredits).toBe(100); // 1000 × 1000bps / 10000
  });

  it("同 orderNo 重试 → 幂等不重复记账", async () => {
    await seedReferralFixture();
    const tx = state.database!;
    await recordCommission(tx, {
      orderNo: "ORD1",
      paymentAmount: 1000,
      paymentCurrency: "usd",
      userId: "userB",
    });
    await recordCommission(tx, {
      orderNo: "ORD1",
      paymentAmount: 1000,
      paymentCurrency: "usd",
      userId: "userB",
    });
    const rows = await tx.select().from(commission);
    expect(rows).toHaveLength(1);
  });

  it("无推荐关系 → 不记账", async () => {
    await seedReferralFixture();
    const tx = state.database!;
    await recordCommission(tx, {
      orderNo: "ORD2",
      paymentAmount: 1000,
      paymentCurrency: "usd",
      userId: "userC",
    });
    expect(await tx.select().from(commission)).toHaveLength(0);
  });

  it("enabled=false → 不记账", async () => {
    await seedReferralFixture({ config: { enabled: false, defaultRate: 1000 } });
    const tx = state.database!;
    await recordCommission(tx, {
      orderNo: "ORD3",
      paymentAmount: 1000,
      paymentCurrency: "usd",
      userId: "userB",
    });
    expect(await tx.select().from(commission)).toHaveLength(0);
  });

  it("paymentAmount 为 null → 不记账", async () => {
    await seedReferralFixture();
    const tx = state.database!;
    await recordCommission(tx, {
      orderNo: "ORD4",
      paymentAmount: null,
      paymentCurrency: "usd",
      userId: "userB",
    });
    expect(await tx.select().from(commission)).toHaveLength(0);
  });

  it("代理 customRate=3000 → 按覆盖比例记账", async () => {
    await seedReferralFixture({ customRate: 3000 });
    const tx = state.database!;
    await recordCommission(tx, {
      orderNo: "ORD5",
      paymentAmount: 1000,
      paymentCurrency: "usd",
      userId: "userB",
    });
    const rows = await tx.select().from(commission);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rate).toBe(3000);
    expect(rows[0]!.commissionCredits).toBe(300);
  });

  it("记账异常不抛出（旁路）", async () => {
    await seedReferralFixture();
    const badTx = {
      insert: vi.fn(() => {
        throw new Error("db down");
      }),
      select: vi.fn(() => {
        throw new Error("db down");
      }),
    };
    await expect(
      recordCommission(badTx as never, {
        orderNo: "ORD6",
        paymentAmount: 1,
        paymentCurrency: "usd",
        userId: "userB",
      }),
    ).resolves.toEqual({ reason: "error", skipped: true });
  });
});

afterAll(() => {
  if (state.database) {
    closeBillingTestDatabase(state.database);
  }
});
