export interface ProductEntry {
  amount: number;
  credits?: number;
  creditsValidDays?: number;
  currency: string;
  iapProductId?: string;
  interval?: "day" | "week" | "month" | "year";
  intervalCount?: number;
  planName?: string;
  productId: string;
  productName: string;
  type: "one-time" | "subscription";
}

export const PRODUCT_CATALOG: readonly ProductEntry[] = [
  {
    amount: 2900,
    credits: 50_000,
    currency: "usd",
    iapProductId: "pro_monthly",
    interval: "month",
    intervalCount: 1,
    planName: "Pro",
    productId: "pro_monthly",
    productName: "Pro",
    type: "subscription",
  },
];

const PRODUCT_INDEX: ReadonlyMap<string, ProductEntry> = new Map(
  PRODUCT_CATALOG.map((entry) => [entry.productId, entry]),
);

const IAP_PRODUCT_INDEX: ReadonlyMap<string, ProductEntry> = new Map(
  PRODUCT_CATALOG.flatMap((entry) =>
    entry.iapProductId ? [[entry.iapProductId, entry] as const] : [],
  ),
);

export function resolveProduct(productId: string): ProductEntry | undefined {
  return PRODUCT_INDEX.get(productId);
}

export function resolveProductByIapId(iapProductId: string): ProductEntry | undefined {
  return IAP_PRODUCT_INDEX.get(iapProductId);
}
