// packages/api/src/routes/webhook —— 支付渠道 Webhook 回调（R12.1/R12.2）。
//
// POST /api/payment/webhook/:provider：由支付渠道异步回调，**不挂 requireAuth**——
// 其真实性由**渠道验签**保证，而非会话/API Key 鉴权。流程：
//   1. 按路径 `:provider` 解析已启用渠道 provider；未启用/未知渠道无凭证可验签，
//      fail-closed 以 401 拒绝（零副作用）。
//   2. 经 `provider.getPaymentEvent({ req })` 验签并取归一化事件（R12.1）；验签失败
//      provider 抛错 —— 一律以 401 拒绝且**不产生任何数据变更**（R12.2）。
//   3. 验签通过后再调用 `@openstarter/billing` 的成功编排 `handlePaymentEvent`
//      （建订阅/授积分/置订单 paid 与订阅状态更新，含幂等，R12.3/R12.4/R12.5）。
//
// 编排阶段的异常（如数据库错误，非验签失败）不在此吞掉，交由 app.onError 统一返回
// 结构化 500，以便渠道按其重试策略重投（幂等编排保证重投不重复生效）。

import {
  getPaymentManager,
  handlePaymentEvent,
  type PaymentEvent,
} from "@openstarter/billing-web/payment";
import { respData, respErr } from "@openstarter/shared";
import { logger } from "@openstarter/shared/logger";
import { Hono } from "hono";

const UNAUTHORIZED = 401;

export const webhookRoute = new Hono().post(
  "/api/payment/webhook/:provider",
  async (c) => {
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
  }
);
