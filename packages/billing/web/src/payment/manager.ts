// 支付渠道管理器与「按 Config 动态装配」（对齐 ShipAny `core/payment/index.ts`
// 的 PaymentManager 与 `modules/payment/service.ts` 的 getPaymentManager）。
//
// 任务 16.1：
//  - `PaymentManager`：登记/查取已启用渠道 provider 的容器。
//  - `getPaymentManager()`：读取 Config，按「渠道已启用且凭证齐备」装配 provider，
//    并在相关 Config 变化（hash 改变）时重建（缓存于模块级）。
//
// 说明：与 ShipAny 不同，本 `getProvider(name)` **不做**「找不到即回退默认渠道」，
// 而是精确返回同名 provider 或 `undefined`，以便结账编排据此对「未启用/凭证缺失」
// 的渠道明确拒绝（R10.4）。

import { getAllConfigs } from "@openstarter/shared/config";
import { createAlipayProvider } from "./alipay";
import { createPayPalProvider } from "./paypal";
import { createStripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";
import { createWechatPayProvider } from "./wechat";

/**
 * 支付渠道管理器：持有一组已装配的渠道 provider，并提供按名取用的入口。
 */
export class PaymentManager {
  private readonly providers: PaymentProvider[] = [];
  private defaultProvider?: PaymentProvider;

  /** 登记一个渠道 provider；`isDefault` 为真时设为默认渠道。 */
  addProvider(provider: PaymentProvider, isDefault = false): void {
    this.providers.push(provider);
    if (isDefault) {
      this.defaultProvider = provider;
    }
  }

  /** 按渠道名取 provider；不存在返回 `undefined`（不回退默认，见文件头说明）。 */
  getProvider(name: string): PaymentProvider | undefined {
    return this.providers.find((p) => p.name === name);
  }

  /** 已装配的全部渠道名。 */
  getProviderNames(): string[] {
    return this.providers.map((p) => p.name);
  }

  /** 默认渠道：显式设定优先，否则取首个已装配渠道（可能为 undefined）。 */
  getDefaultProvider(): PaymentProvider | undefined {
    if (!this.defaultProvider && this.providers.length > 0) {
      this.defaultProvider = this.providers[0];
    }
    return this.defaultProvider;
  }
}

// ─── 按 Config 动态装配（含 hash 重建） ───────────────────────────────────────

let cachedManager: PaymentManager | null = null;
let cachedHash = "";

/** 判断渠道是否「已启用」（对应 `{provider}_enabled` 开关）。 */
function isEnabled(configs: Record<string, string>, provider: string): boolean {
  return configs[`${provider}_enabled`] === "true";
}

function assembleStripe(
  manager: PaymentManager,
  configs: Record<string, string>,
  defaultProvider: string,
): void {
  const secretKey = configs.stripe_secret_key || "";
  if (!(isEnabled(configs, "stripe") && secretKey)) {
    return;
  }
  manager.addProvider(
    createStripeProvider({
      secretKey,
      publishableKey: configs.stripe_publishable_key || undefined,
      signingSecret: configs.stripe_signing_secret || undefined,
      allowPromotionCodes: true,
      allowedPaymentMethods: ["card", "wechat_pay", "alipay"],
    }),
    defaultProvider === "stripe" || defaultProvider === "",
  );
}

function assemblePayPal(
  manager: PaymentManager,
  configs: Record<string, string>,
  defaultProvider: string,
): void {
  const clientId = configs.paypal_client_id || "";
  const clientSecret = configs.paypal_client_secret || "";
  if (!(isEnabled(configs, "paypal") && clientId && clientSecret)) {
    return;
  }
  manager.addProvider(
    createPayPalProvider({
      clientId,
      clientSecret,
      webhookId: configs.paypal_webhook_id || undefined,
      environment: configs.paypal_environment === "live" ? "production" : "sandbox",
    }),
    defaultProvider === "paypal",
  );
}

function assembleAlipay(
  manager: PaymentManager,
  configs: Record<string, string>,
  defaultProvider: string,
): void {
  const appId = configs.alipay_app_id || "";
  const privateKey = configs.alipay_private_key || "";
  if (!(isEnabled(configs, "alipay") && appId && privateKey)) {
    return;
  }
  manager.addProvider(
    createAlipayProvider({
      appId,
      privateKey,
      alipayPublicKey: configs.alipay_public_key || "",
      notifyUrl: configs.alipay_notify_url || undefined,
    }),
    defaultProvider === "alipay",
  );
}

function assembleWechat(
  manager: PaymentManager,
  configs: Record<string, string>,
  defaultProvider: string,
): void {
  const mchId = configs.wechat_mch_id || "";
  const privateKey = configs.wechat_private_key || "";
  const appId = configs.wechat_app_id || "";
  if (!(isEnabled(configs, "wechat") && appId && mchId && privateKey)) {
    return;
  }
  manager.addProvider(
    createWechatPayProvider({
      appId,
      mchId,
      privateKey,
      apiV3Key: configs.wechat_api_v3_key || "",
      serialNo: configs.wechat_serial_no || "",
      notifyUrl: configs.wechat_notify_url || undefined,
      platformCert: configs.wechat_platform_cert || undefined,
    }),
    defaultProvider === "wechat",
  );
}

/** 相关 Config 的指纹：任一支付相关键变化即触发管理器重建。 */
function computeConfigHash(configs: Record<string, string>): string {
  return JSON.stringify([
    configs.default_payment_provider || "",
    configs.stripe_enabled || "",
    configs.stripe_secret_key || "",
    configs.paypal_enabled || "",
    configs.paypal_client_id || "",
    configs.paypal_client_secret || "",
    configs.alipay_enabled || "",
    configs.alipay_app_id || "",
    configs.alipay_private_key || "",
    configs.wechat_enabled || "",
    configs.wechat_mch_id || "",
    configs.wechat_private_key || "",
  ]);
}

/**
 * 读取 Config 并装配已启用渠道；相关 Config 未变时复用缓存实例，变化时重建。
 * 仅装配「已启用且凭证齐备」的渠道，未启用/凭证缺失的渠道不会被登记
 * （据此结账编排可对其明确拒绝，R10.4）。
 */
export async function getPaymentManager(): Promise<PaymentManager> {
  const configs = await getAllConfigs();
  const hash = computeConfigHash(configs);

  if (cachedManager && hash === cachedHash) {
    return cachedManager;
  }

  const manager = new PaymentManager();
  const defaultProvider = configs.default_payment_provider || "";

  assembleStripe(manager, configs, defaultProvider);
  assemblePayPal(manager, configs, defaultProvider);
  assembleAlipay(manager, configs, defaultProvider);
  assembleWechat(manager, configs, defaultProvider);

  cachedManager = manager;
  cachedHash = hash;
  return manager;
}
