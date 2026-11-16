import { BillingProvider } from "../types";
import { useCustomer, usePaywall } from "./hooks";
import { isSuperwallAvailable, Provider } from "./provider";

import type { BillingProviderClientStrategy } from "../types";

export const strategy = {
  provider: BillingProvider.SUPERWALL,
  Provider,
  isAvailable: isSuperwallAvailable,
  useCustomer,
  usePaywall,
} as const satisfies BillingProviderClientStrategy;

export * from "./env";
