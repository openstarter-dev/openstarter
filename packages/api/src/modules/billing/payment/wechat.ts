// 微信支付（WeChat Pay Native, V3）渠道实现（对齐 ShipAny `core/payment/wechat.ts`）。
//
// 以 fetch + V3 API 实现（不引入 SDK）：createPayment 走 Native 下单，返回前端
// 渲染二维码所需数据（R10.3）；getPaymentSession 查询订单；getPaymentEvent 校验
// V3 回调签名（RSA-SHA256 + 平台证书，fail-closed + 时间窗校验）并用 AES-256-GCM
// 解密通知内容。

import { Buffer } from "node:buffer";
import { createDecipheriv, createSign, createVerify, randomBytes } from "node:crypto";
import {
  type CheckoutSession,
  type PaymentEvent,
  PaymentEventType,
  type PaymentOrder,
  type PaymentProvider,
  type PaymentSession,
  PaymentStatus,
} from "./types";

/** 微信支付渠道配置。 */
export interface WechatPayConfigs {
  appId: string;
  mchId: string;
  apiV3Key: string;
  privateKey: string;
  serialNo: string;
  notifyUrl?: string;
  platformCert?: string;
}

interface WechatNativeResponse {
  code_url?: string;
  message?: string;
}

interface WechatTradeResult {
  trade_state?: string;
  transaction_id?: string;
  amount?: { total?: number; payer_total?: number };
  payer?: { openid?: string };
  success_time?: string;
  attach?: string;
  message?: string;
}

interface WechatNotification {
  event_type?: string;
  resource?: {
    algorithm: string;
    ciphertext: string;
    associated_data?: string;
    nonce: string;
  };
}

const WECHAT_BASE_URL = "https://api.mch.weixin.qq.com";
const NONCE_BYTES = 16;
const MS_PER_SECOND = 1000;
const TIMESTAMP_WINDOW_SECONDS = 300;
const GCM_AUTH_TAG_LENGTH = 16;

/** 微信支付渠道 provider。 */
export class WechatPayProvider implements PaymentProvider {
  readonly name = "wechat";

  private readonly configs: WechatPayConfigs;

  constructor(configs: WechatPayConfigs) {
    this.configs = configs;
  }

  /**
   * Native 下单：返回 `code_url` 及前端渲染二维码所需数据（R10.3）。
   */
  async createPayment({ order }: { order: PaymentOrder }): Promise<CheckoutSession> {
    if (!order.price) {
      throw new Error("price is required for WeChat payment");
    }

    const outTradeNo = order.orderNo || `WX${Date.now()}`;
    const amount = order.price.amount;

    const payload = {
      appid: this.configs.appId,
      mchid: this.configs.mchId,
      description: order.description || "Payment",
      out_trade_no: outTradeNo,
      notify_url: this.configs.notifyUrl || "",
      amount: { total: amount, currency: "CNY" },
      attach: order.metadata ? JSON.stringify(order.metadata) : undefined,
    };

    const result = (await this.request(
      "POST",
      "/v3/pay/transactions/native",
      payload,
    )) as WechatNativeResponse;

    if (!result.code_url) {
      throw new Error(result.message || "WeChat Pay create order failed");
    }

    // Native 支付返回 code_url（weixin://wxpay/bizpayurl?pr=xxx）；前端将其渲染为
    // 二维码供用户扫码。qrData 即「前端渲染二维码所需数据」（R10.3）。
    return {
      provider: this.name,
      checkoutParams: payload,
      checkoutInfo: { sessionId: outTradeNo, checkoutUrl: result.code_url },
      checkoutResult: result,
      metadata: order.metadata || {},
      qrData: { codeUrl: result.code_url, outTradeNo, amount },
    };
  }

  async getPaymentSession({ sessionId }: { sessionId: string }): Promise<PaymentSession> {
    const result = (await this.request(
      "GET",
      `/v3/pay/transactions/out-trade-no/${sessionId}?mchid=${this.configs.mchId}`,
    )) as WechatTradeResult;

    if (!result.trade_state) {
      throw new Error(result.message || "Query payment failed");
    }

    return this.buildSession(result);
  }

