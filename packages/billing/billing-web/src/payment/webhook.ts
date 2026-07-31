// @openstarter/billing-web/payment Webhook 成功编排（对齐 ShipAny `modules/payment/service.ts`
// 的 handleWebhook / handleCheckoutSuccess / handleSubscription*）。
//
// 任务 18.2：由 Webhook 路由（packages/api，任务 18.1）在**验签通过后**调用，依归一化
// 事件类型将已验证的 {@link PaymentEvent} 路由到对应处理器：
//   - `handleCheckoutSuccess`：**单事务**内按需建订阅（`createSubscription`）+ 按
//     `calculateCreditExpirationTime` 授积分（`grant`）+ 置订单 `paid`（R12.3）。
//   - `handleSubscriptionUpdated` / `handleSubscriptionCanceled`：经订阅服务更新对应
//     订阅状态（R12.4）。
//   - `handleSubscriptionRenewal`：续费进入新计费周期，复用 `renewSubscription` 推进
//     周期并授予本周期积分（R12.4）。
//
// 幂等（R12.5）：一次性订单在事务内回读并按状态判定（已 `paid`/终态则跳过），续费按
// `(transactionId, paymentProvider)` 去重；重复投递不重复授分、不重复更新状态。
//
// 依赖分层：仅依赖 `@openstarter/db`（order 表 + db()）、`@openstarter/shared`（id）与
// 同包 credits/subscriptions/checkout；不依赖 api/auth。验签由各渠道 provider 负责，
// 本模块只消费归一化事件（不感知渠道原生标识差异）。

import { type NewOrder, order } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { getUniSeq, getUuid } from "@openstarter/shared/id";
import { and, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import {
  calculateCreditExpirationTime,
  CreditTransactionScene,
  grant,
} from "../credits";
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

// ─── 归一化事件路由（Router，R12.3/R12.4） ───────────────────────────────────

/**
 * 将**已验签**的归一化支付事件路由到对应编排处理器（R12.3/R12.4）。
 *
 * 由 Webhook 路由在 `provider.getPaymentEvent`（验签）成功后调用；本函数只做业务
 * 编排、不做验签，因此其内部异常应交由上层统一错误处理（非验签失败，不返回 401）。
 *
 * - `checkout.success` / 非续费 `payment.success` → {@link handleCheckoutSuccess}
 * - 续费 `payment.success`（`subscriptionCycleType='renew'`）→ {@link handleSubscriptionRenewal}
 * - `subscribe.updated` → {@link handleSubscriptionUpdated}
 * - `subscribe.canceled` → {@link handleSubscriptionCanceled}
 * - 其它（`payment.failed`/`payment.refunded`）→ 不做订单/订阅变更（最小副作用）。
 */
export function handlePaymentEvent(
  event: PaymentEvent,
  provider: string
): Promise<void> {
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
      // PAYMENT_FAILED / PAYMENT_REFUNDED：暂不改订单/订阅（保持幂等与最小副作用）。
      return Promise.resolve();
  }
}

/** 是否为「续费」事件：带订阅信息且支付信息标记为续费周期。 */
function isRenewalEvent(session: PaymentSession): boolean {
  return (
    Boolean(session.subscriptionInfo) &&
    session.paymentInfo?.subscriptionCycleType === SubscriptionCycleType.RENEWAL
  );
}

// ─── 订单回关（Order matching，跨渠道纯归一化字段） ──────────────────────────

/** 从归一化 metadata 中读取指定键的非空字符串值。 */
function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * 构建「回关本次结账订单」的匹配条件（纯归一化字段，跨渠道通用）：
 *
 * - 首选结账时注入的 `metadata[order_no]`（四渠道均原样回传，等于订单号）→ 匹配 `order.orderNo`。
 * - 兼容 Stripe/PayPal：其归一化 `paymentInfo.transactionId` 等于结账会话标识 →
 *   匹配 `order.paymentSessionId`；支付宝/微信的 `order.paymentSessionId` 等于订单号，
 *   故订单号亦纳入 `paymentSessionId` 候选。
 *
 * 无任何可用标识时返回 `undefined`（调用方据此跳过，不做任何变更）。
 */
