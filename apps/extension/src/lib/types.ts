// apps/extension/src/lib/types.ts —— Shared types for the extension.

export type UserPlan = "none" | "trial" | "expired" | "member";

export interface SubscriptionStatusView {
  hasSubscription: boolean;
  nextBillingDate: string | null;
  planName: string | null;
  status: string | null;
}

export interface AccountSnapshot {
  creditsBalance: number;
  plan: UserPlan;
  subscription: SubscriptionStatusView;
}