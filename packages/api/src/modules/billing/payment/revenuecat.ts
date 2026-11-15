// RevenueCat webhook 模块（验签 + 事件映射 → 既有编排管线）。
//
// 定位：RC 是「商店代扣集成」，不是支付渠道 —— PaymentProvider 的必备方法
// （createPayment/getPaymentSession）对它无意义，故不进 PaymentManager，本模块
// 与四渠道并列，仅提供两个纯能力：
//   1. verifyRevenueCatWebhook：HMAC 验签（RC 官方协议 ——
//      头 `X-RevenueCat-Webhook-Signature: t=<unix秒>,v1=<hex HMAC-SHA256>`，
//      对 "<t>.<rawBody>" 原始字节计算；timingSafeEqual + 5 分钟时间容差防重放）。
//   2. mapRevenueCatEvent：把 RC 事件映射为归一化 PaymentEvent 交给既有
//      handlePaymentEvent 编排 —— 首期先合成 created 订单（幂等按
//      (transactionId, paymentProvider) 预检），建订阅+授积分+置 paid 的单事务、
//      续费去重等业务逻辑全部复用 webhook.ts，零重复实现。
//
// 金额/积分一律取服务端产品目录（server-side pricing 唯一事实来源）；RC 回报的
// 原始金额仅存 paymentResult 供审计。app_user_id 即 better-auth userId（移动端
// Purchases.logIn(user.id) 注入），查无此人则记日志跳过（无法归属）。

import { createHmac, timingSafeEqual } from "node:crypto";

import { type NewOrder, order, user } from "../../../db/schema";
import { db } from "../../../db/server";
import { getUniSeq, getUuid } from "@openstarter/shared/id";
import { logger } from "@openstarter/shared/logger";
import { eq } from "../../../db/orm";

import { ORDER_NO_METADATA_KEY, OrderStatus } from "./checkout";
import {
  type PaymentEvent,
  PaymentEventType,
  type PaymentInfo,
  type PaymentSession,
  PaymentStatus,
  PaymentType,
  type SubscriptionInfo,
  SubscriptionCycleType,
  SubscriptionStatus,
} from "./types";
import { handlePaymentEvent } from "./webhook";

/**
 * 商店商品 → 目录条目反查（由路由层注入，避免本包反向依赖 api 的产品目录）。
 * 金额/积分/周期的唯一事实来源是服务端目录；查不到（未上架商店）返回 undefined。
 */
export type IapProductResolver = (iapProductId: string) =>
  | {
      amount: number;
      credits?: number;
      creditsValidDays?: number;
      currency: string;
      interval?: "day" | "week" | "month" | "year";
      intervalCount?: number;
      planName?: string;
      productId: string;
      productName: string;
    }
  | undefined;

/** RC webhook 签名头名。 */
const SIGNATURE_HEADER = "x-revenuecat-webhook-signature";

/** 时间容差（秒）：RC 官方建议防重放窗口。 */
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export { SIGNATURE_HEADER };

// ─── 验签（Signature verification） ─────────────────────────────────────────

/**
 * 验证 RC webhook 签名（v2 HMAC 方案）。
 *
 * @param rawBody 原始请求体字节（**不得**先 JSON 解析再重序列化 —— 会破坏签名）。
 * @param signature 头 `X-RevenueCat-Webhook-Signature` 的完整值，形如 `t=...,v1=...`。
 * @param secret 后台配置的 `revenuecat_webhook_secret`。
 * @returns 签名合法且时间戳在容差内时 true；任何解析失败一律 false（fail-closed）。
 */
export function verifyRevenueCatWebhook(params: {
  rawBody: string;
  secret: string;
  signature: string;
}): boolean {
  const { rawBody, secret, signature } = params;
  if (!signature || !secret) {
    return false;
  }

  // 解析 "t=<秒>,v1=<hex>"；字段缺失即拒绝。
  const parts = new Map<string, string>(
    signature.split(",").map((pair) => {
      const eq = pair.indexOf("=");
      return eq === -1 ? [pair.trim(), ""] : [pair.slice(0, eq).trim(), pair.slice(eq + 1).trim()];
    }),
  );
  const timestamp = parts.get("t");
  const digest = parts.get("v1");
  if (!timestamp || !digest) {
    return false;
  }

  // 时间容差：过期签名拒绝（防重放）。
  const signedAt = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(signedAt)) {
    return false;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - signedAt) > TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  // HMAC-SHA256("<t>.<rawBody>", secret) 与 v1 常量时比较。
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBytes = Buffer.from(expected, "hex");
  const providedBytes = Buffer.from(digest, "hex");
  if (expectedBytes.length !== providedBytes.length) {
    return false;
  }
  return timingSafeEqual(expectedBytes, providedBytes);
}

