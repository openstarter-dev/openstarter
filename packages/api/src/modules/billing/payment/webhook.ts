import { type NewOrder, order } from "../../../db/schema";
import { d1Transaction, db } from "../../../db/server";
import { getUniSeq, getUuid } from "@openstarter/shared/id";
import { and, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import { calculateCreditExpirationTime, CreditTransactionScene, grant } from "../credits";
import { recordCommission } from "../referral/service";
import {
  cancelSubscription,
  createSubscription,
  findByProviderSubscriptionId,
  renewSubscription,
  type UpdateSubscription,
  updateBySubscriptionNo,
} from "../subscriptions";
import { ORDER_NO_METADATA_KEY, OrderStatus } from "./checkout";
import {
  type PaymentEvent,
  PaymentEventType,
  type PaymentSession,
  PaymentStatus,
  PaymentType,
  SubscriptionCycleType,
  SubscriptionStatus,
} from "./types";

const DEFAULT_CURRENCY = "usd";
const RENEWAL_ORDER_DESCRIPTION = "Subscription Renewal";

export function handlePaymentEvent(event: PaymentEvent, provider: string): Promise<void> {
  const session = event.paymentSession;
  if (!session) {
    return Promise.resolve();
  }

  switch (event.eventType) {
    case PaymentEventType.CHECKOUT_SUCCESS:
      return handleCheckoutSuccess(session, provider);
    case PaymentEventType.PAYMENT_SUCCESS:
      return isRenewalEvent(session)
        ? handleSubscriptionRenewal(session, provider)
        : handleCheckoutSuccess(session, provider);
    case PaymentEventType.SUBSCRIBE_UPDATED:
      return handleSubscriptionUpdated(session, provider);
    case PaymentEventType.SUBSCRIBE_CANCELED:
      return handleSubscriptionCanceled(session, provider);
    default:
      return Promise.resolve();
  }
}

function isRenewalEvent(session: PaymentSession): boolean {
  return (
    Boolean(session.subscriptionInfo) &&
    session.paymentInfo?.subscriptionCycleType === SubscriptionCycleType.RENEWAL
  );
}

function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function buildOrderMatchCondition(session: PaymentSession): SQL | undefined {
  const orderNo = readMetadataString(session.metadata, ORDER_NO_METADATA_KEY);
  const transactionId = session.paymentInfo?.transactionId;
  const sessionIdCandidates = [transactionId, orderNo].filter((value): value is string =>
    Boolean(value),
  );

  const matchers: SQL[] = [];
  if (orderNo) {
    matchers.push(eq(order.orderNo, orderNo));
  }
  if (sessionIdCandidates.length > 0) {
    matchers.push(inArray(order.paymentSessionId, sessionIdCandidates));
  }
  if (matchers.length === 0) {
    return;
  }

  return and(or(...matchers), isNull(order.deletedAt));
}

export async function handleCheckoutSuccess(
  session: PaymentSession,
  provider: string,
): Promise<void> {
  const condition = buildOrderMatchCondition(session);
  if (!condition) {
    return;
  }

  if (session.paymentStatus !== PaymentStatus.SUCCESS) {
    await markOrderFailedIfPending(session, condition);
    return;
  }

  let claimed: { id: string; previousStatus: typeof order.$inferSelect.status } | undefined;

  await d1Transaction(db(), async (tx) => {
    const [existingOrder] = await tx.select().from(order).where(condition).limit(1);
    if (!existingOrder) {
      return;
    }

    if (
      existingOrder.status !== OrderStatus.CREATED &&
      existingOrder.status !== OrderStatus.PENDING
    ) {
      return;
    }

    const [won] = await tx
      .update(order)
      .set({ status: OrderStatus.PAID })
      .where(
        and(
          eq(order.id, existingOrder.id),
          inArray(order.status, [OrderStatus.CREATED, OrderStatus.PENDING]),
        ),
      )
      .returning({ id: order.id });
    if (!won) {
      return;
    }
    claimed = { id: existingOrder.id, previousStatus: existingOrder.status };

    const { paymentInfo, subscriptionInfo } = session;

    let subscriptionNo: string | undefined;
    if (subscriptionInfo && session.subscriptionId) {
      const created = await createSubscription({
        userId: existingOrder.userId,
        userEmail: existingOrder.userEmail ?? existingOrder.paymentEmail ?? undefined,
        paymentProvider: provider,
        subscriptionId: session.subscriptionId,
        status: subscriptionInfo.status ?? SubscriptionStatus.ACTIVE,
        subscriptionResult: JSON.stringify(session.subscriptionResult),
        productId: existingOrder.productId ?? undefined,
        description: subscriptionInfo.description ?? undefined,
        amount: subscriptionInfo.amount ?? undefined,
        currency: subscriptionInfo.currency ?? undefined,
        interval: subscriptionInfo.interval ?? undefined,
        intervalCount: subscriptionInfo.intervalCount ?? undefined,
        trialPeriodDays: subscriptionInfo.trialPeriodDays ?? undefined,
        currentPeriodStart: subscriptionInfo.currentPeriodStart,
        currentPeriodEnd: subscriptionInfo.currentPeriodEnd,
        billingUrl: subscriptionInfo.billingUrl ?? undefined,
        planName: existingOrder.planName ?? existingOrder.productName ?? undefined,
        productName: existingOrder.productName ?? undefined,
        creditsAmount: existingOrder.creditsAmount ?? undefined,
        creditsValidDays: existingOrder.creditsValidDays ?? undefined,
        paymentProductId: existingOrder.paymentProductId ?? undefined,
        paymentUserId: paymentInfo?.paymentUserId ?? undefined,
        tx,
      });
      subscriptionNo = created.subscriptionNo;
    }

    if (existingOrder.creditsAmount && existingOrder.creditsAmount > 0) {
      const expiresAt = calculateCreditExpirationTime({
        creditsValidDays: existingOrder.creditsValidDays ?? 0,
        currentPeriodEnd: subscriptionInfo?.currentPeriodEnd,
      });
      await grant({
        userId: existingOrder.userId,
        userEmail: existingOrder.userEmail ?? undefined,
        credits: existingOrder.creditsAmount,
        scene:
          existingOrder.paymentType === PaymentType.SUBSCRIPTION
            ? CreditTransactionScene.SUBSCRIPTION
            : CreditTransactionScene.PAYMENT,
        orderNo: existingOrder.orderNo,
        subscriptionNo,
        expiresAt,
        tx,
      });
    }

    await tx
      .update(order)
      .set({
        status: OrderStatus.PAID,
        paymentResult: JSON.stringify(session.paymentResult),
        paymentAmount: paymentInfo?.paymentAmount ?? null,
        paymentCurrency: paymentInfo?.paymentCurrency ?? null,
        paymentEmail: paymentInfo?.paymentEmail ?? null,
        paidAt: paymentInfo?.paidAt ?? new Date(),
        transactionId: paymentInfo?.transactionId ?? null,
        invoiceId: paymentInfo?.invoiceId ?? null,
        invoiceUrl: paymentInfo?.invoiceUrl ?? null,
        paymentUserName: paymentInfo?.paymentUserName ?? null,
        paymentUserId: paymentInfo?.paymentUserId ?? null,
        discountCode: paymentInfo?.discountCode ?? null,
        discountAmount: paymentInfo?.discountAmount ?? null,
        subscriptionNo: subscriptionNo ?? null,
        subscriptionId: session.subscriptionId ?? null,
        subscriptionResult: session.subscriptionResult
          ? JSON.stringify(session.subscriptionResult)
          : null,
      })
      .where(eq(order.id, existingOrder.id));

    await recordCommission(tx, {
      orderNo: existingOrder.orderNo,
      paymentAmount: paymentInfo?.paymentAmount ?? null,
      paymentCurrency: paymentInfo?.paymentCurrency ?? null,
      userId: existingOrder.userId,
    });
  }).catch(async (error: unknown) => {
    if (claimed) {
      await db()
        .update(order)
        .set({ status: claimed.previousStatus })
        .where(eq(order.id, claimed.id))
        .catch(() => undefined);
    }
    throw error;
  });
}

async function markOrderFailedIfPending(session: PaymentSession, condition: SQL): Promise<void> {
  if (
    session.paymentStatus !== PaymentStatus.FAILED &&
    session.paymentStatus !== PaymentStatus.CANCELED
  ) {
    return;
  }

  const [failedOrder] = await db().select().from(order).where(condition).limit(1);
  if (
    !failedOrder ||
    (failedOrder.status !== OrderStatus.CREATED && failedOrder.status !== OrderStatus.PENDING)
  ) {
    return;
  }

  await db()
    .update(order)
    .set({
      status: OrderStatus.FAILED,
      paymentResult: JSON.stringify(session.paymentResult),
    })
    .where(eq(order.id, failedOrder.id));
}

export async function handleSubscriptionRenewal(
  session: PaymentSession,
  provider: string,
): Promise<void> {
  const info = session.subscriptionInfo;
  if (!(session.subscriptionId && info)) {
    return;
  }
  if (session.paymentStatus !== PaymentStatus.SUCCESS) {
    return;
  }

  const existingSub = await findByProviderSubscriptionId({
    provider,
    subscriptionId: session.subscriptionId,
  });
  if (!existingSub) {
    return;
  }

  const { paymentInfo } = session;
  const transactionId = paymentInfo?.transactionId;

  if (transactionId) {
    const [duplicate] = await db()
      .select({ id: order.id })
      .from(order)
      .where(and(eq(order.transactionId, transactionId), eq(order.paymentProvider, provider)))
      .limit(1);
    if (duplicate) {
      return;
    }
  }

  const renewalOrder: NewOrder = {
    id: getUuid(),
    orderNo: getUniSeq("REN"),
    userId: existingSub.userId,
    userEmail: existingSub.userEmail ?? "",
    status: OrderStatus.PAID,
    amount: existingSub.amount ?? 0,
    currency: existingSub.currency ?? DEFAULT_CURRENCY,
    productId: existingSub.productId ?? null,
    paymentType: PaymentType.RENEW,
    paymentInterval: existingSub.interval ?? null,
    paymentProvider: provider,
    checkoutInfo: "",
    description: RENEWAL_ORDER_DESCRIPTION,
    productName: existingSub.productName ?? null,
    planName: existingSub.planName ?? null,
    creditsAmount: existingSub.creditsAmount ?? null,
    creditsValidDays: existingSub.creditsValidDays ?? null,
    paymentProductId: existingSub.paymentProductId ?? null,
    paymentResult: JSON.stringify(session.paymentResult),
    paymentAmount: paymentInfo?.paymentAmount ?? null,
    paymentCurrency: paymentInfo?.paymentCurrency ?? null,
    paymentEmail: paymentInfo?.paymentEmail ?? null,
    paidAt: paymentInfo?.paidAt ?? new Date(),
    invoiceId: paymentInfo?.invoiceId ?? null,
    invoiceUrl: paymentInfo?.invoiceUrl ?? null,
    subscriptionNo: existingSub.subscriptionNo,
    subscriptionId: session.subscriptionId,
    transactionId: transactionId ?? null,
    paymentUserName: paymentInfo?.paymentUserName ?? null,
    paymentUserId: paymentInfo?.paymentUserId ?? null,
  };
  await db().insert(order).values(renewalOrder);

  await recordCommission(db(), {
    orderNo: renewalOrder.orderNo,
    paymentAmount: session.paymentInfo?.paymentAmount ?? null,
    paymentCurrency: session.paymentInfo?.paymentCurrency ?? null,
    userId: existingSub.userId,
  });

  await renewSubscription({
    subscriptionNo: existingSub.subscriptionNo,
    userId: existingSub.userId,
    userEmail: existingSub.userEmail ?? undefined,
    currentPeriodStart: info.currentPeriodStart,
    currentPeriodEnd: info.currentPeriodEnd,
    creditsAmount: existingSub.creditsAmount,
    creditsValidDays: existingSub.creditsValidDays,
  });
}

export async function handleSubscriptionUpdated(
  session: PaymentSession,
  provider: string,
): Promise<void> {
  const info = session.subscriptionInfo;
  if (!(session.subscriptionId && info)) {
    return;
  }

  const existingSub = await findByProviderSubscriptionId({
    provider,
    subscriptionId: session.subscriptionId,
  });
  if (!existingSub) {
    return;
  }

  const update: UpdateSubscription = {
    currentPeriodStart: info.currentPeriodStart,
    currentPeriodEnd: info.currentPeriodEnd,
    canceledAt: info.canceledAt ?? null,
    canceledEndAt: info.canceledEndAt ?? null,
    canceledReason: info.canceledReason ?? null,
    canceledReasonType: info.canceledReasonType ?? null,
  };

  if (info.status) {
    update.status = info.status;
  }
  await updateBySubscriptionNo(existingSub.subscriptionNo, update);
}

export async function handleSubscriptionCanceled(
  session: PaymentSession,
  provider: string,
): Promise<void> {
  const info = session.subscriptionInfo;
  if (!(session.subscriptionId && info)) {
    return;
  }

  const existingSub = await findByProviderSubscriptionId({
    provider,
    subscriptionId: session.subscriptionId,
  });
  if (!existingSub) {
    return;
  }

  await cancelSubscription({
    subscriptionNo: existingSub.subscriptionNo,
    status: SubscriptionStatus.CANCELED,
    canceledAt: info.canceledAt,
    canceledEndAt: info.canceledEndAt ?? null,
    canceledReason: info.canceledReason,
    canceledReasonType: info.canceledReasonType,
  });
}
