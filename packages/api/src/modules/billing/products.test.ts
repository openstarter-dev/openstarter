import { describe, expect, it } from "vitest";

import { PRODUCT_CATALOG, resolveProduct, resolveProductByIapId } from "./products";

describe("resolveProduct", () => {
  it("resolves pro_monthly from the catalog", () => {
    const product = resolveProduct("pro_monthly");
    expect(product?.amount).toBe(2900);
    expect(product?.type).toBe("subscription");
  });

  it("returns undefined for unknown product ids", () => {
    expect(resolveProduct("made_up_product")).toBeUndefined();
  });
});

describe("resolveProductByIapId", () => {
  it("resolves the catalog entry whose iapProductId equals the store product id", () => {
    const product = resolveProductByIapId("pro_monthly");
    expect(product?.productId).toBe("pro_monthly");
    expect(product?.amount).toBe(2900);
    expect(product?.credits).toBe(50_000);
  });

  it("returns undefined when no entry registers the store product id", () => {
    expect(resolveProductByIapId("com.unknown.product")).toBeUndefined();
  });

  it("does not index entries without iapProductId", () => {
    const withoutIap = PRODUCT_CATALOG.every((entry) => typeof entry.iapProductId === "string");
    expect(withoutIap).toBe(true);
  });
});
