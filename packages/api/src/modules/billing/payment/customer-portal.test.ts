import { describe, expect, it, vi } from "vitest";

import { StripeProvider } from "./stripe";

describe("StripeProvider.getPaymentBilling", () => {
  it("creates a billing portal session and returns the billing URL", async () => {
    const mockUrl = "https://billing.stripe.com/session/test_123";

    const mockCreate = vi.fn().mockResolvedValue({ url: mockUrl });
    const mockClient = {
      billingPortal: { sessions: { create: mockCreate } },
    };

    const provider = new StripeProvider({
      secretKey: "sk_test_mock",
    });

    (provider as unknown as { client: typeof mockClient }).client = mockClient;

    const result = await provider.getPaymentBilling({
      customerId: "cus_mock123",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      customer: "cus_mock123",
      return_url: "",
    });
    expect(result).toEqual({ billingUrl: mockUrl });
  });

  it("passes returnUrl to Stripe when provided", async () => {
    const mockUrl = "https://billing.stripe.com/session/test_456";
    const mockCreate = vi.fn().mockResolvedValue({ url: mockUrl });
    const mockClient = {
      billingPortal: { sessions: { create: mockCreate } },
    };

    const provider = new StripeProvider({
      secretKey: "sk_test_mock",
    });
    (provider as unknown as { client: typeof mockClient }).client = mockClient;

    const result = await provider.getPaymentBilling({
      customerId: "cus_mock456",
      returnUrl: "https://example.com/settings/billing",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      customer: "cus_mock456",
      return_url: "https://example.com/settings/billing",
    });
    expect(result).toEqual({ billingUrl: mockUrl });
  });

  it("returns an empty billingUrl when Stripe returns null url", async () => {
    const mockCreate = vi.fn().mockResolvedValue({ url: null });
    const mockClient = {
      billingPortal: { sessions: { create: mockCreate } },
    };

    const provider = new StripeProvider({
      secretKey: "sk_test_mock",
    });
    (provider as unknown as { client: typeof mockClient }).client = mockClient;

    const result = await provider.getPaymentBilling({
      customerId: "cus_mock789",
    });

    expect(result).toEqual({ billingUrl: null });
  });
});
