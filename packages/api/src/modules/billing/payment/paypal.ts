// PayPal 支付渠道实现（对齐 ShipAny `core/payment/paypal.ts`）。
//
// 以 fetch + REST API 实现（避免引入过重/不稳定的 SDK）：OAuth 客户端凭证换取
// access token，创建一次性订单或订阅，查询会话，并在 Webhook 中经 PayPal 的
// verify-webhook-signature 接口验签（fail-closed：缺少签名头一律拒绝）。

import { Buffer } from "node:buffer";
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
  PaymentType,
} from "./types";

/** PayPal 渠道配置。 */
export interface PayPalConfigs {
  clientId: string;
  clientSecret: string;
  webhookId?: string;
  environment?: "sandbox" | "production";
}

// ─── REST 响应的最小读取形状 ─────────────────────────────────────────────────

interface PayPalLink {
  rel: string;
  href: string;
}
interface PayPalMoney {
  value?: string;
  currency_code?: string;
}
interface PayPalName {
  given_name?: string;
  surname?: string;
}
interface PayPalPayer {
  email_address?: string;
  name?: PayPalName;
  payer_id?: string;
}
interface PayPalBreakdown {
  discount?: PayPalMoney;
}
interface PayPalCapture {
  id?: string;
  status?: string;
  amount?: PayPalMoney;
  create_time?: string;
  custom_id?: string;
  seller_receivable_breakdown?: PayPalBreakdown;
  supplementary_data?: { related_ids?: { order_id?: string } };
}
interface PayPalPurchaseUnit {
  custom_id?: string;
  amount?: PayPalMoney & { breakdown?: PayPalBreakdown };
  payments?: { captures?: PayPalCapture[] };
}
interface PayPalOrderResource {
  id?: string;
  status?: string;
  create_time?: string;
  purchase_units?: PayPalPurchaseUnit[];
  payer?: PayPalPayer;
  links?: PayPalLink[];
}
interface PayPalSubscriptionResource {
  id?: string;
  status?: string;
  custom_id?: string;
  start_time?: string;
  subscriber?: PayPalPayer;
  billing_info?: {
    last_payment?: { amount?: PayPalMoney; time?: string };
    next_billing_time?: string;
  };
  links?: PayPalLink[];
}
interface PayPalTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}
interface PayPalWebhookEvent {
  event_type?: string;
  resource?: Record<string, unknown>;
}

const CENTS_PER_UNIT = 100;

/** PayPal 渠道 provider。 */
export class PayPalProvider implements PaymentProvider {
  readonly name = "paypal";

  private readonly configs: PayPalConfigs;
  private readonly baseUrl: string;
  private accessToken?: string;
  private tokenExpiry?: number;

  constructor(configs: PayPalConfigs) {
    this.configs = configs;
    this.baseUrl =
      configs.environment === "production"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
  }

  async createPayment({ order }: { order: PaymentOrder }): Promise<CheckoutSession> {
    if (!order.price) {
      throw new Error("price is required");
    }
    await this.ensureAccessToken();

    if (order.type === PaymentType.SUBSCRIPTION) {
      return await this.createSubscriptionPayment(order);
    }
    return await this.createOneTimePayment(order);
  }

  async getPaymentSession({ sessionId }: { sessionId: string }): Promise<PaymentSession> {
    if (!sessionId) {
      throw new Error("sessionId is required");
    }
    await this.ensureAccessToken();

    try {
      let orderResult = (await this.makeRequest(
        `/v2/checkout/orders/${sessionId}`,
        "GET",
      )) as PayPalOrderResource;

      // APPROVED 表示用户已授权但未捕获，触发一次捕获。
      if (orderResult.status === "APPROVED") {
        orderResult = (await this.makeRequest(
          `/v2/checkout/orders/${sessionId}/capture`,
          "POST",
        )) as PayPalOrderResource;
      }

      return this.buildSessionFromOrder(orderResult);
    } catch (orderError) {
      const message = orderError instanceof Error ? orderError.message : String(orderError);
      if (message.includes("RESOURCE_NOT_FOUND") || message.includes("INVALID_RESOURCE_ID")) {
        const subscription = (await this.makeRequest(
          `/v1/billing/subscriptions/${sessionId}`,
          "GET",
        )) as PayPalSubscriptionResource;
        return this.buildSessionFromSubscription(subscription);
      }
      throw orderError;
    }
  }

