// @openstarter/billing/payment 渠道抽象与归一化类型（对齐 ShipAny `core/payment/types.ts`）。
//
// 任务 16.1：定义统一的支付渠道抽象接口 `PaymentProvider`、归一化事件枚举
// `PaymentEventType`，以及结账/会话/订阅等归一化数据结构。所有枚举均以
// `as const` 对象 + 同名联合类型表达（遵循 ultracite：不使用 enum）。
//
// 业务侧（结账编排、Webhook 编排）只依赖这里的归一化结构，不感知具体渠道差异；
// 各渠道 provider 负责把渠道原生模型翻译为这些归一化结构。

// ─── 值对象（Value objects） ─────────────────────────────────────────────────

/** 价格：金额（最小货币单位，如「分」）与币种。 */
export interface PaymentPrice {
  amount: number;
  currency: string;
}

/** 折扣码。 */
export interface PaymentDiscount {
  code: string;
}

/** 结账客户信息。 */
export interface PaymentCustomer {
  id?: string;
  email?: string;
  name?: string;
  metadata?: Record<string, string>;
}

/** 自定义结账字段。 */
export interface PaymentCustomField {
  type: string;
  name: string;
  label: string;
  isRequired?: boolean;
  metadata?: Record<string, string>;
}

/** 结账商品。 */
export interface PaymentProduct {
  id: string;
  name?: string;
  description?: string;
  price: PaymentPrice;
  metadata?: Record<string, string>;
}

// ─── 归一化枚举（as const + 联合类型，禁用 enum） ─────────────────────────────

/** 支付类型：一次性 / 订阅 / 续费。 */
export const PaymentType = {
  ONE_TIME: "one-time",
  SUBSCRIPTION: "subscription",
  RENEW: "renew",
} as const;

export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];

/** 计费周期。 */
export const PaymentInterval = {
  ONE_TIME: "one-time",
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  YEAR: "year",
} as const;

export type PaymentInterval =
  (typeof PaymentInterval)[keyof typeof PaymentInterval];

