// 策略层 server 子树的归一化状态（本期不接线；spec §5）。
// 取值基准 = packages/billing/web/src/payment/types.ts（测试快照锁定）；
// past_due/unpaid/incomplete 为上游 provider 映射所需扩展，接线时二次裁决。
export const SubscriptionStatus = {
  ACTIVE: "active",
  PENDING_CANCEL: "pending_cancel",
  CANCELED: "canceled",
  TRIALING: "trialing",
  EXPIRED: "expired",
  PAUSED: "paused",
  PAST_DUE: "past_due",
  UNPAID: "unpaid",
  INCOMPLETE: "incomplete",
} as const;

export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const PaymentStatus = {
  PROCESSING: "processing",
  SUCCESS: "paid",
  FAILED: "failed",
  CANCELED: "canceled",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