  async getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent> {
    const rawBody = await req.text();

    if (!this.configs.webhookId) {
      throw new Error("webhookId not configured");
    }

    const event = JSON.parse(rawBody) as PayPalWebhookEvent;
    if (!event.event_type) {
      throw new Error("Invalid webhook payload");
    }

    await this.ensureAccessToken();
    await this.verifyWebhookSignature(req, event);

    const eventType = mapPayPalEventType(event.event_type);
    const resource = event.resource ?? {};
    const paymentSession = await this.buildSessionForEvent(eventType, resource);

    return { eventType, eventResult: event, paymentSession };
  }

  // ─── 结账（Create） ────────────────────────────────────────────────────────

  private async createOneTimePayment(order: PaymentOrder): Promise<CheckoutSession> {
    const price = order.price;
    if (!price) {
      throw new Error("price is required");
    }
    const currency = price.currency.toUpperCase();
    const value = (price.amount / CENTS_PER_UNIT).toFixed(2);

    const payload: Record<string, unknown> = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: order.orderNo,
          custom_id: order.metadata ? JSON.stringify(order.metadata) : undefined,
          items: [
            {
              name: order.description || "Payment",
              unit_amount: { currency_code: currency, value },
              quantity: "1",
            },
          ],
          amount: {
            currency_code: currency,
            value,
            breakdown: {
              item_total: { currency_code: currency, value },
            },
          },
        },
      ],
      application_context: {
        return_url: order.successUrl,
        cancel_url: order.cancelUrl,
        user_action: "PAY_NOW",
        brand_name: order.description,
      },
    };

    const result = (await this.makeRequest(
      "/v2/checkout/orders",
      "POST",
      payload,
    )) as PayPalOrderResource;

    return {
      provider: this.name,
      checkoutParams: payload,
      checkoutInfo: {
        sessionId: result.id ?? "",
        checkoutUrl: findApprovalUrl(result.links),
      },
      checkoutResult: result,
      metadata: order.metadata || {},
    };
  }

  private async createSubscriptionPayment(order: PaymentOrder): Promise<CheckoutSession> {
    const price = order.price;
    const plan = order.plan;
    if (!(price && plan)) {
      throw new Error("plan is required for subscription");
    }
    const currency = price.currency.toUpperCase();
    const value = (price.amount / CENTS_PER_UNIT).toFixed(2);

    const product = (await this.makeRequest("/v1/catalogs/products", "POST", {
      name: plan.name,
      description: plan.description || order.description,
      type: "SERVICE",
      category: "SOFTWARE",
    })) as { id?: string };

    const planResult = (await this.makeRequest("/v1/billing/plans", "POST", {
      product_id: product.id,
      name: plan.name,
      description: plan.description || order.description,
      billing_cycles: [
        {
          frequency: {
            interval_unit: mapIntervalToPayPal(plan.interval),
            interval_count: plan.intervalCount || 1,
          },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value, currency_code: currency },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3,
      },
    })) as { id?: string };

    const payload: Record<string, unknown> = {
      plan_id: planResult.id,
      custom_id: order.metadata ? JSON.stringify(order.metadata) : undefined,
      application_context: {
        brand_name: order.description || "Subscription",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        return_url: order.successUrl,
        cancel_url: order.cancelUrl,
      },
    };

    const subscription = (await this.makeRequest(
      "/v1/billing/subscriptions",
      "POST",
      payload,
    )) as PayPalSubscriptionResource;

    return {
      provider: this.name,
      checkoutParams: payload,
      checkoutInfo: {
        sessionId: subscription.id ?? "",
        checkoutUrl: findApprovalUrl(subscription.links),
      },
      checkoutResult: subscription,
      metadata: order.metadata || {},
    };
  }

  // ─── 事件与会话构建 ──────────────────────────────────────────────────────

  private buildSessionForEvent(
    eventType: PaymentEventType,
    resource: Record<string, unknown>,
  ): Promise<PaymentSession> {
    if (eventType === PaymentEventType.CHECKOUT_SUCCESS) {
      return Promise.resolve(this.buildSessionFromOrder(resource as PayPalOrderResource));
    }
    if (
      eventType === PaymentEventType.SUBSCRIBE_UPDATED ||
      eventType === PaymentEventType.SUBSCRIBE_CANCELED
    ) {
      return Promise.resolve(
        this.buildSessionFromSubscription(resource as PayPalSubscriptionResource),
      );
    }
    if (eventType === PaymentEventType.PAYMENT_FAILED) {
      return Promise.resolve({
        provider: this.name,
        paymentStatus: PaymentStatus.FAILED,
        paymentResult: resource,
      });
    }
    // PAYMENT_SUCCESS / PAYMENT_REFUNDED（capture 事件）
    return Promise.resolve(this.buildSessionFromCapture(resource as PayPalCapture));
  }

  private buildSessionFromOrder(order: PayPalOrderResource): PaymentSession {
    const unit = order.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    const payer = order.payer;

    const amount = capture?.amount ?? unit?.amount;
    const paymentAmount = toCents(amount?.value);
    const paymentCurrency = amount?.currency_code ?? "";
    const discount = unit?.amount?.breakdown?.discount;

    return {
      provider: this.name,
      paymentStatus: mapPayPalStatus(order.status),
      paymentInfo: {
        transactionId: order.id,
        discountAmount: toCents(discount?.value),
        discountCurrency: discount?.currency_code || paymentCurrency,
        paymentAmount,
        paymentCurrency,
        paymentEmail: payer?.email_address,
        paymentUserName: formatPayerName(payer?.name),
        paymentUserId: payer?.payer_id,
        paidAt: parseDate(capture?.create_time ?? order.create_time),
        invoiceId: capture?.id,
      },
      paymentResult: order,
      metadata: parseMetadata(unit?.custom_id),
    };
  }

  private buildSessionFromCapture(capture: PayPalCapture): PaymentSession {
    const discount = capture.seller_receivable_breakdown?.discount;
    const paymentCurrency = capture.amount?.currency_code ?? "";

    return {
      provider: this.name,
      paymentStatus: mapPayPalStatus(capture.status),
      paymentInfo: {
        transactionId: capture.id,
        discountAmount: toCents(discount?.value),
        discountCurrency: discount?.currency_code ?? "",
        paymentAmount: toCents(capture.amount?.value),
        paymentCurrency,
        paidAt: parseDate(capture.create_time),
        invoiceId: capture.id,
      },
      paymentResult: capture,
      metadata: parseMetadata(capture.custom_id),
    };
  }

  private buildSessionFromSubscription(subscription: PayPalSubscriptionResource): PaymentSession {
    const lastPayment = subscription.billing_info?.last_payment;
    const start = parseDate(lastPayment?.time ?? subscription.start_time);
    const end = parseDate(subscription.billing_info?.next_billing_time);

    const info: SubscriptionInfo = {
      subscriptionId: subscription.id ?? "",
      status: mapPayPalSubscriptionStatus(subscription.status),
      currentPeriodStart: start ?? new Date(),
      currentPeriodEnd: end ?? new Date(),
      amount: toCents(lastPayment?.amount?.value),
      currency: lastPayment?.amount?.currency_code,
      metadata: parseMetadata(subscription.custom_id),
    };

    return {
      provider: this.name,
      subscriptionId: subscription.id,
      subscriptionInfo: info,
      subscriptionResult: subscription,
      metadata: parseMetadata(subscription.custom_id),
    };
  }

  // ─── HTTP / 验签辅助 ─────────────────────────────────────────────────────

  private async ensureAccessToken(): Promise<void> {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return;
    }

    const credentials = Buffer.from(
      `${this.configs.clientId}:${this.configs.clientSecret}`,
    ).toString("base64");

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const data = (await response.json()) as PayPalTokenResponse;
    if (data.error || !data.access_token) {
      throw new Error(
        `PayPal authentication failed: ${data.error_description ?? data.error ?? "unknown"}`,
      );
    }

    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in ?? 0) * 1000;
  }

  private async makeRequest(
    endpoint: string,
    method: string,
    data?: Record<string, unknown>,
  ): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (response.status === 204) {
      return {};
    }

    const result = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const name = typeof result.name === "string" ? result.name : "";
      const errMsg = typeof result.message === "string" ? result.message : "Unknown error";
      throw new Error(`PayPal request failed: ${name || errMsg}`);
    }
    return result;
  }

  private async verifyWebhookSignature(req: Request, event: PayPalWebhookEvent): Promise<void> {
    const header = (name: string): string => req.headers.get(name) || "";
    const authAlgo = header("paypal-auth-algo");
    const certUrl = header("paypal-cert-url");
    const transmissionId = header("paypal-transmission-id");
    const transmissionSig = header("paypal-transmission-sig");
    const transmissionTime = header("paypal-transmission-time");

    // fail-closed：缺少任一签名头即拒绝，不区分环境。
    if (!(authAlgo && transmissionId && transmissionSig && transmissionTime)) {
      throw new Error("Missing PayPal webhook signature headers");
    }

    const verify = (await this.makeRequest("/v1/notifications/verify-webhook-signature", "POST", {
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: this.configs.webhookId,
      webhook_event: event,
    })) as { verification_status?: string };

    if (verify.verification_status !== "SUCCESS") {
      throw new Error(
        `Invalid PayPal webhook signature: ${verify.verification_status ?? "unknown"}`,
      );
    }
  }
}