// ─── RC 事件载荷（最小类型化：只声明消费到的字段） ─────────────────────────────

interface RevenueCatEventPayload {
  app_user_id?: string;
  expiration_at_ms?: number | null;
  event?: { [key: string]: unknown };
  original_transaction_id?: string;
  period_type?: string;
  price?: number;
  product_id?: string;
  purchased_at_ms?: number;
  transaction_id?: string;
  type?: string;
}

// ─── 事件映射（Event mapping → 既有编排） ───────────────────────────────────

const RC_PROVIDER = "revenuecat";

/**
 * 模块级 resolver 槽位：由路由层在挂载时注入（`configureRevenueCatProducts`），
 * 本包保持「不依赖 api」的分层方向（依赖倒置而非反向 import）。
 */
let resolveIapProduct: IapProductResolver | undefined;

/** 注入商店商品 → 目录条目的反查函数（api 路由层用 resolveProductByIapId 调用）。 */
export function configureRevenueCatProducts(resolver: IapProductResolver): void {
  resolveIapProduct = resolver;
}

function lookupProduct(iapProductId: string): ReturnType<IapProductResolver> | undefined {
  if (!resolveIapProduct) {
    logger.warn("[revenuecat] product resolver not configured, skipping");
    return undefined;
  }
  return resolveIapProduct(iapProductId);
}

/**
 * 处理一条已验签的 RC webhook 载荷：映射为归一化事件并交给既有编排管线。
 *
 * 未登记的商店商品 / 无法归属的用户 / 重复投递均**记日志跳过**（不抛错 ——
 * RC 对非 2xx 响应会指数退避重试，跳过即等价确认；真实错误抛给路由层统一处理）。
 */
export async function mapRevenueCatEvent(payload: RevenueCatEventPayload): Promise<void> {
  const event = payload.event ?? {};
  const type = typeof event.type === "string" ? event.type : (payload.type ?? "");
  const appUserId = typeof event.app_user_id === "string" ? event.app_user_id : payload.app_user_id;
  const transactionId = readString(event, "transaction_id") ?? payload.transaction_id;
  const originalTransactionId =
    readString(event, "original_transaction_id") ?? payload.original_transaction_id;
  const productId = readString(event, "product_id") ?? payload.product_id;
  const periodType = readString(event, "period_type") ?? payload.period_type;
  const purchasedAtMs = readNumber(event, "purchased_at_ms") ?? payload.purchased_at_ms;
  const expirationAtMs = readNumber(event, "expiration_at_ms") ?? payload.expiration_at_ms;

  switch (type) {
    case "INITIAL_PURCHASE":
      await handleInitialPurchase({
        appUserId,
        expirationAtMs,
        originalTransactionId,
        payload,
        periodType,
        productId,
        purchasedAtMs,
        transactionId,
      });
      return;
    case "RENEWAL":
      await emitPaymentSuccess({
        event,
        expirationAtMs,
        originalTransactionId,
        purchasedAtMs,
        transactionId,
        isRenewal: true,
      });
      return;
    case "CANCELLATION":
      await emitSubscriptionUpdate({
        event,
        originalTransactionId,
        status: SubscriptionStatus.PENDING_CANCEL,
        canceledEndAtMs: expirationAtMs,
        canceledReason: "CANCELLATION",
      });
      return;
    case "UNCANCELLATION":
      await emitSubscriptionUpdate({
        event,
        originalTransactionId,
        status: SubscriptionStatus.ACTIVE,
      });
      return;
    case "EXPIRATION":
      await emitSubscriptionCanceled({ event, originalTransactionId, expirationAtMs });
      return;
    case "SUBSCRIPTION_PAUSED":
      await emitSubscriptionUpdate({
        event,
        originalTransactionId,
        status: SubscriptionStatus.PAUSED,
      });
      return;
    case "NON_RENEWING_PURCHASE":
      // 一次性/不再续订的购买：权益保留到期，按 pending_cancel 呈现。
      await emitSubscriptionUpdate({
        event,
        originalTransactionId,
        status: SubscriptionStatus.PENDING_CANCEL,
        canceledEndAtMs: expirationAtMs,
        canceledReason: "NON_RENEWING",
      });
      return;
    case "PRODUCT_CHANGE":
      // v1：仅更新计费周期，不补差价积分（目录单产品下罕见）。
      await emitSubscriptionUpdate({ event, originalTransactionId, status: undefined });
      return;
    default:
      // BILLING_ISSUE / TEST / 未知类型：最小副作用，跳过。
      logger.warn(`[revenuecat] ignored webhook event type: ${type}`);
      return;
  }
}

