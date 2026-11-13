import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../middleware/auth", async () => {
  const { createMiddleware } = await import("hono/factory");
  const requireAuth = createMiddleware<{
    Variables: { userId: string; session: null };
  }>(async (c, next) => {
    c.set("session", null);
    c.set("userId", c.req.header("x-test-user-id") ?? "test-user");
    await next();
  });
  return { requireAuth };
});

const createCheckoutMock = vi.hoisted(() => vi.fn());
vi.mock("@openstarter/billing-web/payment", async () => {
  const actual = await vi.importActual<typeof import("@openstarter/billing-web/payment")>(
    "@openstarter/billing-web/payment",
  );
  return {
    ...actual,
    createCheckout: (...args: unknown[]) => createCheckoutMock(...args),
  };
});

import { billingRouter } from "./router";

function request(body: unknown) {
  return billingRouter.request("/checkout", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

const FAKE_CHECKOUT_RESULT = {
  checkoutUrl: "https://pay.example.com/checkout",
  orderNo: "order_1",
  provider: "stripe",
  qrData: undefined,
};

beforeEach(() => {
  createCheckoutMock.mockReset();
  createCheckoutMock.mockResolvedValue(FAKE_CHECKOUT_RESULT);
});

describe("POST /checkout", () => {
  it("derives price and credits from the server-side catalog, ignoring client values", async () => {
    const response = await request({
      amount: 1,
      credits: 999_999,
      creditsValidDays: 9999,
      currency: "cny",
      interval: "year",
      intervalCount: 99,
      planName: "Fake Plan",
      productId: "pro_monthly",
      productName: "Fake Product",
      type: "one-time",
    });

    expect(response.status).toBe(200);
    expect(createCheckoutMock).toHaveBeenCalledTimes(1);

    const firstCall = createCheckoutMock.mock.calls[0];
    if (!firstCall) {
      throw new Error("createCheckout was not called");
    }
    const params = firstCall[0] as {
      credits?: number;
      creditsValidDays?: number;
      paymentOrder: {
        price: { amount: number; currency: string };
        productId: string;
        type: string;
        plan?: { interval: string; intervalCount?: number; name: string };
      };
    };

    expect(params.paymentOrder.price).toEqual({ amount: 2900, currency: "usd" });
    expect(params.paymentOrder.productId).toBe("pro_monthly");
    expect(params.paymentOrder.type).toBe("subscription");
    expect(params.paymentOrder.plan).toMatchObject({
      interval: "month",
      intervalCount: 1,
    });
    expect(params.credits).toBe(50_000);
  });

  it("rejects an unknown productId without calling createCheckout", async () => {
    const response = await request({ productId: "made_up_product" });

    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toContain("unknown product");
    expect(createCheckoutMock).not.toHaveBeenCalled();
  });

  it("rejects a request without productId", async () => {
    const response = await request({ amount: 2900 });

    expect(response.status).toBe(400);
    expect(createCheckoutMock).not.toHaveBeenCalled();
  });

  it("maps PaymentProviderUnavailableError to a 400 response", async () => {
    const { PaymentProviderUnavailableError } = await import("@openstarter/billing-web/payment");
    createCheckoutMock.mockRejectedValue(
      new PaymentProviderUnavailableError("stripe credentials missing"),
    );

    const response = await request({ productId: "pro_monthly" });

    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toContain("stripe credentials missing");
  });
});
