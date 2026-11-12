// packages/api/src/modules/billing —— 结账与支付回调路由（R12）。
//
// 路由只负责：挂鉴权、校验入参、读取渠道名/原始请求，并把领域结果映射为
// 结构化响应。产品定价、订单构造、webhook 验签与事件编排均在 ./service。

import { zValidator } from "@hono/zod-validator";
import { respData, respErr } from "@openstarter/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

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

    // RevenueCat 走独立门禁（商店代扣集成，不进 PaymentManager；见 ./service）。
    const result =
      providerName === REVENUECAT_PROVIDER
        ? await processRevenueCatWebhook(c.req.raw)
        : await processPaymentWebhook(providerName, c.req.raw);

    return result.ok
      ? c.json(respData({ received: true }))
      : c.json(respErr(result.message), UNAUTHORIZED);
  });