/** 首期购买：幂等合成 created 订单 → 合成 payment.success(create) 事件。 */
async function handleInitialPurchase(args: {
  appUserId?: string;
  event?: { [key: string]: unknown };
  expirationAtMs?: number | null;
  originalTransactionId?: string;
  payload: RevenueCatEventPayload;
  periodType?: string;
  productId?: string;
  purchasedAtMs?: number;
  transactionId?: string;
}): Promise<void> {
  const { appUserId, transactionId, originalTransactionId, productId } = args;
  if (!(appUserId && transactionId && originalTransactionId && productId)) {
    logger.warn("[revenuecat] INITIAL_PURCHASE missing required fields, skipping");
    return;
  }

  const product = lookupProduct(productId);
  if (!product) {
    logger.warn(`[revenuecat] unregistered store product: ${productId}, skipping`);
    return;
  }

  // 幂等预检：同一 (transactionId, provider) 的订单已存在即跳过（RC 至少一次投递）。
  const [existing] = await db()
    .select({ id: order.id })
    .from(order)
    .where(eq(order.transactionId, transactionId))
    .limit(1);
  if (existing) {
    logger.info(`[revenuecat] duplicate INITIAL_PURCHASE for transaction ${transactionId}`);
    return;
  }

  // 归属校验：app_user_id 即 better-auth userId；查无此人无法归属，跳过。
  const [owner] = await db()
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, appUserId))
    .limit(1);
  if (!owner) {
    logger.warn(`[revenuecat] unknown app_user_id: ${appUserId}, skipping`);
    return;
  }

  const orderNo = getUniSeq("ORD");
  const newOrder: NewOrder = {
    id: getUuid(),
    orderNo,
    userId: appUserId,
    userEmail: "",
    status: OrderStatus.CREATED,
    amount: product.amount,
    currency: product.currency,
    productId: product.productId,
    productName: product.productName,
    planName: product.planName ?? null,
    creditsAmount: product.credits ?? null,
    creditsValidDays: product.creditsValidDays ?? null,
    paymentType: PaymentType.SUBSCRIPTION,
    paymentProvider: RC_PROVIDER,
    paymentSessionId: transactionId,
    // RC 续费/退款按原始交易归集，订单落库即记录 original_transaction_id。
    subscriptionId: originalTransactionId,
    checkoutInfo: "",
    description: `IAP ${product.productName}`,
  };
  await db().insert(order).values(newOrder);

  await emitPaymentSuccess({
    event: args.event,
    expirationAtMs: args.expirationAtMs,
    isRenewal: false,
    metadata: { [ORDER_NO_METADATA_KEY]: orderNo },
    originalTransactionId,
    periodType: args.periodType,
    productId,
    purchasedAtMs: args.purchasedAtMs,
    transactionId,
  });
}

