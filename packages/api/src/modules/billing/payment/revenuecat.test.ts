// RevenueCat webhook 模块测试（验签 + 事件映射）。
//
// 验签：按 RC 官方协议 —— `X-RevenueCat-Webhook-Signature: t=<unix秒>,v1=<hex HMAC-SHA256>`，
// HMAC 以 webhook signing secret 对 "<t>.<rawBody>"（原始字节）计算。
// 事件映射：表驱动断言 8 类 RC 事件 → 归一化 PaymentEvent；INITIAL_PURCHASE 先合成
// created 订单再交 handlePaymentEvent（建订阅+授积分+置 paid 全部复用既有编排）。

import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handlePaymentEventMock } from "./test-doubles";

vi.mock("./webhook", async () => {
  const actual = await vi.importActual<typeof import("./webhook")>("./webhook");
  return {
    ...actual,
    handlePaymentEvent: (...args: unknown[]) => handlePaymentEventMock(...args),
  };
});

// mock 订单/用户查询与插入：INITIAL_PURCHASE 幂等预检与订单合成需要 db。
// select 链按查询表区分：order 表走 existingOrders，user 表走 existingUsers。
const dbState = vi.hoisted(() => ({
  existingOrders: [] as Array<Record<string, unknown>>,
  existingUsers: [] as Array<Record<string, unknown>>,
  insertedOrders: [] as Array<Record<string, unknown>>,
  lastQueriedTable: "" as string,
}));

vi.mock("@openstarter/db/server", () => ({
  db: () => ({
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        dbState.insertedOrders.push(row);
        return Promise.resolve();
      },
    }),
    select: () => ({
      from: (table: Record<symbol, unknown>) => {
        // drizzle 表对象带 Symbol(drizzle:Name) 标识。
        const name = String(table[Symbol.for("drizzle:Name")] ?? "unknown");
        dbState.lastQueriedTable = name;
        const rows = name === "user" ? dbState.existingUsers : dbState.existingOrders;
        return {
          where: () => ({
            limit: () => Promise.resolve(rows),
          }),
        };
      },
    }),
  }),
}));

import { mapRevenueCatEvent, verifyRevenueCatWebhook } from "./revenuecat";

const SECRET = "whsec_test_secret";

// 注入测试 resolver：任何商品 ID 反查到 pro_monthly 目录条目（金额/积分与真实目录一致）。
import { configureRevenueCatProducts } from "./revenuecat";
configureRevenueCatProducts((iapProductId) => ({
  amount: 2900,
  credits: 50_000,
  currency: "usd",
  interval: "month",
  intervalCount: 1,
  planName: "Pro",
  productId: "pro_monthly",
  productName: "Pro",
  ...(iapProductId ? {} : {}),
}));

