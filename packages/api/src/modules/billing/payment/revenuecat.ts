import { createHmac, timingSafeEqual } from "node:crypto";

import { type NewOrder, order, user } from "../../../db/schema";
import { db } from "../../../db/server";
import { getUniSeq, getUuid } from "@openstarter/shared/id";
import { logger } from "@openstarter/shared/logger";
import { eq } from "drizzle-orm";

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

const SIGNATURE_HEADER = "x-revenuecat-webhook-signature";

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export { SIGNATURE_HEADER };

export function verifyRevenueCatWebhook(params: {
  rawBody: string;
  secret: string;
  signature: string;
}): boolean {
  const { rawBody, secret, signature } = params;
  if (!signature || !secret) {
    return false;
  }

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

  const signedAt = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(signedAt)) {
    return false;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - signedAt) > TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBytes = Buffer.from(expected, "hex");
  const providedBytes = Buffer.from(digest, "hex");
  if (expectedBytes.length !== providedBytes.length) {
    return false;
  }
  return timingSafeEqual(expectedBytes, providedBytes);
}

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

const RC_PROVIDER = "revenuecat";

let resolveIapProduct: IapProductResolver | undefined;

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
      await emitSubscriptionUpdate({
        event,
        originalTransactionId,
        status: SubscriptionStatus.PENDING_CANCEL,
        canceledEndAtMs: expirationAtMs,
        canceledReason: "NON_RENEWING",
      });
      return;
    case "PRODUCT_CHANGE":
      await emitSubscriptionUpdate({ event, originalTransactionId, status: undefined });
      return;
    default:
      logger.warn(`[revenuecat] ignored webhook event type: ${type}`);
      return;
  }
}

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

  const [existing] = await db()
    .select({ id: order.id })
    .from(order)
    .where(eq(order.transactionId, transactionId))
    .limit(1);
  if (existing) {
    logger.info(`[revenuecat] duplicate INITIAL_PURCHASE for transaction ${transactionId}`);
    return;
  }

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
