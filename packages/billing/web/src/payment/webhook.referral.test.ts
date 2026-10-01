// Webhook → 分销记账挂载测试（db-backed，对齐 service.test.ts 的内存库注入模式）。
//
// 验证 handlePaymentEvent 在 checkout.success / payment.success(renewal) 路径下自动调用 recordCommission，
// 并在 commission 表生成 pending 记录。幂等性由 commission.orderNo 唯一约束兜底。

import type { Database } from "@openstarter/db/server";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";

import {
  commission,
  config,
  order,
  referral,
  referralRelation,
  subscription,
} from "@openstarter/db/schema";
import { getUuid } from "@openstarter/shared/id";

import { handlePaymentEvent } from "./webhook";
import {
  closeBillingTestDatabase,
  createBillingTestDatabase,
  resetBillingTestDatabase,
} from "../test/billing-test-database";
import { OrderStatus } from "./checkout";
import { PaymentEventType, SubscriptionCycleType } from "./types";

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

/** 在内存库中插入一条待支付订单（供 handleCheckoutSuccess 回关）。 */
async function seedOrder(orderNo: string, userId: string) {
  const db = state.database!;
  await db.insert(order).values({
    id: getUuid(),
    orderNo,
    userId,
    userEmail: `${userId}@test.com`,
    paymentProvider: "stripe",
    productId: "prod_123",
    productName: "Pro",
    amount: 2000,
    currency: "usd",
    status: OrderStatus.CREATED,
    checkoutInfo: "{}",
    description: "Pro Monthly",
    creditsAmount: 0,
    creditsValidDays: 0,
    paymentProductId: "prod_123",
    paymentUserId: userId,
  });
}

/** 构造 CHECKOUT_SUCCESS 事件（orderNo 匹配 seedOrder 插入的订单）。 */
function createCheckoutSuccessEvent(orderNo: string, paymentAmount: number) {
  return {
    eventType: PaymentEventType.CHECKOUT_SUCCESS,
    eventResult: null,
    paymentSession: {
      provider: "stripe",
      paymentStatus: "paid",
      paymentInfo: {
        paymentAmount,
        paymentCurrency: "usd",
        transactionId: `txn_${orderNo}`,
        paidAt: new Date(),
      },
      metadata: { order_no: orderNo },
    },
  } as const;
}

/** 构造 RENEWAL 事件（userB 订阅续费，orderNo: ORD_W2）。 */
function createRenewalEvent(orderNo: string, paymentAmount: number) {
  return {
    eventType: PaymentEventType.PAYMENT_SUCCESS,
    eventResult: null,
    paymentSession: {
      provider: "stripe",
      paymentStatus: "paid",
      paymentInfo: {
        paymentAmount,
        paymentCurrency: "usd",
        subscriptionCycleType: SubscriptionCycleType.RENEWAL,
        transactionId: `txn_${orderNo}`,
        paidAt: new Date(),
      },
      subscriptionId: "sub_123",
      subscriptionInfo: {
        subscriptionId: "sub_123",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "active",
      },
      metadata: { order_no: orderNo },
    },
  } as const;
}

/** 插入 subscription 记录供 handleSubscriptionRenewal 查找。 */
async function seedSubscription(subscriptionId: string, userId: string) {
  const db = state.database!;
  await db.insert(subscription).values({
    id: getUuid(),
    subscriptionNo: `SUB_${subscriptionId}`,
    userId,
    userEmail: `${userId}@test.com`,
    status: "active",
    paymentProvider: "stripe",
    subscriptionId,
    subscriptionResult: "{}",
    productId: "prod_123",
    description: "Pro Monthly",
    amount: 2000,
    currency: "usd",
    interval: "month",
    intervalCount: 1,
    trialPeriodDays: 0,
    currentPeriodStart: new Date(Date.now()),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    planName: "Pro",
    productName: "Pro Monthly",
    creditsAmount: 0,
    creditsValidDays: 0,
    paymentProductId: "prod_123",
    paymentUserId: userId,
  });
}

// ─── 套件 ───────────────────────────────────────────────────────────────────────

describe("webhook → 分销记账挂载", () => {
  beforeAll(async () => {
    state.database = await createBillingTestDatabase("webhook-referral");
  });

  beforeEach(async () => {
    if (state.database) {
      await resetBillingTestDatabase(state.database);
    }
  });

  it("checkout success → commission 表出现 pending 记录", async () => {
    await seedReferralFixture();
    await seedOrder("ORD_W1", "userB");
    const db = state.database!;

    const event = createCheckoutSuccessEvent("ORD_W1", 2000);
    await handlePaymentEvent(event, "stripe");

    const rows = await db.select().from(commission);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.commissionCredits).toBe(200); // 2000 × 10%
    expect(rows[0]!.status).toBe("pending");
    expect(rows[0]!.orderNo).toBe("ORD_W1");
    expect(rows[0]!.referredUserId).toBe("userB");
    expect(rows[0]!.referrerId).toBe("userA");
    expect(rows[0]!.rate).toBe(1000); // 默认比例
    expect(rows[0]!.baseAmount).toBe(2000);
    expect(rows[0]!.baseCurrency).toBe("usd");
  });

  it("webhook 重试（同事件重投）→ 不重复记账", async () => {
    await seedReferralFixture();
    await seedOrder("ORD_W1", "userB");
    const db = state.database!;

    const event = createCheckoutSuccessEvent("ORD_W1", 2000);
    await handlePaymentEvent(event, "stripe");
    await handlePaymentEvent(event, "stripe"); // 重复投递

    const rows = await db.select().from(commission);
    expect(rows).toHaveLength(1);
  });

  it("续费事件 → 也记账", async () => {
    await seedReferralFixture();
    await seedSubscription("sub_123", "userB");
    const db = state.database!;

    const event = createRenewalEvent("ORD_W2", 2000);
    await handlePaymentEvent(event, "stripe");

    const rows = await db.select().from(commission);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("pending");
    expect(rows[0]!.commissionCredits).toBe(200);
    expect(rows[0]!.referredUserId).toBe("userB");
    expect(rows[0]!.referrerId).toBe("userA");
    expect(rows[0]!.orderNo).toMatch(/^REN/);
  });

  it("代理 customRate=3000 → 按覆盖比例记账", async () => {
    await seedReferralFixture({ customRate: 3000 });
    await seedOrder("ORD_W3", "userB");
    const db = state.database!;

    const event = createCheckoutSuccessEvent("ORD_W3", 1000);
    await handlePaymentEvent(event, "stripe");

    const rows = await db.select().from(commission);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rate).toBe(3000);
    expect(rows[0]!.commissionCredits).toBe(300); // 1000 × 30%
  });

  afterAll(() => {
    if (state.database) {
      closeBillingTestDatabase(state.database);
    }
  });
});
