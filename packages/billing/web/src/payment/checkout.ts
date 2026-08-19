// 结账编排（对齐 ShipAny `modules/payment/service.ts` 的 createCheckout）。
//
// 任务 16.3：
//  - 解析所选渠道（显式 provider 优先，否则用默认渠道）；渠道未启用或凭证缺失时
//    拒绝发起并抛 {@link PaymentProviderUnavailableError}（R10.4）。
//  - 调用 provider.createPayment 发起结账，创建 `order` 记录（`status='created'`），
//    持久化所选 `paymentProvider` 与结账会话标识 `paymentSessionId`（R10.5）。
//  - 返回该渠道的结账链接/参数；微信支付另附二维码数据 `qrData`（R10.3）。
//
// 依赖分层：仅依赖 `@openstarter/db`（order 表 + db()）与 `@openstarter/shared`
// （id 生成），不依赖 api/auth；Webhook 成功编排（订阅创建/积分授予/置 paid）属
// 任务 18，不在此实现。

import { type NewOrder, order } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { getUniSeq, getUuid } from "@openstarter/shared/id";
import { getPaymentManager } from "./manager";
import {
  type CheckoutSession,
  type PaymentOrder,
  PaymentProviderUnavailableError,
  type WechatQrData,
} from "./types";

/**
 * 订单状态（as const + 联合类型，禁用 enum）。
 * 结账阶段创建为 `created`；后续 Webhook 编排（任务 18）迁移至 `paid`/`failed`。
 */
export const OrderStatus = {
  PENDING: "pending",
  CREATED: "created",
  PAID: "paid",
  FAILED: "failed",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

/**
 * 结账时注入到渠道 metadata 的订单号键（供 Webhook 成功编排跨渠道回关订单）。
 *
 * 四渠道均会原样回传该 metadata（Stripe `metadata`、支付宝 `passback_params`、
 * 微信 `attach`、PayPal `custom_id`），因此 Webhook 归一化事件的 `metadata[order_no]`
 * 即为本次结账的订单号，成功编排（任务 18.2）据此以纯归一化字段回关 `order`，
 * 无需感知各渠道原生标识差异。
 */
export const ORDER_NO_METADATA_KEY = "order_no";

const DEFAULT_CURRENCY = "usd";

/** createCheckout 入参。 */
export interface CreateCheckoutParams {
  userId: string;
  paymentOrder: PaymentOrder;
  provider?: string;
  userEmail?: string;
  productName?: string;
  planName?: string;
  credits?: number;
  creditsValidDays?: number;
}

/** createCheckout 返回：订单号 + 渠道结账信息（微信含二维码数据）。 */
export interface CreateCheckoutResult {
  orderNo: string;
  provider: string;
  sessionId: string;
  checkoutUrl: string;
  qrData?: WechatQrData;
  session: CheckoutSession;
}

/**
 * 发起结账并落库订单（R10.2/R10.3/R10.4/R10.5）。
 *
 * @throws {PaymentProviderUnavailableError} 所选渠道未启用或凭证缺失时（R10.4）。
 */
export async function createCheckout(params: CreateCheckoutParams): Promise<CreateCheckoutResult> {
  const { userId, userEmail, paymentOrder } = params;

  const manager = await getPaymentManager();

  // 解析渠道：显式指定优先，否则回退默认渠道。二者都取不到即视为渠道不可用（R10.4）。
  const providerName = params.provider || manager.getDefaultProvider()?.name;
  if (!providerName) {
    throw new PaymentProviderUnavailableError(params.provider ?? "default");
  }
  const provider = manager.getProvider(providerName);
  if (!provider) {
    throw new PaymentProviderUnavailableError(providerName);
  }

  const orderNo = getUniSeq("ORD");

  // 发起结账：注入订单号，并把订单号写入 metadata（随渠道原样回传），供 Webhook
  // 成功编排跨渠道回关订单（见 {@link ORDER_NO_METADATA_KEY}）；其余（成功/取消
  // 回跳 URL 等）由调用方在 paymentOrder 提供。保留调用方既有 metadata（合并注入）。
  const session = await provider.createPayment({
    order: {
      ...paymentOrder,
      orderNo,
      metadata: {
        ...paymentOrder.metadata,
        [ORDER_NO_METADATA_KEY]: orderNo,
      },
    },
  });

  // 创建订单记录：status='created'，持久化所选渠道与结账会话标识（R10.5）。
  const newOrder: NewOrder = {
    id: getUuid(),
    orderNo,
    userId,
    userEmail: userEmail ?? "",
    status: OrderStatus.CREATED,
    amount: paymentOrder.price?.amount ?? 0,
    currency: paymentOrder.price?.currency ?? DEFAULT_CURRENCY,
    productId: paymentOrder.productId ?? null,
    productName: params.productName ?? null,
    planName: params.planName ?? null,
    creditsAmount: params.credits ?? null,
    creditsValidDays: params.creditsValidDays ?? null,
    paymentType: paymentOrder.type ?? "one-time",
    paymentProvider: session.provider,
    paymentSessionId: session.checkoutInfo.sessionId,
    checkoutInfo: JSON.stringify(session.checkoutInfo),
    checkoutResult: JSON.stringify(session.checkoutResult),
    checkoutUrl: session.checkoutInfo.checkoutUrl,
    description: paymentOrder.description ?? null,
  };

  await db().insert(order).values(newOrder);

  return {
    orderNo,
    provider: session.provider,
    sessionId: session.checkoutInfo.sessionId,
    checkoutUrl: session.checkoutInfo.checkoutUrl,
    qrData: session.qrData,
    session,
  };
}
