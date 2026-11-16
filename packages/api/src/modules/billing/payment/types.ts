export interface PaymentPrice {
  amount: number;
  currency: string;
}

export interface PaymentDiscount {
  code: string;
}

export interface PaymentCustomer {
  id?: string;
  email?: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface PaymentCustomField {
  type: string;
  name: string;
  label: string;
  isRequired?: boolean;
  metadata?: Record<string, string>;
}

export interface PaymentProduct {
  id: string;
  name?: string;
  description?: string;
  price: PaymentPrice;
  metadata?: Record<string, string>;
}

export const PaymentType = {
  ONE_TIME: "one-time",
  SUBSCRIPTION: "subscription",
  RENEW: "renew",
} as const;

export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];

export const PaymentInterval = {
  ONE_TIME: "one-time",
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  YEAR: "year",
} as const;

export type PaymentInterval = (typeof PaymentInterval)[keyof typeof PaymentInterval];

export const PaymentStatus = {
  PROCESSING: "processing",
  SUCCESS: "paid",
  FAILED: "failed",
  CANCELED: "canceled",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const SubscriptionCycleType = {
  CREATE: "create",
  RENEWAL: "renew",
} as const;

export type SubscriptionCycleType =
  (typeof SubscriptionCycleType)[keyof typeof SubscriptionCycleType];

export const SubscriptionStatus = {
  ACTIVE: "active",
  PENDING_CANCEL: "pending_cancel",
  CANCELED: "canceled",
  TRIALING: "trialing",
  EXPIRED: "expired",
  PAUSED: "paused",
} as const;

export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const PaymentEventType = {
  CHECKOUT_SUCCESS: "checkout.success",
  PAYMENT_SUCCESS: "payment.success",
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_REFUNDED: "payment.refunded",
  SUBSCRIBE_UPDATED: "subscribe.updated",
  SUBSCRIBE_CANCELED: "subscribe.canceled",
} as const;

export type PaymentEventType = (typeof PaymentEventType)[keyof typeof PaymentEventType];

export interface PaymentPlan {
  id?: string;
  name: string;
  description?: string;
  interval: PaymentInterval;
  intervalCount?: number;
  trialPeriodDays?: number;
  metadata?: Record<string, string>;
}

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

export interface CheckoutInfo {
  sessionId: string;
  checkoutUrl: string;
}

export interface WechatQrData {
  codeUrl: string;
  outTradeNo: string;
  amount: number;
}

export interface CheckoutSession {
  provider: string;
  checkoutParams: unknown;
  checkoutInfo: CheckoutInfo;
  checkoutResult: unknown;
  metadata: Record<string, string>;
  qrData?: WechatQrData;
}

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

export interface PaymentEvent {
  eventType: PaymentEventType;
  eventResult: unknown;
  paymentSession?: PaymentSession;
}

export interface PaymentInvoice {
  invoiceId: string;
  invoiceUrl?: string;
  amount?: number;
  currency?: string;
}

export interface PaymentBilling {
  billingUrl?: string;
}

export interface PaymentProvider {
  readonly name: string;

  createPayment(params: { order: PaymentOrder }): Promise<CheckoutSession>;

  getPaymentSession(params: { sessionId: string }): Promise<PaymentSession>;

  getPaymentEvent(params: { req: Request }): Promise<PaymentEvent>;

  getPaymentInvoice?(params: { invoiceId: string }): Promise<PaymentInvoice>;

  getPaymentBilling?(params: { customerId: string; returnUrl?: string }): Promise<PaymentBilling>;

  cancelSubscription?(params: { subscriptionId: string }): Promise<PaymentSession>;
}

export class PaymentProviderUnavailableError extends Error {
  readonly provider: string;

  constructor(provider: string) {
    super(`Payment provider '${provider}' is not enabled or its credentials are missing`);
    this.name = "PaymentProviderUnavailableError";
    this.provider = provider;
  }
}
