import { respData, respErr } from "@openstarter/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { zValidator } from "../../lib/validator";
import { requireAuth } from "../../middleware/auth";
import { checkoutBody } from "../../schema/billing";
import {
  processPaymentWebhook,
  processRevenueCatWebhook,
  REVENUECAT_PROVIDER,
  startCheckout,
} from "./service";

const PROVIDER_UNAVAILABLE_STATUS = 400;
const UNAUTHORIZED = 401;
const UNKNOWN_PRODUCT_STATUS = 400;

export const billingRouter = new Hono()
  .post("/checkout", requireAuth, zValidator("json", checkoutBody), async (c) => {
    const body = c.req.valid("json");
    const session = c.get("session");

    const result = await startCheckout({
      origin: new URL(c.req.url).origin,
      productId: body.productId,
      provider: body.provider,
      userEmail: session?.user?.email,
      userId: c.get("userId"),
    });

    if (!result.ok) {
      throw new HTTPException(
        result.reason === "unknown_product" ? UNKNOWN_PRODUCT_STATUS : PROVIDER_UNAVAILABLE_STATUS,
        { message: result.message },
      );
    }

    const { checkout } = result;
    return c.json(
      respData({
        checkoutUrl: checkout.checkoutUrl,
        orderNo: checkout.orderNo,
        provider: checkout.provider,
        qrData: checkout.qrData,
      }),
    );
  })
  .post("/payment/webhook/:provider", async (c) => {
    const providerName = c.req.param("provider");

    const result =
      providerName === REVENUECAT_PROVIDER
        ? await processRevenueCatWebhook(c.req.raw)
        : await processPaymentWebhook(providerName, c.req.raw);

    return result.ok
      ? c.json(respData({ received: true }))
      : c.json(respErr(result.message), UNAUTHORIZED);
  });
