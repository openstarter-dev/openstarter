import {
  createCheckout,
  getPaymentManager,
  handlePaymentEvent,
  type PaymentEvent,
  type PaymentOrder,
  PaymentProviderUnavailableError,
} from "@openstarter/billing-web/payment";
import {
  configureRevenueCatProducts,
  mapRevenueCatEvent,
  SIGNATURE_HEADER,
  verifyRevenueCatWebhook,
} from "@openstarter/billing-web/payment/revenuecat";
import { getAllConfigs } from "@openstarter/shared/config";
import { logger } from "@openstarter/shared/logger";

import { type ProductEntry, resolveProduct, resolveProductByIapId } from "./products";

export const REVENUECAT_PROVIDER = "revenuecat";

configureRevenueCatProducts((iapProductId) => {
  const entry = resolveProductByIapId(iapProductId);
  if (!entry) {
    return undefined;
  }
  return {
    amount: entry.amount,
    credits: entry.credits,
    creditsValidDays: entry.creditsValidDays,
    currency: entry.currency,
    interval: entry.interval,
    intervalCount: entry.intervalCount,
    planName: entry.planName,
    productId: entry.productId,
    productName: entry.productName,
  };
});


export interface StartCheckoutParams {
  origin: string;
  productId: string;
  provider?: string;
  userEmail?: string;
  userId: string;
}

export type CheckoutResult =
  | { checkout: Awaited<ReturnType<typeof createCheckout>>; ok: true }
  | { message: string; ok: false; reason: "provider_unavailable" | "unknown_product" };

function buildPaymentOrder(product: ProductEntry, origin: string): PaymentOrder {
  const paymentOrder: PaymentOrder = {
    cancelUrl: `${origin}/pricing`,
    description: product.productName,
    price: { amount: product.amount, currency: product.currency },
    productId: product.productId,
    successUrl: `${origin}/dashboard?checkout=success`,
    type: product.type,
  };

  if (product.type === "subscription") {
    paymentOrder.plan = {
      interval: product.interval ?? "month",
      intervalCount: product.intervalCount,
      name: product.planName ?? product.productName,
    };
  }

  return paymentOrder;
}

export async function startCheckout(params: StartCheckoutParams): Promise<CheckoutResult> {
  const { origin, productId, provider, userEmail, userId } = params;

  const product = resolveProduct(productId);
  if (!product) {
    return {
      message: `unknown product: ${productId}`,
      ok: false,
      reason: "unknown_product",
    };
  }

  const paymentOrder = buildPaymentOrder(product, origin);

  try {
    const checkout = await createCheckout({
      credits: product.credits,
      creditsValidDays: product.creditsValidDays,
      paymentOrder,
      planName: product.planName,
      productName: product.productName,
      provider,
      userEmail,
      userId,
    });
    return { checkout, ok: true };
  } catch (error) {
    if (error instanceof PaymentProviderUnavailableError) {
      return { message: error.message, ok: false, reason: "provider_unavailable" };
    }
    throw error;
  }
}

export type WebhookResult = { message: string; ok: false } | { ok: true };

export async function processPaymentWebhook(
  providerName: string,
  request: Request,
): Promise<WebhookResult> {
  const manager = await getPaymentManager();
  const provider = manager.getProvider(providerName);
  if (!provider) {
    logger.warn(`[webhook] provider unavailable, rejecting callback: ${providerName}`);
    return { message: "unauthorized", ok: false };
  }

  let event: PaymentEvent;
  try {
    event = await provider.getPaymentEvent({ req: request });
  } catch (error) {
    logger.warn(
      `[webhook] signature verification failed: ${providerName} - ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return { message: "invalid webhook signature", ok: false };
  }

  await handlePaymentEvent(event, providerName);
  return { ok: true };
}

export async function processRevenueCatWebhook(request: Request): Promise<WebhookResult> {
  const rawBody = await request.text();
  const signature = request.headers.get(SIGNATURE_HEADER) || "";

  const configs = await getAllConfigs();
  const secret = configs.revenuecat_webhook_secret || "";
  if (!(configs.revenuecat_enabled === "true" && secret)) {
    logger.warn("[webhook] revenuecat disabled or secret missing, rejecting callback");
    return { message: "unauthorized", ok: false };
  }

  if (!verifyRevenueCatWebhook({ rawBody, secret, signature })) {
    logger.warn("[webhook] revenuecat signature verification failed");
    return { message: "invalid webhook signature", ok: false };
  }

  try {
    const payload = JSON.parse(rawBody) as Parameters<typeof mapRevenueCatEvent>[0];
    await mapRevenueCatEvent(payload);
  } catch (error) {
    logger.error(
      `[webhook] revenuecat event handling failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    throw error;
  }

  return { ok: true };
}
