import { type NewOrder, order } from "../../../db/schema";
import { db } from "../../../db/server";
import { getUniSeq, getUuid } from "@openstarter/shared/id";
import { getPaymentManager } from "./manager";
import {
  type CheckoutSession,
  type PaymentOrder,
  PaymentProviderUnavailableError,
  type WechatQrData,
} from "./types";

export const OrderStatus = {
  PENDING: "pending",
  CREATED: "created",
  PAID: "paid",
  FAILED: "failed",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ORDER_NO_METADATA_KEY = "order_no";

const DEFAULT_CURRENCY = "usd";

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

export interface CreateCheckoutResult {
  orderNo: string;
  provider: string;
  sessionId: string;
  checkoutUrl: string;
  qrData?: WechatQrData;
  session: CheckoutSession;
}

export async function createCheckout(params: CreateCheckoutParams): Promise<CreateCheckoutResult> {
  const { userId, userEmail, paymentOrder } = params;

  const manager = await getPaymentManager();

  const providerName = params.provider || manager.getDefaultProvider()?.name;
  if (!providerName) {
    throw new PaymentProviderUnavailableError(params.provider ?? "default");
  }
  const provider = manager.getProvider(providerName);
  if (!provider) {
    throw new PaymentProviderUnavailableError(providerName);
  }

  const orderNo = getUniSeq("ORD");

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
