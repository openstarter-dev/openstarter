import { describe, expect, it } from "vitest";

import { PaymentInterval, PaymentType } from "./payment/types";

describe("billing payment vocabulary", () => {
  it("keeps stable checkout type and interval values", () => {
    expect(PaymentType).toEqual({
      ONE_TIME: "one-time",
      RENEW: "renew",
      SUBSCRIPTION: "subscription",
    });
    expect(PaymentInterval.MONTH).toBe("month");
  });
});
