// Stripe 支付渠道实现（对齐 ShipAny `core/payment/stripe.ts`）。
//
// 使用官方 `stripe` SDK 的稳定 API 发起结账（create）、查询会话（retrieve）与
// 验签（constructEventAsync，异步实现以兼容 Node 与边缘运行时）。读取渠道原生
// 响应时，统一以本文件内的最小形状接口 + 断言解耦 SDK 具体版本的类型细节，
// 只声明本实现真正读取的字段，避免随 SDK 版本演进而失配。

import Stripe from "stripe";
import {
  type CheckoutSession,
  type PaymentEvent,
  PaymentEventType,
  type PaymentInterval,
  type PaymentOrder,
  type PaymentProvider,
  type PaymentSession,
  PaymentStatus,
  type SubscriptionInfo,
  SubscriptionStatus,
  SubscriptionCycleType,
  PaymentType,
} from "./types";

/** Stripe 渠道配置（凭证与结账选项）。 */
export interface StripeConfigs {
  secretKey: string;
  publishableKey?: string;
  signingSecret?: string;
  allowedPaymentMethods?: string[];
  allowPromotionCodes?: boolean;
}

// ─── 渠道原生响应的最小读取形状（与 SDK 版本解耦） ───────────────────────────

type StripeSessionStatus = "complete" | "expired" | "open";
type StripePaymentStatus = "paid" | "unpaid" | "no_payment_required";

interface StripeCheckoutSessionShape {
  id: string;
  url?: string | null;
  status?: StripeSessionStatus | null;
  payment_status?: StripePaymentStatus | null;
  subscription?: string | null;
  customer?: string | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null; name?: string | null } | null;
  currency?: string | null;
  amount_total?: number | null;
  total_details?: { amount_discount?: number | null } | null;
  discounts?: Array<{ promotion_code?: string | null }> | null;
  created?: number | null;
  invoice?: string | null;
  metadata?: Record<string, string> | null;
}

interface StripeSubscriptionItemShape {
  current_period_start?: number;
  current_period_end?: number;
  price?: {
    id?: string;
    product?: string;
    unit_amount?: number | null;
    currency?: string;
  };
  plan?: { interval?: string; interval_count?: number | null };
}

interface StripeSubscriptionShape {
  id: string;
  status: string;
  cancel_at?: number | null;
  canceled_at?: number | null;
  cancellation_details?: { comment?: string | null; feedback?: string | null } | null;
  metadata?: Record<string, unknown> | null;
  items: { data: StripeSubscriptionItemShape[] };
}

interface StripeInvoiceLineShape {
  subscription?: string | null;
  parent?: {
    subscription_item_details?: { subscription?: string | null } | null;
  } | null;
}

interface StripeInvoiceShape {
  id?: string | null;
  currency?: string;
  amount_paid?: number;
  customer?: string | null;
  customer_email?: string | null;
  customer_name?: string | null;
  created?: number | null;
  hosted_invoice_url?: string | null;
  billing_reason?: string | null;
  total_discount_amounts?: Array<{ amount: number }> | null;
  metadata?: Record<string, unknown> | null;
  lines: { data: StripeInvoiceLineShape[] };
}

const MS_PER_SECOND = 1000;

/** 把归一化周期映射为 Stripe recurring interval（订阅不会是 one-time）。 */
function toStripeInterval(
  interval: PaymentInterval
): "day" | "week" | "month" | "year" {
  switch (interval) {
    case "day":
      return "day";
    case "week":
      return "week";
    case "year":
      return "year";
    default:
      return "month";
  }
}

/**
 * Stripe 渠道 provider。
 */
export class StripeProvider implements PaymentProvider {
  readonly name = "stripe";

  private readonly configs: StripeConfigs;
  private readonly client: Stripe;

