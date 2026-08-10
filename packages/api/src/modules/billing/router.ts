import { zValidator } from "@hono/zod-validator";
import {
  createCheckout,
  type PaymentOrder,
  PaymentProviderUnavailableError,
  getPaymentManager,
  handlePaymentEvent,
  type PaymentEvent,
} from "@openstarter/billing-web/payment";
import { respData, respErr } from "@openstarter/shared";
import { logger } from "@openstarter/shared/logger";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { requireAuth } from "../../middleware/auth";

const DEFAULT_CURRENCY = "usd";
const DEFAULT_INTERVAL = "month";
const PROVIDER_UNAVAILABLE_STATUS = 400;
const UNAUTHORIZED = 401;

// 结账入参：所选产品/套餐（金额以最小货币单位，如「分」）与支付渠道。
const checkoutBody = z.object({
  amount: z.number().int().nonnegative(),
  credits: z.number().int().nonnegative().optional(),
  creditsValidDays: z.number().int().nonnegative().optional(),
  currency: z.string().min(1).default(DEFAULT_CURRENCY),
  description: z.string().min(1).optional(),
  interval: z.enum(["day", "week", "month", "year"]).optional(),
  intervalCount: z.number().int().positive().optional(),
  planName: z.string().min(1).optional(),
  productId: z.string().min(1),
  productName: z.string().min(1).optional(),
  provider: z.string().min(1).optional(),
  type: z.enum(["one-time", "subscription", "renew"]).default("one-time"),
});

export const billingRouter = new Hono()
  .post("/checkout", requireAuth, zValidator("json", checkoutBody), async (c) => {
    const body = c.req.valid("json");
    const session = c.get("session");
    const origin = new URL(c.req.url).origin;

    const paymentOrder: PaymentOrder = {
      cancelUrl: `${origin}/pricing`,
      description: body.description ?? body.productName ?? body.productId,
      price: { amount: body.amount, currency: body.currency },
      productId: body.productId,
      successUrl: `${origin}/dashboard?checkout=success`,
      type: body.type,
    };

    if (body.type === "subscription") {
      paymentOrder.plan = {
        interval: body.interval ?? DEFAULT_INTERVAL,
        intervalCount: body.intervalCount,
        name: body.planName ?? body.productName ?? body.productId,
      };
    }

    try {
      const result = await createCheckout({
        credits: body.credits,
        creditsValidDays: body.creditsValidDays,
        paymentOrder,
        planName: body.planName,
        productName: body.productName,
        provider: body.provider,
        userEmail: session?.user?.email,
        userId: c.get("userId"),
      });

      return c.json(
        respData({
          checkoutUrl: result.checkoutUrl,
          orderNo: result.orderNo,
          provider: result.provider,
          qrData: result.qrData,
        })
      );
    } catch (err) {
      if (err instanceof PaymentProviderUnavailableError) {
        throw new HTTPException(PROVIDER_UNAVAILABLE_STATUS, {
          message: err.message,
        });
      }
      throw err;
    }
  })
  .post("/payment/webhook/:provider", async (c) => {
    const providerName = c.req.param("provider");

    // 解析渠道 provider：未启用/未知渠道无凭证可验签 —— fail-closed 拒绝（R12.2）。
    const manager = await getPaymentManager();
    const provider = manager.getProvider(providerName);
    if (!provider) {
      logger.warn(
        `[webhook] provider unavailable, rejecting callback: ${providerName}`
      );
      return c.json(respErr("unauthorized"), UNAUTHORIZED);
    }

    // 验签并取归一化事件（R12.1）。验签失败一律拒绝且零副作用（R12.2）。
    let event: PaymentEvent;
    try {
      event = await provider.getPaymentEvent({ req: c.req.raw });
    } catch (err) {
      logger.warn(
        `[webhook] signature verification failed: ${providerName} - ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return c.json(respErr("invalid webhook signature"), UNAUTHORIZED);
    }

    // 验签通过后再做业务编排（R12.3/R12.4/R12.5）；编排异常交由 app.onError 统一处理。
    await handlePaymentEvent(event, providerName);

    return c.json(respData({ received: true }));
  });