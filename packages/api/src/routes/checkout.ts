// packages/api/src/routes/checkout —— 结账路由（R10.2/R10.3）。
//
// POST /api/checkout：挂 requireAuth（会话或有效 API Key），是受保护端点，
// 不接受匿名结账。入参含所选套餐/产品与支付渠道，调用 @openstarter/billing 的
// createCheckout 发起结账并落库订单，返回 { orderNo, provider, checkoutUrl, qrData? }
// （微信 Native 渠道另附二维码数据 qrData，供前端渲染扫码，R10.3）。
//
// 渠道未启用或凭证缺失（PaymentProviderUnavailableError，R10.4）时转为 HTTPException，
// 交由 app.onError 统一返回结构化 respErr —— 复用既有错误处理约定，不在此另造响应格式。
// 回跳 URL 由服务端依请求 origin 派生（不接受客户端传入，避免开放重定向）。

import { zValidator } from "@hono/zod-validator";
import {
  createCheckout,
  type PaymentOrder,
  PaymentProviderUnavailableError,
} from "@openstarter/billing/payment";
import { respData } from "@openstarter/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";

const DEFAULT_CURRENCY = "usd";
const DEFAULT_INTERVAL = "month";
const PROVIDER_UNAVAILABLE_STATUS = 400;

// 结账入参：所选产品/套餐（金额以最小货币单位，如「分」）与支付渠道。
// `provider` 省略时由结账编排回退到默认渠道；`type=subscription` 需订阅周期信息。
const checkoutBody = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1).optional(),
  planName: z.string().min(1).optional(),
  amount: z.number().int().nonnegative(),
  currency: z.string().min(1).default(DEFAULT_CURRENCY),
  type: z.enum(["one-time", "subscription", "renew"]).default("one-time"),
  description: z.string().min(1).optional(),
  credits: z.number().int().nonnegative().optional(),
  creditsValidDays: z.number().int().nonnegative().optional(),
  provider: z.string().min(1).optional(),
  interval: z.enum(["day", "week", "month", "year"]).optional(),
  intervalCount: z.number().int().positive().optional(),
});

export const checkoutRoute = new Hono().post(
  "/api/checkout",
  requireAuth,
  zValidator("json", checkoutBody),
  async (c) => {
    const body = c.req.valid("json");
    const session = c.get("session");
    const origin = new URL(c.req.url).origin;

    const paymentOrder: PaymentOrder = {
      type: body.type,
      productId: body.productId,
      price: { amount: body.amount, currency: body.currency },
      description: body.description ?? body.productName ?? body.productId,
      successUrl: `${origin}/dashboard?checkout=success`,
      cancelUrl: `${origin}/pricing`,
    };

    if (body.type === "subscription") {
      paymentOrder.plan = {
        name: body.planName ?? body.productName ?? body.productId,
        interval: body.interval ?? DEFAULT_INTERVAL,
        intervalCount: body.intervalCount,
      };
    }

    try {
      const result = await createCheckout({
        userId: c.get("userId"),
        userEmail: session?.user?.email,
        paymentOrder,
        provider: body.provider,
        productName: body.productName,
        planName: body.planName,
        credits: body.credits,
        creditsValidDays: body.creditsValidDays,
      });

      return c.json(
        respData({
          orderNo: result.orderNo,
          provider: result.provider,
          checkoutUrl: result.checkoutUrl,
          qrData: result.qrData,
        })
      );
    } catch (err) {
      if (err instanceof PaymentProviderUnavailableError) {
        // 渠道不可用（R10.4）：交由 app.onError 统一返回结构化 respErr。
        throw new HTTPException(PROVIDER_UNAVAILABLE_STATUS, {
          message: err.message,
        });
      }
      throw err;
    }
  }
);
