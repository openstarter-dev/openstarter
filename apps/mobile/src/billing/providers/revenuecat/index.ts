import { BillingProvider } from "../types";
import { useCustomer } from "./hooks/use-customer";
import { usePaywall } from "./hooks/use-paywall";
import { isRevenueCatAvailable, Provider } from "./provider";

import type { BillingProviderClientStrategy } from "../types";

export const strategy = {
  provider: BillingProvider.REVENUECAT,
  Provider,
  isAvailable: isRevenueCatAvailable,
  useCustomer,
  usePaywall,
} as const satisfies BillingProviderClientStrategy;

export * from "./env";