/** 以测试 secret 为指定 body 生成合法签名头。 */
function signBody(t: number, rawBody: string): string {
  const v1 = createHmac("sha256", SECRET).update(`${t}.${rawBody}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

const RAW_BODY = JSON.stringify({
  event: {
    type: "INITIAL_PURCHASE",
    app_user_id: "user-1",
    transaction_id: "txn_100",
    original_transaction_id: "orig_100",
    product_id: "pro_monthly",
    purchased_at_ms: 1_700_000_000_000,
    expiration_at_ms: 1_700_259_200_000,
    period_type: "NORMAL",
    price: 29,
    currency: "USD",
  },
});

beforeEach(() => {
  handlePaymentEventMock.mockReset();
  dbState.existingOrders = [];
  dbState.existingUsers = [];
  dbState.insertedOrders = [];
  dbState.lastQueriedTable = "";
});

describe("verifyRevenueCatWebhook", () => {
  // 固定时间戳会被 5 分钟容差拒绝，故合法签名用「当前时间」生成；
  // 过期/篡改等反例另行构造。
  const NOW_T = () => Math.floor(Date.now() / 1000);

  it("accepts a valid signature over the raw body", () => {
    const header = signBody(NOW_T(), RAW_BODY);
    expect(verifyRevenueCatWebhook({ rawBody: RAW_BODY, secret: SECRET, signature: header })).toBe(
      true,
    );
  });

  it("rejects a tampered body (signature over different bytes)", () => {
    const header = signBody(NOW_T(), RAW_BODY);
    expect(
      verifyRevenueCatWebhook({ rawBody: `${RAW_BODY} `, secret: SECRET, signature: header }),
    ).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const header = signBody(NOW_T(), RAW_BODY);
    expect(
      verifyRevenueCatWebhook({
        rawBody: RAW_BODY,
        secret: "whsec_other",
        signature: header,
      }),
    ).toBe(false);
  });

  it("rejects a stale timestamp even with a valid HMAC (fixed-time body)", () => {
    // 用 2023 年的固定时间戳签名：HMAC 本身合法，但超出容差 → 拒绝。
    const header = signBody(1_700_000_000, RAW_BODY);
    expect(verifyRevenueCatWebhook({ rawBody: RAW_BODY, secret: SECRET, signature: header })).toBe(
      false,
    );
  });

  it("rejects a malformed header (missing t or v1)", () => {
    expect(
      verifyRevenueCatWebhook({ rawBody: RAW_BODY, secret: SECRET, signature: "v1=abc" }),
    ).toBe(false);
    expect(verifyRevenueCatWebhook({ rawBody: RAW_BODY, secret: SECRET, signature: "t=123" })).toBe(
      false,
    );
  });

  it("rejects an empty signature", () => {
    expect(verifyRevenueCatWebhook({ rawBody: RAW_BODY, secret: SECRET, signature: "" })).toBe(
      false,
    );
  });

  it("rejects a timestamp older than the 5-minute tolerance (replay guard)", () => {
    const oldT = Math.floor(Date.now() / 1000) - 6 * 60;
    const header = signBody(oldT, RAW_BODY);
    expect(verifyRevenueCatWebhook({ rawBody: RAW_BODY, secret: SECRET, signature: header })).toBe(
      false,
    );
  });

  it("accepts a timestamp within the tolerance", () => {
    const recentT = Math.floor(Date.now() / 1000) - 60;
    const header = signBody(recentT, RAW_BODY);
    expect(verifyRevenueCatWebhook({ rawBody: RAW_BODY, secret: SECRET, signature: header })).toBe(
      true,
    );
  });
});

describe("mapRevenueCatEvent", () => {
  function rcEvent(type: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      event: {
        app_user_id: "user-1",
        original_transaction_id: "orig_100",
        product_id: "pro_monthly",
        transaction_id: "txn_100",
        type,
        ...extra,
      },
    };
  }

  it("INITIAL_PURCHASE synthesizes a created order then emits payment.success (create)", async () => {
    // 用户表按 app_user_id 归属订单：先登记 user-1。
    dbState.existingUsers = [{ id: "user-1" }];
    await mapRevenueCatEvent(
      rcEvent("INITIAL_PURCHASE", {
        purchased_at_ms: 1_700_000_000_000,
        expiration_at_ms: 1_700_259_200_000,
      }),
    );

    // 订单合成：金额取目录（2900 分）、provider 固定 revenuecat。
    expect(dbState.insertedOrders).toHaveLength(1);
    const inserted = dbState.insertedOrders[0] as Record<string, unknown>;
    expect(inserted.paymentProvider).toBe("revenuecat");
    expect(inserted.paymentType).toBe("subscription");
    expect(inserted.paymentSessionId).toBe("txn_100");
    expect(inserted.subscriptionId).toBe("orig_100");
    expect(inserted.amount).toBe(2900);
    expect(inserted.currency).toBe("usd");
    expect(inserted.productId).toBe("pro_monthly");
    expect(inserted.creditsAmount).toBe(50_000);
    expect(inserted.userId).toBe("user-1");
    expect(String(inserted.orderNo)).toMatch(/^ORD/);

    // 归一化事件交给既有编排。
    expect(handlePaymentEventMock).toHaveBeenCalledTimes(1);
    const [event, provider] = handlePaymentEventMock.mock.calls[0] as [
      { eventType: string; paymentSession?: Record<string, unknown> },
      string,
    ];
    expect(provider).toBe("revenuecat");
    expect(event.eventType).toBe("payment.success");
    expect(event.paymentSession?.paymentStatus).toBe("paid");
    expect(event.paymentSession?.subscriptionId).toBe("orig_100");
  });

  it("INITIAL_PURCHASE dedupes by (transactionId, provider) — existing order skips synthesis", async () => {
    dbState.existingOrders = [{ id: "order-existing" }];
    await mapRevenueCatEvent(rcEvent("INITIAL_PURCHASE"));

    expect(dbState.insertedOrders).toHaveLength(0);
    expect(handlePaymentEventMock).not.toHaveBeenCalled();
  });

  it("INITIAL_PURCHASE with unknown app_user_id is skipped (no order, no event)", async () => {
    // 用户表查询返回空：无法归属 → 跳过。
    await mapRevenueCatEvent(rcEvent("INITIAL_PURCHASE"));
    expect(dbState.insertedOrders).toHaveLength(0);
    expect(handlePaymentEventMock).not.toHaveBeenCalled();
  });

  it("RENEWAL emits payment.success with renew cycle, no order synthesis", async () => {
    await mapRevenueCatEvent(
      rcEvent("RENEWAL", {
        expiration_at_ms: 1_700_518_400_000,
        purchased_at_ms: 1_700_259_200_000,
      }),
    );

    expect(dbState.insertedOrders).toHaveLength(0);
    const [event] = handlePaymentEventMock.mock.calls[0] as [
      { eventType: string; paymentSession?: Record<string, unknown> },
    ];
    expect(event.eventType).toBe("payment.success");
    expect(
      (event.paymentSession?.paymentInfo as Record<string, unknown>)?.subscriptionCycleType,
    ).toBe("renew");
  });

  it("CANCELLATION emits subscribe.updated with pending_cancel and canceledEndAt", async () => {
    await mapRevenueCatEvent(
      rcEvent("CANCELLATION", {
        expiration_at_ms: 1_700_259_200_000,
      }),
    );

    const [event] = handlePaymentEventMock.mock.calls[0] as [
      { eventType: string; paymentSession?: Record<string, unknown> },
    ];
    expect(event.eventType).toBe("subscribe.updated");
    const info = event.paymentSession?.subscriptionInfo as Record<string, unknown>;
    expect(info.status).toBe("pending_cancel");
    expect(info.canceledEndAt).toEqual(new Date(1_700_259_200_000));
  });

  it("UNCANCELLATION emits subscribe.updated with active status", async () => {
    await mapRevenueCatEvent(rcEvent("UNCANCELLATION"));

    const [event] = handlePaymentEventMock.mock.calls[0] as [
      { eventType: string; paymentSession?: Record<string, unknown> },
    ];
    expect(event.eventType).toBe("subscribe.updated");
    const uncanceledInfo = event.paymentSession?.subscriptionInfo as Record<string, unknown>;
    expect(uncanceledInfo.status).toBe("active");
  });

  it("EXPIRATION emits subscribe.canceled", async () => {
    await mapRevenueCatEvent(rcEvent("EXPIRATION"));

    const [event] = handlePaymentEventMock.mock.calls[0] as [{ eventType: string }];
    expect(event.eventType).toBe("subscribe.canceled");
  });

  it("SUBSCRIPTION_PAUSED emits subscribe.updated with paused status", async () => {
    await mapRevenueCatEvent(rcEvent("SUBSCRIPTION_PAUSED"));

    const [event] = handlePaymentEventMock.mock.calls[0] as [
      { eventType: string; paymentSession?: Record<string, unknown> },
    ];
    const pausedInfo = event.paymentSession?.subscriptionInfo as Record<string, unknown>;
    expect(pausedInfo.status).toBe("paused");
  });

  it("TRIAL period maps the initial purchase to trialing status", async () => {
    dbState.existingUsers = [{ id: "user-1" }];
    await mapRevenueCatEvent(
      rcEvent("INITIAL_PURCHASE", {
        expiration_at_ms: 1_700_259_200_000,
        period_type: "TRIAL",
        purchased_at_ms: 1_700_000_000_000,
      }),
    );

    const [event] = handlePaymentEventMock.mock.calls[0] as [
      { eventType: string; paymentSession?: Record<string, unknown> },
    ];
    const info = event.paymentSession?.subscriptionInfo as Record<string, unknown>;
    expect(info.status).toBe("trialing");
  });

  it("unknown or no-op events (TEST, BILLING_ISSUE) produce no synthesis and no event", async () => {
    await mapRevenueCatEvent(rcEvent("TEST"));
    await mapRevenueCatEvent(rcEvent("BILLING_ISSUE"));

    expect(dbState.insertedOrders).toHaveLength(0);
    expect(handlePaymentEventMock).not.toHaveBeenCalled();
  });
});
