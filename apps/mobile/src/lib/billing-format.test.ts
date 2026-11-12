import { describe, expect, it } from "vitest";

import {
  filterCreditHistory,
  filterOrders,
  formatIsoDate,
  formatMinorAmount,
} from "./billing-format";

describe("formatMinorAmount", () => {
  it("divides minor units to a two-decimal string", () => {
    expect(formatMinorAmount(2900, "usd")).toBe("USD$29.00");
    expect(formatMinorAmount(105, "cny")).toBe("CNY$1.05");
    expect(formatMinorAmount(1, "usd")).toBe("USD$0.01");
  });

  it("keeps zero and handles negatives", () => {
    expect(formatMinorAmount(0, "usd")).toBe("USD$0.00");
    expect(formatMinorAmount(-2900, "usd")).toBe("-USD$29.00");
  });
});

describe("formatIsoDate", () => {
  it("formats an ISO string to YYYY-MM-DD", () => {
    expect(formatIsoDate("2026-09-04T12:34:56.000Z")).toMatch(/^2026-09-0[34]$/);
  });

  it("returns null for null/undefined/invalid input", () => {
    expect(formatIsoDate(null)).toBeNull();
    expect(formatIsoDate(undefined)).toBeNull();
    expect(formatIsoDate("not-a-date")).toBeNull();
  });
});

const HISTORY = [
  { credits: 50_000, remainingCredits: 50_000, transactionNo: "t1", transactionType: "grant" },
  { credits: -100, remainingCredits: 49_900, transactionNo: "t2", transactionType: "consume" },
  { credits: 10, remainingCredits: 10, transactionNo: "t3", transactionType: "grant" },
] as const;

describe("filterCreditHistory", () => {
  it("returns a shallow copy for all", () => {
    const result = filterCreditHistory(HISTORY, "all");
    expect(result).toEqual(HISTORY);
    expect(result).not.toBe(HISTORY);
  });

  it("filters by grant/consume", () => {
    expect(filterCreditHistory(HISTORY, "grant").map((item) => item.transactionNo)).toEqual([
      "t1",
      "t3",
    ]);
    expect(filterCreditHistory(HISTORY, "consume").map((item) => item.transactionNo)).toEqual([
      "t2",
    ]);
  });
});

const ORDERS = [
  {
    amount: 2900,
    currency: "usd",
    orderNo: "o1",
    paymentProvider: "stripe",
    paymentType: "subscription",
    status: "paid",
  },
  {
    amount: 900,
    currency: "usd",
    orderNo: "o2",
    paymentProvider: "stripe",
    paymentType: "one-time",
    status: "paid",
  },
];

describe("filterOrders", () => {
  it("returns a shallow copy for all", () => {
    const result = filterOrders(ORDERS, "all");
    expect(result).toEqual(ORDERS);
    expect(result).not.toBe(ORDERS);
  });

  it("filters by one-time/subscription", () => {
    expect(filterOrders(ORDERS, "subscription").map((order) => order.orderNo)).toEqual(["o1"]);
    expect(filterOrders(ORDERS, "one-time").map((order) => order.orderNo)).toEqual(["o2"]);
  });
});
