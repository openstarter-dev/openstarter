// packages/api/src/modules/billing/service —— 结账与支付回调的领域编排。
//
// 路由层只解析请求、读取头部并映射状态码；本服务负责：
//   - 结账：按 `productId` 解析服务端定价 → 构造 PaymentOrder → 调渠道 createCheckout。
//     未知产品与渠道不可用以可判别结果返回（{@link CheckoutResult}），由路由转结构化响应。
//   - 回调：渠道 webhook 的 fail-closed 三段校验（开关/凭证 → 验签 → 事件编排）；
//     RevenueCat 走独立门禁（商店代扣集成，不进 PaymentManager）。
//   - 商店商品反查注入：金额/积分始终以服务端目录为唯一事实来源。

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

/** RevenueCat 渠道标识：回调走独立门禁，不参与渠道编排。 */
export const REVENUECAT_PROVIDER = "revenuecat";

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

// ─── 结账（Checkout） ─────────────────────────────────────────────────────────

export interface StartCheckoutParams {
  origin: string;
  productId: string;
  provider?: string;
  userEmail?: string;
  userId: string;
}

/** 结账结果：未知产品 / 渠道不可用以 reason 区分，由路由映射 HTTP 状态。 */
export type CheckoutResult =
  | { checkout: Awaited<ReturnType<typeof createCheckout>>; ok: true }
  | { message: string; ok: false; reason: "provider_unavailable" | "unknown_product" };

/** 由目录条目构造渠道无关的支付订单（价格/货币/积分均取自服务端目录）。 */
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

/**
 * 发起结账：服务端定价（未知产品直接拒绝，不落任何订单）→ 构造订单 → 渠道下单。
 * 渠道未启用/凭证缺失归一化为 `provider_unavailable`；其余异常原样上抛。
 */
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

// ─── 回调（Webhook） ─────────────────────────────────────────────────────────

/** 回调处理结果：`ok: false` 一律由路由映射为 401（fail-closed）。 */
export type WebhookResult = { message: string; ok: false } | { ok: true };

/**
 * 通用渠道回调：先解析渠道 provider（未启用/未知渠道无凭证可验签 → 拒绝），
 * 再验签取归一化事件，最后交给事件编排。验签失败零副作用。
 */
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

  // 验签通过后再做业务编排（R12.3/R12.4/R12.5）；编排异常交由 app.onError 统一处理。
  await handlePaymentEvent(event, providerName);
  return { ok: true };
}

/**
 * RevenueCat 回调：与四渠道门禁同构的 fail-closed 三段校验 ——
 * ① 开关关 / secret 缺失 → 拒绝（无凭证可验签）；
 * ② 验签失败（含时间容差外）→ 拒绝，零副作用；
 * ③ 通过后委托 mapRevenueCatEvent 做事件映射与既有编排。
 * 签名对原始字节计算：此处直接读 `request.text()`，不得经 JSON 重序列化。
 */
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