  constructor(configs: StripeConfigs) {
    this.configs = configs;
    this.client = new Stripe(configs.secretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    });
  }

  async createPayment({
    order,
  }: {
    order: PaymentOrder;
  }): Promise<CheckoutSession> {
    if (!order.price) {
      throw new Error("price is required");
    }

    const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData = {
      currency: order.price.currency,
      unit_amount: order.price.amount,
      product_data: { name: order.description || "" },
    };

    if (order.type === PaymentType.SUBSCRIPTION) {
      if (!order.plan) {
        throw new Error("plan is required");
      }
      priceData.recurring = { interval: toStripeInterval(order.plan.interval) };
    }

    const customerId = await this.resolveCustomerId(order);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: order.type === PaymentType.SUBSCRIPTION ? "subscription" : "payment",
      line_items: [{ price_data: priceData, quantity: 1 }],
    };

    if (order.discount?.code) {
      sessionParams.discounts = [{ promotion_code: order.discount.code }];
    } else if (this.configs.allowPromotionCodes) {
      sessionParams.allow_promotion_codes = true;
    }

    this.applyCnyPaymentMethods(sessionParams, order);

    if (order.type === PaymentType.ONE_TIME) {
      sessionParams.invoice_creation = { enabled: true };
    }
    if (customerId) {
      sessionParams.customer = customerId;
    }
    if (order.metadata) {
      sessionParams.metadata = order.metadata;
    }
    if (order.successUrl) {
      sessionParams.success_url = order.successUrl;
    }
    if (order.cancelUrl) {
      sessionParams.cancel_url = order.cancelUrl;
    }

    const session = await this.client.checkout.sessions.create(sessionParams);
    if (!(session.id && session.url)) {
      throw new Error("create payment failed");
    }

    return {
      provider: this.name,
      checkoutParams: sessionParams,
      checkoutInfo: { sessionId: session.id, checkoutUrl: session.url },
      checkoutResult: session,
      metadata: order.metadata || {},
    };
  }

  async getPaymentSession({
    sessionId,
  }: {
    sessionId: string;
  }): Promise<PaymentSession> {
    if (!sessionId) {
      throw new Error("sessionId is required");
    }
    const session = await this.client.checkout.sessions.retrieve(sessionId);
    return await this.buildSessionFromCheckout(
      session as unknown as StripeCheckoutSessionShape
    );
  }

  async getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent> {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!(rawBody && signature)) {
      throw new Error("Invalid webhook request");
    }
    if (!this.configs.signingSecret) {
      throw new Error("Signing secret not configured");
    }

    // 验签：SDK 依 signingSecret 校验请求真实性（安全边界）。
    const event = await this.client.webhooks.constructEventAsync(
      rawBody,
      signature,
      this.configs.signingSecret
    );

    const eventType = mapStripeEventType(event.type);
    const paymentSession = await this.buildSessionForEvent(eventType, event);

    return { eventType, eventResult: event, paymentSession };
  }

  // ─── 私有辅助（Private helpers） ──────────────────────────────────────────

  private async resolveCustomerId(order: PaymentOrder): Promise<string> {
    const email = order.customer?.email;
    if (!email) {
      return "";
    }
    const customers = await this.client.customers.list({ email, limit: 1 });
    const existing = customers.data[0];
    if (existing) {
      return existing.id;
    }
    const created = await this.client.customers.create({
      email,
      name: order.customer?.name,
      metadata: order.customer?.metadata,
    });
    return created.id;
  }

  private applyCnyPaymentMethods(
    sessionParams: Stripe.Checkout.SessionCreateParams,
    order: PaymentOrder
  ): void {
    const currency = order.price?.currency.toLowerCase();
    if (currency !== "cny" || order.type !== PaymentType.ONE_TIME) {
      return;
    }

    const allowed = this.configs.allowedPaymentMethods || [];
    const methods: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = [];
    const methodOptions: Stripe.Checkout.SessionCreateParams.PaymentMethodOptions =
      {};

    if (allowed.includes("card")) {
      methods.push("card");
    }
    if (allowed.includes("wechat_pay")) {
      methods.push("wechat_pay");
      methodOptions.wechat_pay = { client: "web" };
    }
    if (allowed.includes("alipay")) {
      methods.push("alipay");
      methodOptions.alipay = {};
    }
    if (methods.length === 0) {
      methods.push("card");
    }

    sessionParams.payment_method_types = methods;
    sessionParams.payment_method_options = methodOptions;
  }

  private buildSessionForEvent(
    eventType: PaymentEventType,
    event: Stripe.Event
  ): Promise<PaymentSession> {
    const object = event.data.object;
    if (eventType === PaymentEventType.CHECKOUT_SUCCESS) {
      return this.buildSessionFromCheckout(
        object as unknown as StripeCheckoutSessionShape
      );
    }
    if (
      eventType === PaymentEventType.PAYMENT_SUCCESS ||
      eventType === PaymentEventType.PAYMENT_FAILED
    ) {
      return this.buildSessionFromInvoice(
        object as unknown as StripeInvoiceShape,
        eventType
      );
    }
    // SUBSCRIBE_UPDATED / SUBSCRIBE_CANCELED
    return this.buildSessionFromSubscription(
      object as unknown as StripeSubscriptionShape
    );
  }

  private async buildSessionFromCheckout(
    session: StripeCheckoutSessionShape
  ): Promise<PaymentSession> {
    const result: PaymentSession = {
      provider: this.name,
      paymentStatus: mapStripeStatus(session),
      paymentInfo: {
        transactionId: session.id,
        discountCode:
          session.discounts?.find((d) => d.promotion_code)?.promotion_code ??
          "",
        discountAmount: session.total_details?.amount_discount || 0,
        discountCurrency: session.currency || "",
        paymentAmount: session.amount_total || 0,
        paymentCurrency: session.currency || "",
        paymentEmail:
          session.customer_email ||
          session.customer_details?.email ||
          undefined,
        paymentUserName: session.customer_details?.name || "",
        paymentUserId: session.customer || undefined,
        paidAt: session.created
          ? new Date(session.created * MS_PER_SECOND)
          : undefined,
        invoiceId: session.invoice || undefined,
      },
      paymentResult: session,
      metadata: session.metadata ?? undefined,
    };

    if (session.subscription) {
      const subscription = (await this.client.subscriptions.retrieve(
        session.subscription
      )) as unknown as StripeSubscriptionShape;
      result.subscriptionId = subscription.id;
      result.subscriptionInfo = buildSubscriptionInfo(subscription);
      result.subscriptionResult = subscription;
    }

    return result;
  }

  private async buildSessionFromInvoice(
    invoice: StripeInvoiceShape,
    eventType: PaymentEventType
  ): Promise<PaymentSession> {
    const status =
      eventType === PaymentEventType.PAYMENT_FAILED
        ? PaymentStatus.FAILED
        : PaymentStatus.SUCCESS;

    const result: PaymentSession = {
      provider: this.name,
      paymentStatus: status,
      paymentInfo: {
        transactionId: invoice.id ?? undefined,
        discountAmount: invoice.total_discount_amounts?.[0]?.amount ?? 0,
        discountCurrency: invoice.currency || "",
        paymentAmount: invoice.amount_paid ?? 0,
        paymentCurrency: invoice.currency ?? "",
        paymentEmail: invoice.customer_email || "",
        paymentUserName: invoice.customer_name || "",
        paymentUserId: invoice.customer || undefined,
        paidAt: invoice.created
          ? new Date(invoice.created * MS_PER_SECOND)
          : undefined,
        invoiceId: invoice.id ?? undefined,
        invoiceUrl: invoice.hosted_invoice_url || "",
        subscriptionCycleType: mapBillingReason(invoice.billing_reason),
      },
      paymentResult: invoice,
      metadata: invoice.metadata ?? undefined,
    };

    const subscriptionId = extractInvoiceSubscriptionId(invoice);
    if (subscriptionId) {
      const subscription = (await this.client.subscriptions.retrieve(
        subscriptionId
      )) as unknown as StripeSubscriptionShape;
      result.subscriptionId = subscription.id;
      result.subscriptionInfo = buildSubscriptionInfo(subscription);
      result.subscriptionResult = subscription;
    }

    return result;
  }

  private buildSessionFromSubscription(
    subscription: StripeSubscriptionShape
  ): Promise<PaymentSession> {
    return Promise.resolve({
      provider: this.name,
      subscriptionId: subscription.id,
      subscriptionInfo: buildSubscriptionInfo(subscription),
      subscriptionResult: subscription,
    });
  }
}