  async getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent> {
    const body = await req.text();
    const timestamp = req.headers.get("Wechatpay-Timestamp") || "";
    const nonce = req.headers.get("Wechatpay-Nonce") || "";
    const signature = req.headers.get("Wechatpay-Signature") || "";

    if (!(timestamp && nonce && signature)) {
      throw new Error("Missing WeChat Pay webhook headers");
    }
    // fail-closed：无平台证书拒绝处理回调。
    if (!this.configs.platformCert) {
      throw new Error("WeChat platform certificate not configured");
    }

    // 拒绝过期/未来时间戳（±5 分钟窗口）。
    const tsNum = Number.parseInt(timestamp, 10);
    const nowSec = Math.floor(Date.now() / MS_PER_SECOND);
    if (!Number.isFinite(tsNum) || Math.abs(nowSec - tsNum) > TIMESTAMP_WINDOW_SECONDS) {
      throw new Error("WeChat webhook timestamp outside acceptable window");
    }

    // 验签：签名载荷为 `timestamp\nnonce\nbody\n`，用平台证书公钥校验（RSA-SHA256）。
    const signedPayload = `${timestamp}\n${nonce}\n${body}\n`;
    if (!this.verifySignature(signedPayload, signature)) {
      throw new Error("Invalid WeChat webhook signature");
    }

    const notification = JSON.parse(body) as WechatNotification;
    if (!notification.resource) {
      throw new Error("Invalid webhook payload");
    }

    const trade = JSON.parse(this.decryptResource(notification.resource)) as WechatTradeResult;

    const eventType =
      notification.event_type === "TRANSACTION.SUCCESS"
        ? PaymentEventType.PAYMENT_SUCCESS
        : PaymentEventType.PAYMENT_FAILED;

    return {
      eventType,
      eventResult: notification,
      paymentSession: this.buildSession(trade),
    };
  }

  // ─── 私有辅助 ────────────────────────────────────────────────────────────

  private buildSession(trade: WechatTradeResult): PaymentSession {
    return {
      provider: this.name,
      paymentStatus: mapTradeState(trade.trade_state),
      paymentInfo: {
        transactionId: trade.transaction_id,
        amount: trade.amount?.total,
        currency: "cny",
        paymentAmount: trade.amount?.payer_total ?? trade.amount?.total ?? 0,
        paymentCurrency: "cny",
        paymentUserId: trade.payer?.openid,
        paidAt: trade.success_time ? new Date(trade.success_time) : undefined,
      },
      paymentResult: trade,
      metadata: parseAttach(trade.attach),
    };
  }

  private async request(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    const timestamp = Math.floor(Date.now() / MS_PER_SECOND).toString();
    const nonce = randomBytes(NONCE_BYTES).toString("hex");
    const bodyStr = body ? JSON.stringify(body) : "";

    const signStr = `${method}\n${path}\n${timestamp}\n${nonce}\n${bodyStr}\n`;
    const sign = createSign("RSA-SHA256")
      .update(signStr)
      .sign(normalizePrivateKey(this.configs.privateKey), "base64");

    const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${this.configs.mchId}",nonce_str="${nonce}",signature="${sign}",timestamp="${timestamp}",serial_no="${this.configs.serialNo}"`;

    const res = await fetch(`${WECHAT_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: authorization,
      },
      body: body ? bodyStr : undefined,
    });

    if (res.status === 204) {
      return {};
    }
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message || `WeChat Pay API error: ${res.status}`);
    }
    return await res.json();
  }

  private verifySignature(signedPayload: string, signature: string): boolean {
    const cert = this.configs.platformCert;
    if (!cert) {
      return false;
    }
    try {
      return createVerify("RSA-SHA256")
        .update(signedPayload)
        .verify(normalizePlatformCert(cert), signature, "base64");
    } catch {
      return false;
    }
  }

  private decryptResource(resource: {
    ciphertext: string;
    associated_data?: string;
    nonce: string;
  }): string {
    const key = Buffer.from(this.configs.apiV3Key, "utf-8");
    const iv = Buffer.from(resource.nonce, "utf-8");
    const ciphertext = Buffer.from(resource.ciphertext, "base64");
    const aad = resource.associated_data
      ? Buffer.from(resource.associated_data, "utf-8")
      : Buffer.alloc(0);

    const authTag = ciphertext.subarray(ciphertext.length - GCM_AUTH_TAG_LENGTH);
    const data = ciphertext.subarray(0, ciphertext.length - GCM_AUTH_TAG_LENGTH);

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    if (aad.length > 0) {
      decipher.setAAD(aad);
    }

    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf-8");
  }
}

// ─── 纯辅助（模块级） ────────────────────────────────────────────────────────

function parseAttach(attach: string | undefined): Record<string, unknown> | undefined {
  if (!attach) {
    return undefined;
  }
  try {
    return JSON.parse(attach) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function mapTradeState(state: string | undefined): PaymentStatus {
  switch (state) {
    case "SUCCESS":
      return PaymentStatus.SUCCESS;
    case "CLOSED":
    case "REVOKED":
      return PaymentStatus.CANCELED;
    case "PAYERROR":
      return PaymentStatus.FAILED;
    default:
      return PaymentStatus.PROCESSING;
  }
}

function normalizePrivateKey(key: string): string {
  if (key.includes("-----BEGIN")) {
    return key;
  }
  return `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
}

function normalizePlatformCert(cert: string): string {
  if (cert.includes("-----BEGIN")) {
    return cert;
  }
  return `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`;
}

/** 依配置创建微信支付 provider。 */
export function createWechatPayProvider(configs: WechatPayConfigs): WechatPayProvider {
  return new WechatPayProvider(configs);
}
