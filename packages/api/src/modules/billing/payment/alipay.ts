// 支付宝（Alipay）支付渠道实现（对齐 ShipAny `core/payment/alipay.ts`）。
//
// 以 fetch + RSA2 签名实现（不引入 SDK）：createPayment 生成签名后的电脑网站
// 支付跳转链接；getPaymentSession 查询交易状态；getPaymentEvent 验签异步通知
// （用支付宝公钥校验 RSA 签名，fail-closed）。

import { createSign, createVerify } from "node:crypto";
import {
  type CheckoutSession,
  type PaymentEvent,
  PaymentEventType,
  type PaymentOrder,
  type PaymentProvider,
  type PaymentSession,
  PaymentStatus,
} from "./types";

/** 支付宝渠道配置。 */
export interface AlipayConfigs {
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
  signType?: "RSA2" | "RSA";
  returnUrl?: string;
  notifyUrl?: string;
}

interface AlipayTradeQueryResponse {
  code?: string;
  msg?: string;
  sub_msg?: string;
  trade_status?: string;
  trade_no?: string;
  total_amount?: string;
  buyer_pay_amount?: string;
  buyer_user_id?: string;
  buyer_logon_id?: string;
  send_pay_date?: string;
  passback_params?: string;
}

const ALIPAY_GATEWAY = "https://openapi.alipay.com/gateway.do";
const CENTS_PER_UNIT = 100;

/** 支付宝渠道 provider。 */
export class AlipayProvider implements PaymentProvider {
  readonly name = "alipay";

  private readonly configs: AlipayConfigs;

  constructor(configs: AlipayConfigs) {
    this.configs = configs;
  }

  createPayment({ order }: { order: PaymentOrder }): Promise<CheckoutSession> {
    if (!order.price) {
      throw new Error("price is required for Alipay payment");
    }

    const outTradeNo = order.orderNo || `ALI${Date.now()}`;
    const totalAmount = (order.price.amount / CENTS_PER_UNIT).toFixed(2);

    const bizContent = {
      out_trade_no: outTradeNo,
      total_amount: totalAmount,
      subject: order.description || "Payment",
      product_code: "FAST_INSTANT_TRADE_PAY",
      passback_params: order.metadata
        ? encodeURIComponent(JSON.stringify(order.metadata))
        : undefined,
    };

    const params = this.buildRequestParams("alipay.trade.page.pay", bizContent);

    const baseReturnUrl = order.successUrl || this.configs.returnUrl || "";
    if (baseReturnUrl) {
      const sep = baseReturnUrl.includes("?") ? "&" : "?";
      params.return_url = `${baseReturnUrl}${sep}order_no=${outTradeNo}`;
    }
    if (this.configs.notifyUrl) {
      params.notify_url = this.configs.notifyUrl;
    }

    const signedParams = this.signParams(params);
    const checkoutUrl = `${ALIPAY_GATEWAY}?${new URLSearchParams(signedParams).toString()}`;

    return Promise.resolve({
      provider: this.name,
      checkoutParams: signedParams,
      checkoutInfo: { sessionId: outTradeNo, checkoutUrl },
      checkoutResult: { outTradeNo, totalAmount },
      metadata: order.metadata || {},
    });
  }

  async getPaymentSession({ sessionId }: { sessionId: string }): Promise<PaymentSession> {
    const result = await this.execute("alipay.trade.query", {
      out_trade_no: sessionId,
    });
    const response = result.alipay_trade_query_response;

    if (!response || response.code !== "10000") {
      throw new Error(response?.sub_msg || response?.msg || "Query payment failed");
    }

    return {
      provider: this.name,
      paymentStatus: mapAlipayStatus(response.trade_status),
      paymentInfo: {
        transactionId: response.trade_no,
        amount: toCents(response.total_amount),
        currency: "cny",
        paymentAmount: toCents(response.buyer_pay_amount || response.total_amount),
        paymentCurrency: "cny",
        paymentUserId: response.buyer_user_id,
        paymentEmail: response.buyer_logon_id,
        paidAt: response.send_pay_date ? new Date(response.send_pay_date) : undefined,
      },
      paymentResult: response,
      metadata: parsePassback(response.passback_params),
    };
  }

