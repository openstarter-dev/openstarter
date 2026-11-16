export const PaywallResult = {
  /** No paywall action has been taken yet. */
  IDLE: "idle",

  /** The paywall was shown and user made a successful purchase. */
  PURCHASED: "purchased",

  /** The paywall was shown and user restored a previous purchase. */
  RESTORED: "restored",

  /** The paywall was presented but dismissed without purchase (cancel, close). */
  DISMISSED: "dismissed",

  /** The paywall was never shown (skipped/not needed). */
  SKIPPED: "skipped",

  /** An error occurred showing or processing the paywall. */
  ERROR: "error",
} as const;

export type PaywallResult = (typeof PaywallResult)[keyof typeof PaywallResult];
export type PaywallCallback = <T extends unknown[]>(...args: T) => void;

type Callback = "onPresent" | "onDismiss" | "onPurchase" | "onRestore" | "onSkip" | "onError";

export type PaywallCallbacks = Partial<Record<Callback, PaywallCallback>>;
export type { Entitlement } from "./providers/types";