/** 合成 payment.success 归一化事件并交既有编排（create 走建订阅管线、renew 走续费管线）。 */
async function emitPaymentSuccess(args: {
  event?: { [key: string]: unknown };
  expirationAtMs?: number | null;
  isRenewal: boolean;
  metadata?: Record<string, string>;
  originalTransactionId?: string;
  periodType?: string;
  productId?: string;
  purchasedAtMs?: number;
  transactionId?: string;
}): Promise<void> {
  const product = args.productId ? lookupProduct(args.productId) : undefined;
  const now = new Date();
  const currentPeriodStart = args.purchasedAtMs ? new Date(args.purchasedAtMs) : now;
  const currentPeriodEnd = args.expirationAtMs ? new Date(args.expirationAtMs) : now;

  const paymentInfo: PaymentInfo = {
    transactionId: args.transactionId,
    paymentAmount: product?.amount ?? 0,
    paymentCurrency: product?.currency ?? "usd",
    paidAt: currentPeriodStart,
    subscriptionCycleType: args.isRenewal
      ? SubscriptionCycleType.RENEWAL
      : SubscriptionCycleType.CREATE,
  };

  const subscriptionInfo: SubscriptionInfo | undefined =
    args.originalTransactionId && currentPeriodStart && currentPeriodEnd
      ? {
          subscriptionId: args.originalTransactionId,
          productId: args.productId,
          amount: product?.amount,
          currency: product?.currency,
          interval: product?.interval,
          intervalCount: product?.intervalCount,
          status: args.isRenewal
            ? SubscriptionStatus.ACTIVE
            : args.periodType === "TRIAL"
              ? SubscriptionStatus.TRIALING
              : SubscriptionStatus.ACTIVE,
          currentPeriodStart,
          currentPeriodEnd,
        }
      : undefined;

  const session: PaymentSession = {
    provider: RC_PROVIDER,
    paymentStatus: PaymentStatus.SUCCESS,
    paymentInfo,
    // RC 原始事件存审计（含 store 侧金额），不参与定价。
    paymentResult: args.event ?? {},
    subscriptionId: args.originalTransactionId,
    subscriptionInfo,
    metadata: args.metadata,
  };

  const event: PaymentEvent = {
    eventType: PaymentEventType.PAYMENT_SUCCESS,
    eventResult: args.event ?? {},
    paymentSession: session,
  };
  await handlePaymentEvent(event, RC_PROVIDER);
}

/** 合成 subscribe.updated 事件（取消自动续订/恢复/暂停）。 */
async function emitSubscriptionUpdate(args: {
  canceledEndAtMs?: number | null;
  canceledReason?: string;
  event?: { [key: string]: unknown };
  expirationAtMs?: number | null;
  originalTransactionId?: string;
  purchasedAtMs?: number;
  status?: SubscriptionStatus;
}): Promise<void> {
  if (!args.originalTransactionId) {
    return;
  }
  const now = new Date();
  const subscriptionInfo: SubscriptionInfo = {
    subscriptionId: args.originalTransactionId,
    status: args.status,
    currentPeriodStart: args.purchasedAtMs ? new Date(args.purchasedAtMs) : now,
    currentPeriodEnd: args.expirationAtMs ? new Date(args.expirationAtMs) : now,
    ...(args.canceledEndAtMs ? { canceledEndAt: new Date(args.canceledEndAtMs) } : {}),
    ...(args.canceledReason ? { canceledReason: args.canceledReason } : {}),
  };

  const session: PaymentSession = {
    provider: RC_PROVIDER,
    paymentResult: args.event ?? {},
    subscriptionId: args.originalTransactionId,
    subscriptionInfo,
  };
  const event: PaymentEvent = {
    eventType: PaymentEventType.SUBSCRIBE_UPDATED,
    eventResult: args.event ?? {},
    paymentSession: session,
  };
  await handlePaymentEvent(event, RC_PROVIDER);
}

/** 合成 subscribe.canceled 事件（到期/系统收回权益）。 */
async function emitSubscriptionCanceled(args: {
  event?: { [key: string]: unknown };
  expirationAtMs?: number | null;
  originalTransactionId?: string;
}): Promise<void> {
  if (!args.originalTransactionId) {
    return;
  }
  const now = new Date();
  const subscriptionInfo: SubscriptionInfo = {
    subscriptionId: args.originalTransactionId,
    status: SubscriptionStatus.CANCELED,
    currentPeriodStart: now,
    currentPeriodEnd: args.expirationAtMs ? new Date(args.expirationAtMs) : now,
    canceledAt: now,
    canceledEndAt: args.expirationAtMs ? new Date(args.expirationAtMs) : now,
    canceledReason: "EXPIRATION",
  };

  const session: PaymentSession = {
    provider: RC_PROVIDER,
    paymentResult: args.event ?? {},
    subscriptionId: args.originalTransactionId,
    subscriptionInfo,
  };
  const event: PaymentEvent = {
    eventType: PaymentEventType.SUBSCRIBE_CANCELED,
    eventResult: args.event ?? {},
    paymentSession: session,
  };
  await handlePaymentEvent(event, RC_PROVIDER);
}

function readString(source: { [key: string]: unknown }, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(source: { [key: string]: unknown }, key: string): number | undefined {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
