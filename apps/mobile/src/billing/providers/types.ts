import type { PaywallCallbacks, PaywallResult } from "../types";

export const BillingProvider = {
  REVENUECAT: "revenuecat",
  SUPERWALL: "superwall",
} as const;

export type BillingProvider = (typeof BillingProvider)[keyof typeof BillingProvider];

export interface Entitlement {
  id: string;
  active: boolean;
  variantId?: string;
}

export interface BillingProviderClientStrategy {
  provider: BillingProvider;
  /** 挂载即完成 SDK configure（内部 ensureConfigured），并跟随 locale。 */
  Provider: (props: { children: React.ReactNode; locale?: string }) => React.ReactNode;
  /** configure 成功（或 key 缺失判定完成）后为 true；供 app 侧可用性门禁。 */
  isAvailable: () => boolean;
  useCustomer: () => {
    customer: unknown;
    entitlements: Entitlement[];
    identify: (userId: string, traits?: Record<string, string | null>) => void;
    reset: () => void;
    /** 恢复购买；返回是否恢复了有效订阅。失败返回 false，不抛错。 */
    restore: () => Promise<boolean>;
    /** 购买/续费/到期等客户信息推送；返回取消函数（不可用时返回空函数）。 */
    addCustomerInfoListener: (listener: () => void) => () => void;
    linkToPortal: ({ store, variantId }: { store: string; variantId?: string }) => Promise<void>;
  };
  usePaywall: (callbacks?: PaywallCallbacks) => {
    present: <T extends { trigger: string }>(props: T) => Promise<void>;
    result: PaywallResult;
  };
}

export interface BillingProviderServerStrategy {
  provider: BillingProvider;
  webhookHandler: (req: Request, callbacks?: WebhookCallbacks) => Promise<Response>;
}

export interface WebhookCallbacks {
  onSubscriptionCreated?: (subscriptionId: string) => Promise<void> | void;
  onSubscriptionUpdated?: (subscriptionId: string) => Promise<void> | void;
  onSubscriptionDeleted?: (subscriptionId: string) => Promise<void> | void;
  onOneTimePurchaseSucceeded?: (orderId: string) => Promise<void> | void;
  onEvent?: (event: unknown) => Promise<void> | void;
}