/** 支付状态（归一化）：processing / paid / failed / canceled。 */
export const PaymentStatus = {
  PROCESSING: "processing",
  SUCCESS: "paid",
  FAILED: "failed",
  CANCELED: "canceled",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

/** 订阅计费周期类型：首期创建 / 续费。 */
export const SubscriptionCycleType = {
  CREATE: "create",
  RENEWAL: "renew",
} as const;

export type SubscriptionCycleType =
  (typeof SubscriptionCycleType)[keyof typeof SubscriptionCycleType];

/** 订阅状态（归一化）。 */
export const SubscriptionStatus = {
  ACTIVE: "active",
  PENDING_CANCEL: "pending_cancel",
  CANCELED: "canceled",
  TRIALING: "trialing",
  EXPIRED: "expired",
  PAUSED: "paused",
} as const;

export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

/**
 * 归一化支付事件类型（供任务 18 Webhook 编排复用）。
 * 一次性支付成功、订阅创建/续费（更新）、订阅取消等统一映射到这些取值。
 */
export const PaymentEventType = {
  CHECKOUT_SUCCESS: "checkout.success",
  PAYMENT_SUCCESS: "payment.success",
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_REFUNDED: "payment.refunded",
  SUBSCRIBE_UPDATED: "subscribe.updated",
  SUBSCRIBE_CANCELED: "subscribe.canceled",
} as const;

export type PaymentEventType =
  (typeof PaymentEventType)[keyof typeof PaymentEventType];

// ─── 订阅套餐 / 下单（Plan / Order） ─────────────────────────────────────────

/** 订阅套餐（用于订阅类结账）。 */
export interface PaymentPlan {
  id?: string;
  name: string;
  description?: string;
  interval: PaymentInterval;
  intervalCount?: number;
  trialPeriodDays?: number;
  metadata?: Record<string, string>;
}

/** 发起结账的下单参数（归一化，跨渠道通用）。 */
export interface PaymentOrder {
  type?: PaymentType;
  orderNo?: string;
  productId?: string;
  requestId?: string;
  price?: PaymentPrice;
  discount?: PaymentDiscount;
  quantity?: number;
  customer?: PaymentCustomer;
  description?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
  plan?: PaymentPlan;
  customFields?: PaymentCustomField[];
}

// ─── 结账结果（Checkout） ────────────────────────────────────────────────────

/** 结账信息：渠道会话标识与结账链接。 */
export interface CheckoutInfo {
  sessionId: string;
  checkoutUrl: string;
}

/**
 * 微信支付（Native）二维码数据（R10.3）。
 * `codeUrl` 为 `weixin://` 前缀的支付链接，前端据此渲染二维码供用户扫码。
 */
export interface WechatQrData {
  codeUrl: string;
  outTradeNo: string;
  amount: number;
}

/**
 * 结账会话（createPayment 的归一化返回）。
 * `qrData` 仅微信 Native 支付渠道提供，供前端渲染二维码（R10.3）。
 */
export interface CheckoutSession {
  provider: string;
  checkoutParams: unknown;
  checkoutInfo: CheckoutInfo;
  checkoutResult: unknown;
  metadata: Record<string, string>;
  qrData?: WechatQrData;
}

// ─── 支付 / 订阅信息（归一化） ────────────────────────────────────────────────

/** 归一化支付信息（支付成功后填充）。 */
export interface PaymentInfo {
  description?: string;
  transactionId?: string;
  amount?: number;
  currency?: string;
  discountCode?: string;
  discountAmount?: number;
  discountCurrency?: string;
  paymentAmount: number;
  paymentCurrency: string;
  paymentEmail?: string;
  paymentUserName?: string;
  paymentUserId?: string;
  paidAt?: Date;
  invoiceId?: string;
  invoiceUrl?: string;
  subscriptionCycleType?: SubscriptionCycleType;
}

/** 归一化订阅信息（订阅创建/更新后填充）。 */
export interface SubscriptionInfo {
  subscriptionId: string;
  planId?: string;
  productId?: string;
  description?: string;
  amount?: number;
  currency?: string;
  interval?: PaymentInterval;
  intervalCount?: number;
  trialPeriodDays?: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  billingUrl?: string;
  metadata?: Record<string, unknown>;
  status?: SubscriptionStatus;
  canceledAt?: Date;
  canceledReason?: string;
  canceledReasonType?: string;
  canceledEndAt?: Date;
}

/** 支付会话（getPaymentSession / 事件归一化的返回）。 */
export interface PaymentSession {
  provider: string;
  paymentStatus?: PaymentStatus;
  paymentInfo?: PaymentInfo;
  paymentResult?: unknown;
  subscriptionId?: string;
  subscriptionInfo?: SubscriptionInfo;
  subscriptionResult?: unknown;
  metadata?: Record<string, unknown>;
}

/** 归一化支付事件（Webhook 验签后返回，供任务 18 编排）。 */
export interface PaymentEvent {
  eventType: PaymentEventType;
  eventResult: unknown;
  paymentSession?: PaymentSession;
}

/** 发票信息。 */
export interface PaymentInvoice {
  invoiceId: string;
  invoiceUrl?: string;
  amount?: number;
  currency?: string;
}

/** 账单门户信息。 */
export interface PaymentBilling {
  billingUrl?: string;
}

// ─── 渠道抽象接口（Provider abstraction） ────────────────────────────────────

/**
 * 统一支付渠道抽象接口。四个渠道（Stripe/PayPal/Alipay/WechatPay）均实现此接口，
 * 业务侧只依赖此抽象、不感知渠道差异。
 *
 * 必备方法：
 * - `createPayment`：发起结账，返回归一化 {@link CheckoutSession}（含渠道结账链接/参数；
 *   微信另附 {@link WechatQrData}）。
 * - `getPaymentSession`：按会话标识查询支付/订阅状态。
 * - `getPaymentEvent`：从 Webhook 回调请求验签并取归一化 {@link PaymentEvent}
 *   （供任务 18 Webhook 编排复用）。
 *
 * 可选方法（发票/账单门户/取消订阅）由后续阶段按需实现。
 */
export interface PaymentProvider {
  readonly name: string;

  createPayment(params: { order: PaymentOrder }): Promise<CheckoutSession>;

  getPaymentSession(params: { sessionId: string }): Promise<PaymentSession>;

  getPaymentEvent(params: { req: Request }): Promise<PaymentEvent>;

  getPaymentInvoice?(params: { invoiceId: string }): Promise<PaymentInvoice>;

  getPaymentBilling?(params: {
    customerId: string;
    returnUrl?: string;
  }): Promise<PaymentBilling>;

  cancelSubscription?(params: {
    subscriptionId: string;
  }): Promise<PaymentSession>;
}

// ─── 错误（Errors） ──────────────────────────────────────────────────────────

/**
 * 渠道不可用错误（R10.4）：所选支付渠道在 Config 中未启用或凭证缺失时抛出，
 * 使结账编排能明确拒绝并返回可识别的错误信息。
 */
export class PaymentProviderUnavailableError extends Error {
  readonly provider: string;

  constructor(provider: string) {
    super(
      `Payment provider '${provider}' is not enabled or its credentials are missing`
    );
    this.name = "PaymentProviderUnavailableError";
    this.provider = provider;
  }
}