function buildOrderMatchCondition(session: PaymentSession): SQL | undefined {
  const orderNo = readMetadataString(session.metadata, ORDER_NO_METADATA_KEY);
  const transactionId = session.paymentInfo?.transactionId;
  const sessionIdCandidates = [transactionId, orderNo].filter(
    (value): value is string => Boolean(value)
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

// ─── 结账成功（Checkout success，R12.3） ─────────────────────────────────────

/**
 * 处理「已成功支付的一次性订单 / 订阅首期」事件（R12.3）。
 *
 * 成功（`paymentStatus='paid'`）时在**单个事务**内：按需建订阅（`createSubscription({ tx })`）、
 * 按订单积分配置授予积分（`grant({ tx })`，到期时间经 `calculateCreditExpirationTime`）、
 * 并置订单为 `paid`——三者原子提交，避免部分成功。
 *
 * 幂等（R12.5）：事务内回读订单，仅当其处于 `created`/`pending` 时处理；已 `paid` 或其它
 * 终态一律跳过，重复投递不重复建订阅/授分/改状态。
 *
 * 失败/取消（`failed`/`canceled`）：将仍处 `created`/`pending` 的订单置为 `failed`，不建订阅、不授分。
 */
export async function handleCheckoutSuccess(
  session: PaymentSession,
  provider: string
): Promise<void> {
  const condition = buildOrderMatchCondition(session);
  if (!condition) {
    return;
  }

  if (session.paymentStatus !== PaymentStatus.SUCCESS) {
    await markOrderFailedIfPending(session, condition);
    return;
  }

  await db().transaction(async (tx) => {
    const [existingOrder] = await tx
      .select()
      .from(order)
      .where(condition)
      .limit(1);
    if (!existingOrder) {
      return;
    }
    // 幂等（R12.5）：仅处理待支付订单；已 paid/failed 等终态直接跳过。
    if (
      existingOrder.status !== OrderStatus.CREATED &&
      existingOrder.status !== OrderStatus.PENDING
    ) {
      return;
    }

    const { paymentInfo, subscriptionInfo } = session;

    // 1. 按需建订阅（订阅类结账）。
    let subscriptionNo: string | undefined;
    if (subscriptionInfo && session.subscriptionId) {
      const created = await createSubscription({
        userId: existingOrder.userId,
        userEmail:
          existingOrder.userEmail ?? existingOrder.paymentEmail ?? undefined,
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
        planName:
          existingOrder.planName ?? existingOrder.productName ?? undefined,
        productName: existingOrder.productName ?? undefined,
        creditsAmount: existingOrder.creditsAmount ?? undefined,
        creditsValidDays: existingOrder.creditsValidDays ?? undefined,
        paymentProductId: existingOrder.paymentProductId ?? undefined,
        paymentUserId: paymentInfo?.paymentUserId ?? undefined,
        tx,
      });
      subscriptionNo = created.subscriptionNo;
    }

    // 2. 按订单积分配置授予积分（到期随订阅周期或按有效天数，R13.1/R13.2）。
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

    // 3. 置订单 paid，并回填支付/订阅结果。
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
  });
}

/** 失败/取消：将仍处 `created`/`pending` 的订单置为 `failed`（不建订阅/不授分）。 */
async function markOrderFailedIfPending(
  session: PaymentSession,
  condition: SQL
): Promise<void> {
  if (
    session.paymentStatus !== PaymentStatus.FAILED &&
    session.paymentStatus !== PaymentStatus.CANCELED
  ) {
    return;
  }

  const [failedOrder] = await db()
    .select()
    .from(order)
    .where(condition)
    .limit(1);
  if (
    !failedOrder ||
    (failedOrder.status !== OrderStatus.CREATED &&
      failedOrder.status !== OrderStatus.PENDING)
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

// ─── 订阅续费（Renewal，R12.4） ──────────────────────────────────────────────

/**
 * 处理订阅续费事件（进入新计费周期并完成扣款，R12.4）。
 *
 * 幂等（R12.5）：按 `(transactionId, paymentProvider)` 去重——已存在同一渠道交易的续费
 * 订单则跳过，避免重复投递重复授分、重复推进周期。首次处理时先落一条续费 `order`
 * （携带 `transactionId` 作为后续去重标记），再复用 {@link renewSubscription} 推进计费
 * 周期起止并授予本周期积分。
 */
export async function handleSubscriptionRenewal(
  session: PaymentSession,
  provider: string
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

  // 幂等去重（R12.5）：同一 (transactionId, provider) 的续费只处理一次。
  if (transactionId) {
    const [duplicate] = await db()
      .select({ id: order.id })
      .from(order)
      .where(
        and(
          eq(order.transactionId, transactionId),
          eq(order.paymentProvider, provider)
        )
      )
      .limit(1);
    if (duplicate) {
      return;
    }
  }

  // 先落续费订单（作为去重标记），再复用 renewSubscription 推进周期并授予本周期积分。
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

// ─── 订阅更新 / 取消（Update / Cancel，R12.4） ───────────────────────────────

/**
 * 处理订阅更新事件（R12.4）：依渠道回传的订阅状态与计费周期，更新本地订阅记录。
 * 仅在能按 `(provider, subscriptionId)` 命中既有订阅时更新；未命中则跳过。
 */
export async function handleSubscriptionUpdated(
  session: PaymentSession,
  provider: string
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
  // 仅在渠道给出状态时更新（避免把 notNull 的 status 置空）。
  if (info.status) {
    update.status = info.status;
  }
  await updateBySubscriptionNo(existingSub.subscriptionNo, update);
}

/**
 * 处理订阅取消事件（R12.4）：命中既有订阅后经订阅服务记录取消时间/生效时间并置为
 * 反映取消的状态（默认 `canceled`）。未命中则跳过。
 */
export async function handleSubscriptionCanceled(
  session: PaymentSession,
  provider: string
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
