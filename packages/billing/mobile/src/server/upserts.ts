// server 子树落库占位（spec §5：本期不接线 —— 默认 RC 路径走 billing-web
// handlePaymentEvent 管线）。真实实现归 spec §8「server 子树接线或废弃」。
// 调用即抛错：任何意外触达都会立即暴露，而不是静默丢数据。

export interface UpsertCustomerInput {
  referenceId: string;
  externalId: string;
  provider: string;
}

export interface UpsertSubscriptionInput {
  customerId: string;
  externalId: string;
  variantId: string;
  status: string;
  store: string;
  periodStartsAt: Date;
  periodEndsAt: Date;
  trialStartsAt?: Date | null;
  trialEndsAt?: Date | null;
}

export interface UpsertOrderInput {
  customerId: string;
  externalId: string;
  variantId: string;
  status: string;
  store: string;
}

const notWired = (fn: string): Error =>
  new Error(
    `billing/mobile server upsert "${fn}" is not wired yet (docs/superpowers/specs/2026-09-08-mobile-billing-provider-strategy-design.md §5/§8)`,
  );

export const upsertCustomer = async (_input: UpsertCustomerInput): Promise<[{ id: string }]> => {
  throw notWired("upsertCustomer");
};

export const upsertOrders = async (_orders: (UpsertOrderInput | null)[]): Promise<void> => {
  throw notWired("upsertOrders");
};

export const upsertSubscriptions = async (
  _subscriptions: (UpsertSubscriptionInput | null)[],
): Promise<void> => {
  throw notWired("upsertSubscriptions");
};

export const upsertOrder = async (_order: UpsertOrderInput): Promise<void> => {
  throw notWired("upsertOrder");
};

export const upsertSubscription = async (_subscription: UpsertSubscriptionInput): Promise<void> => {
  throw notWired("upsertSubscription");
};