// ─── 纯映射函数（模块级，无 I/O） ────────────────────────────────────────────

function mapStripeEventType(eventType: string): PaymentEventType {
  switch (eventType) {
    case "checkout.session.completed":
      return PaymentEventType.CHECKOUT_SUCCESS;
    case "invoice.payment_succeeded":
      return PaymentEventType.PAYMENT_SUCCESS;
    case "invoice.payment_failed":
      return PaymentEventType.PAYMENT_FAILED;
    case "customer.subscription.updated":
      return PaymentEventType.SUBSCRIBE_UPDATED;
    case "customer.subscription.deleted":
      return PaymentEventType.SUBSCRIBE_CANCELED;
    default:
      throw new Error(`Unsupported Stripe event type: ${eventType}`);
  }
}

function mapStripeStatus(session: StripeCheckoutSessionShape): PaymentStatus {
  switch (session.status) {
    case "complete":
      return session.payment_status === "unpaid"
        ? PaymentStatus.PROCESSING
        : PaymentStatus.SUCCESS;
    case "expired":
      return PaymentStatus.CANCELED;
    default:
      return PaymentStatus.PROCESSING;
  }
}

function mapBillingReason(
  reason: string | null | undefined
): SubscriptionCycleType | undefined {
  if (reason === "subscription_create") {
    return SubscriptionCycleType.CREATE;
  }
  if (reason === "subscription_cycle") {
    return SubscriptionCycleType.RENEWAL;
  }
  return undefined;
}