  async getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent> {
    const body = await req.text();
    const params = Object.fromEntries(new URLSearchParams(body));

    if (!this.verifySignature(params)) {
      throw new Error("Invalid Alipay notification signature");
    }

    const tradeStatus = params.trade_status;
    let eventType: PaymentEventType;
    switch (tradeStatus) {
      case "TRADE_SUCCESS":
      case "TRADE_FINISHED":
        eventType = PaymentEventType.PAYMENT_SUCCESS;
        break;
      case "TRADE_CLOSED":
        eventType = PaymentEventType.PAYMENT_FAILED;
        break;
      default:
        throw new Error(`Unhandled Alipay trade status: ${tradeStatus}`);
    }

    const paymentSession: PaymentSession = {
      provider: this.name,
      paymentStatus:
        eventType === PaymentEventType.PAYMENT_SUCCESS
          ? PaymentStatus.SUCCESS
          : PaymentStatus.FAILED,
      paymentInfo: {
        transactionId: params.trade_no,
        amount: toCents(params.total_amount),
        currency: "cny",
        paymentAmount: toCents(params.buyer_pay_amount || params.total_amount),
        paymentCurrency: "cny",
        paymentUserId: params.buyer_id,
        paymentEmail: params.buyer_logon_id,
        paidAt: params.gmt_payment ? new Date(params.gmt_payment) : undefined,
      },
      paymentResult: params,
      metadata: parsePassback(params.passback_params),
    };

    return { eventType, eventResult: params, paymentSession };
  }

  // ─── 私有辅助 ────────────────────────────────────────────────────────────

  private async execute(
    method: string,
    bizContent: Record<string, unknown>,
  ): Promise<{ alipay_trade_query_response?: AlipayTradeQueryResponse }> {
    const params = this.buildRequestParams(method, bizContent);
    if (this.configs.notifyUrl) {
      params.notify_url = this.configs.notifyUrl;
    }
    const signedParams = this.signParams(params);

    const response = await fetch(ALIPAY_GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(signedParams).toString(),
    });

    return (await response.json()) as {
      alipay_trade_query_response?: AlipayTradeQueryResponse;
    };
  }

  private buildRequestParams(
    method: string,
    bizContent: Record<string, unknown>,
  ): Record<string, string> {
    return {
      app_id: this.configs.appId,
      method,
      format: "JSON",
      charset: "utf-8",
      sign_type: this.configs.signType || "RSA2",
      timestamp: formatTimestamp(new Date()),
      version: "1.0",
      biz_content: JSON.stringify(bizContent),
    };
  }

  private signParams(params: Record<string, string>): Record<string, string> {
    const signStr = buildSignString(params, []);
    const algorithm = (this.configs.signType || "RSA2") === "RSA2" ? "RSA-SHA256" : "RSA-SHA1";

    const sign = createSign(algorithm)
      .update(signStr, "utf-8")
      .sign(normalizePrivateKey(this.configs.privateKey), "base64");

    return { ...params, sign };
  }

  private verifySignature(params: Record<string, string>): boolean {
    const sign = params.sign;
    if (!sign) {
      return false;
    }
    const signType = params.sign_type || this.configs.signType || "RSA2";
    const signStr = buildSignString(params, ["sign", "sign_type"]);
    const algorithm = signType === "RSA2" ? "RSA-SHA256" : "RSA-SHA1";

    return createVerify(algorithm)
      .update(signStr, "utf-8")
      .verify(normalizePublicKey(this.configs.alipayPublicKey), sign, "base64");
  }
}

// ─── 纯辅助（模块级） ────────────────────────────────────────────────────────

/** 按键名字典序拼接 `k=v&...`，排除空值与 `exclude` 中的键。 */
function buildSignString(params: Record<string, string>, exclude: string[]): string {
  return Object.keys(params)
    .filter((k) => !exclude.includes(k))
    .sort()
    .filter((k) => params[k] !== undefined && params[k] !== "")
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

function toCents(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * CENTS_PER_UNIT) : 0;
}

function parsePassback(passback: string | undefined): Record<string, unknown> | undefined {
  if (!passback) {
    return undefined;
  }
  try {
    return JSON.parse(decodeURIComponent(passback)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function mapAlipayStatus(status: string | undefined): PaymentStatus {
  switch (status) {
    case "TRADE_SUCCESS":
    case "TRADE_FINISHED":
      return PaymentStatus.SUCCESS;
    case "TRADE_CLOSED":
      return PaymentStatus.CANCELED;
    default:
      return PaymentStatus.PROCESSING;
  }
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatTimestamp(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function normalizePrivateKey(key: string): string {
  if (key.includes("-----BEGIN")) {
    return key;
  }
  return `-----BEGIN RSA PRIVATE KEY-----\n${key}\n-----END RSA PRIVATE KEY-----`;
}

function normalizePublicKey(key: string): string {
  if (key.includes("-----BEGIN")) {
    return key;
  }
  return `-----BEGIN PUBLIC KEY-----\n${key}\n-----END PUBLIC KEY-----`;
}

/** 依配置创建支付宝 provider。 */
export function createAlipayProvider(configs: AlipayConfigs): AlipayProvider {
  return new AlipayProvider(configs);
}