// ─── 纯映射与解析辅助（模块级） ──────────────────────────────────────────────

function findApprovalUrl(links: PayPalLink[] | undefined): string {
  return links?.find((link) => link.rel === "approve")?.href ?? "";
}

function toCents(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * CENTS_PER_UNIT) : 0;
}

function formatPayerName(name: PayPalName | undefined): string | undefined {
  if (!name) {
    return undefined;
  }
  return `${name.given_name ?? ""} ${name.surname ?? ""}`.trim() || undefined;
}

function parseDate(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

function parseMetadata(customId: string | undefined): Record<string, unknown> | undefined {
  if (!customId) {
    return undefined;
  }
  try {
    return JSON.parse(customId) as Record<string, unknown>;
  } catch {
    return { custom_id: customId };
  }
}

function mapPayPalEventType(eventType: string): PaymentEventType {
  switch (eventType) {
    case "CHECKOUT.ORDER.APPROVED":
    case "CHECKOUT.ORDER.COMPLETED":
      return PaymentEventType.CHECKOUT_SUCCESS;
    case "PAYMENT.CAPTURE.COMPLETED":
    case "PAYMENT.SALE.COMPLETED":
      return PaymentEventType.PAYMENT_SUCCESS;
    case "PAYMENT.CAPTURE.DENIED":
    case "PAYMENT.CAPTURE.DECLINED":
    case "PAYMENT.SALE.DENIED":
      return PaymentEventType.PAYMENT_FAILED;
    case "PAYMENT.CAPTURE.REFUNDED":
    case "PAYMENT.SALE.REFUNDED":
      return PaymentEventType.PAYMENT_REFUNDED;
    case "BILLING.SUBSCRIPTION.ACTIVATED":
    case "BILLING.SUBSCRIPTION.UPDATED":
    case "BILLING.SUBSCRIPTION.RE-ACTIVATED":
      return PaymentEventType.SUBSCRIBE_UPDATED;
    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.SUSPENDED":
    case "BILLING.SUBSCRIPTION.EXPIRED":
      return PaymentEventType.SUBSCRIBE_CANCELED;
    default:
      throw new Error(`Unsupported PayPal event type: ${eventType}`);
  }
}

function mapPayPalStatus(status: string | undefined): PaymentStatus {
  switch (status) {
    case "COMPLETED":
    case "CAPTURED":
    case "ACTIVE":
      return PaymentStatus.SUCCESS;
    case "VOIDED":
    case "CANCELLED":
    case "CANCELED":
    case "EXPIRED":
      return PaymentStatus.CANCELED;
    case "DENIED":
    case "DECLINED":
    case "FAILED":
    case "SUSPENDED":
      return PaymentStatus.FAILED;
    default:
      return PaymentStatus.PROCESSING;
  }
}

function mapPayPalSubscriptionStatus(status: string | undefined): SubscriptionStatus {
  switch (status) {
    case "CANCELLED":
      return SubscriptionStatus.CANCELED;
    case "SUSPENDED":
      return SubscriptionStatus.PAUSED;
    case "EXPIRED":
      return SubscriptionStatus.EXPIRED;
    default:
      return SubscriptionStatus.ACTIVE;
  }
}

function mapIntervalToPayPal(interval: PaymentInterval): "DAY" | "WEEK" | "MONTH" | "YEAR" {
  switch (interval) {
    case "day":
      return "DAY";
    case "week":
      return "WEEK";
    case "year":
      return "YEAR";
    default:
      return "MONTH";
  }
}

/** 依配置创建 PayPal provider。 */
export function createPayPalProvider(configs: PayPalConfigs): PayPalProvider {
  return new PayPalProvider(configs);
}