function extractInvoiceSubscriptionId(
  invoice: StripeInvoiceShape
): string | undefined {
  const line = invoice.lines.data[0];
  if (!line) {
    return undefined;
  }
  return (
    line.subscription ||
    line.parent?.subscription_item_details?.subscription ||
    undefined
  );
}

function buildSubscriptionInfo(
  subscription: StripeSubscriptionShape
): SubscriptionInfo {
  const item = subscription.items.data[0];
  const price = item?.price;
  const now = Date.now();

  const info: SubscriptionInfo = {
    subscriptionId: subscription.id,
    productId: price?.product,
    planId: price?.id,
    description: "",
    amount: price?.unit_amount || 0,
    currency: price?.currency,
    currentPeriodStart: item?.current_period_start
      ? new Date(item.current_period_start * MS_PER_SECOND)
      : new Date(now),
    currentPeriodEnd: item?.current_period_end
      ? new Date(item.current_period_end * MS_PER_SECOND)
      : new Date(now),
    interval: item?.plan?.interval as PaymentInterval | undefined,
    intervalCount: item?.plan?.interval_count || 1,
    metadata: subscription.metadata ?? undefined,
  };

  applyStripeCancelInfo(info, subscription);
  return info;
}

function applyStripeCancelInfo(
  info: SubscriptionInfo,
  subscription: StripeSubscriptionShape
): void {
  const canceledAt = subscription.canceled_at
    ? new Date(subscription.canceled_at * MS_PER_SECOND)
    : undefined;
  const reason = subscription.cancellation_details?.comment || "";
  const reasonType = subscription.cancellation_details?.feedback || "";

  if (subscription.status === "canceled") {
    info.status = SubscriptionStatus.CANCELED;
    info.canceledAt = canceledAt;
    info.canceledReason = reason;
    info.canceledReasonType = reasonType;
    return;
  }

  if (subscription.status === "active" && subscription.cancel_at) {
    info.status = SubscriptionStatus.PENDING_CANCEL;
    info.canceledAt = canceledAt;
    info.canceledEndAt = new Date(subscription.cancel_at * MS_PER_SECOND);
    info.canceledReason = reason;
    info.canceledReasonType = reasonType;
    return;
  }

  info.status = SubscriptionStatus.ACTIVE;
}

/** 依配置创建 Stripe provider。 */
export function createStripeProvider(configs: StripeConfigs): StripeProvider {
  return new StripeProvider(configs);
}
