import { zValidator } from "@hono/zod-validator";
import {
  createCheckout,
  type PaymentOrder,
  PaymentProviderUnavailableError,
  getPaymentManager,
  handlePaymentEvent,
  type PaymentEvent,
} from "@openstarter/billing-web/payment";
import {
  configureRevenueCatProducts,
  mapRevenueCatEvent,
  SIGNATURE_HEADER,
  verifyRevenueCatWebhook,
} from "@openstarter/billing-web/payment/revenuecat";
import { getAllConfigs } from "@openstarter/shared/config";
import { respData, respErr } from "@openstarter/shared";
import { logger } from "@openstarter/shared/logger";
import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";

import { requireAuth } from "../../middleware/auth";
import { checkoutBody } from "../../schema/billing";
import { resolveProduct, resolveProductByIapId } from "./products";

const PROVIDER_UNAVAILABLE_STATUS = 400;
const UNAUTHORIZED = 401;
const UNKNOWN_PRODUCT_STATUS = 400;
const REVENUECAT_PROVIDER = "revenuecat";

// 依赖倒置：把「商店商品 ID → 目录条目」的反查注入 billing-web 的 RC 模块，
// 金额/积分始终以服务端目录为唯一事实来源。
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

export const billingRouter = new Hono()
  .post("/checkout", requireAuth, zValidator("json", checkoutBody), async (c) => {
    const body = c.req.valid("json");
    const session = c.get("session");
    const origin = new URL(c.req.url).origin;

    // 服务端定价：未知产品直接拒绝，不落任何订单。
    const product = resolveProduct(body.productId);
    if (!product) {
      throw new HTTPException(UNKNOWN_PRODUCT_STATUS, {
        message: `unknown product: ${body.productId}`,
      });
    }

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

    try {
      const result = await createCheckout({
        credits: product.credits,
        creditsValidDays: product.creditsValidDays,
        paymentOrder,
        planName: product.planName,
        productName: product.productName,
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
        }),
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

    // RevenueCat 走独立门禁（商店代扣集成，不进 PaymentManager；见下）。
    if (providerName === REVENUECAT_PROVIDER) {
      return handleRevenueCatWebhook(c);
    }

    // 解析渠道 provider：未启用/未知渠道无凭证可验签 —— fail-closed 拒绝（R12.2）。
    const manager = await getPaymentManager();
    const provider = manager.getProvider(providerName);
    if (!provider) {
      logger.warn(`[webhook] provider unavailable, rejecting callback: ${providerName}`);
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
        }`,
      );
      return c.json(respErr("invalid webhook signature"), UNAUTHORIZED);
    }

    // 验签通过后再做业务编排（R12.3/R12.4/R12.5）；编排异常交由 app.onError 统一处理。
    await handlePaymentEvent(event, providerName);

    return c.json(respData({ received: true }));
  });

/**
 * RevenueCat webhook：与四渠道门禁同构的 fail-closed 三段校验 ——
 * ① 开关关 / secret 缺失 → 401（无凭证可验签）；
 * ② 验签失败（含时间容差外）→ 401，零副作用；
 * ③ 通过后委托 mapRevenueCatEvent 做事件映射与既有编排。
 */
async function handleRevenueCatWebhook(c: Context): Promise<Response> {
  const configs = await getAllConfigs();
  const secret = configs.revenuecat_webhook_secret || "";
  if (!(configs.revenuecat_enabled === "true" && secret)) {
    logger.warn("[webhook] revenuecat disabled or secret missing, rejecting callback");
    return c.json(respErr("unauthorized"), UNAUTHORIZED);
  }

  // RC 签名对原始字节计算：必须读 raw body，不得经 JSON 重序列化。
  const rawBody = await c.req.raw.text();
  const signature = c.req.header(SIGNATURE_HEADER) || "";
  if (!verifyRevenueCatWebhook({ rawBody, secret, signature })) {
    logger.warn("[webhook] revenuecat signature verification failed");
    return c.json(respErr("invalid webhook signature"), UNAUTHORIZED);
  }

  try {
    const payload = JSON.parse(rawBody) as Parameters<typeof mapRevenueCatEvent>[0];
    await mapRevenueCatEvent(payload);
  } catch (err) {
    logger.error(
      `[webhook] revenuecat event handling failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    throw err;
  }

  return c.json(respData({ received: true }));
}
