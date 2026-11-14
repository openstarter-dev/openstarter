// Payment provider manager with declarative env-driven assembly.
// 支付渠道管理器与基于环境变量的声明式装配。

import { readBooleanEnv, readEnv } from "../env";
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

// ─── Env-driven provider assembly with hash-based cache / 基于环境变量的渠道装配与缓存 ─

let cachedManager: PaymentManager | null = null;
let cachedHash = "";

type ProviderAssembler = {
  isDefault: (defaultProvider: string) => boolean;
  build: () => PaymentProvider | null;
};

// Registry of supported payment providers; each builds only when enabled and credentials are present.
// 已支持支付渠道的装配注册表；仅当开关未关闭且必需凭证齐备时构造对应实例。
const PAYMENT_PROVIDER_ASSEMBLERS: readonly ProviderAssembler[] = [
  {
    isDefault: (defaultProvider) => defaultProvider === "stripe" || defaultProvider === "",
    build: () => {
      const secretKey = readEnv("STRIPE_SECRET_KEY");
      if (!(readBooleanEnv("STRIPE_ENABLED", true) && secretKey)) {
        return null;
      }
      return createStripeProvider({
        secretKey,
        publishableKey: readEnv("STRIPE_PUBLISHABLE_KEY") || undefined,
        signingSecret: readEnv("STRIPE_SIGNING_SECRET") || undefined,
        allowPromotionCodes: true,
        allowedPaymentMethods: ["card", "wechat_pay", "alipay"],
      });
    },
  },
  {
    isDefault: (defaultProvider) => defaultProvider === "paypal",
    build: () => {
      const clientId = readEnv("PAYPAL_CLIENT_ID");
      const clientSecret = readEnv("PAYPAL_CLIENT_SECRET");
      if (!(readBooleanEnv("PAYPAL_ENABLED", true) && clientId && clientSecret)) {
        return null;
      }
      return createPayPalProvider({
        clientId,
        clientSecret,
        webhookId: readEnv("PAYPAL_WEBHOOK_ID") || undefined,
        environment: readEnv("PAYPAL_ENVIRONMENT") === "live" ? "production" : "sandbox",
      });
    },
  },
  {
    isDefault: (defaultProvider) => defaultProvider === "alipay",
    build: () => {
      const appId = readEnv("ALIPAY_APP_ID");
      const privateKey = readEnv("ALIPAY_PRIVATE_KEY");
      if (!(readBooleanEnv("ALIPAY_ENABLED", true) && appId && privateKey)) {
        return null;
      }
      return createAlipayProvider({
        appId,
        privateKey,
        alipayPublicKey: readEnv("ALIPAY_PUBLIC_KEY"),
        notifyUrl: readEnv("ALIPAY_NOTIFY_URL") || undefined,
      });
    },
  },
  {
    isDefault: (defaultProvider) => defaultProvider === "wechat",
    build: () => {
      const appId = readEnv("WECHAT_APP_ID");
      const mchId = readEnv("WECHAT_MCH_ID");
      const privateKey = readEnv("WECHAT_PRIVATE_KEY");
      if (!(readBooleanEnv("WECHAT_ENABLED", true) && appId && mchId && privateKey)) {
        return null;
      }
      return createWechatPayProvider({
        appId,
        mchId,
        privateKey,
        apiV3Key: readEnv("WECHAT_API_V3_KEY"),
        serialNo: readEnv("WECHAT_SERIAL_NO"),
        notifyUrl: readEnv("WECHAT_NOTIFY_URL") || undefined,
        platformCert: readEnv("WECHAT_PLATFORM_CERT") || undefined,
      });
    },
  },
];

// Full list of env keys affecting provider assembly so credential/flag changes invalidate cache.
// 覆盖全部支付装配环境变量键，确保任意密钥、回调地址或开关变化都能刷新缓存。
const PAYMENT_ENV_KEYS = [
  "DEFAULT_PAYMENT_PROVIDER",
  "STRIPE_ENABLED",
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_SIGNING_SECRET",
  "PAYPAL_ENABLED",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_WEBHOOK_ID",
  "PAYPAL_ENVIRONMENT",
  "ALIPAY_ENABLED",
  "ALIPAY_APP_ID",
  "ALIPAY_PRIVATE_KEY",
  "ALIPAY_PUBLIC_KEY",
  "ALIPAY_NOTIFY_URL",
  "WECHAT_ENABLED",
  "WECHAT_APP_ID",
  "WECHAT_MCH_ID",
  "WECHAT_PRIVATE_KEY",
  "WECHAT_API_V3_KEY",
  "WECHAT_SERIAL_NO",
  "WECHAT_NOTIFY_URL",
  "WECHAT_PLATFORM_CERT",
] as const;

/**
 * Compute a fingerprint over payment env variables to detect runtime/test env updates.
 * 计算支付相关环境变量指纹，用于在测试或运行时环境变量变更时重建管理器。
 */
function computeEnvHash(): string {
  return JSON.stringify(PAYMENT_ENV_KEYS.map((key) => readEnv(key)));
}

/**
 * Assemble enabled payment providers from Web environment variables and cache by env fingerprint.
 * 从环境变量读取凭证并装配已启用支付渠道，配置指纹未变时复用缓存实例。
 */
export async function getPaymentManager(): Promise<PaymentManager> {
  const hash = computeEnvHash();

  if (cachedManager && hash === cachedHash) {
    return cachedManager;
  }

  const manager = new PaymentManager();
  const defaultProvider = readEnv("DEFAULT_PAYMENT_PROVIDER");

  for (const assembler of PAYMENT_PROVIDER_ASSEMBLERS) {
    const provider = assembler.build();
    if (provider) {
      manager.addProvider(provider, assembler.isDefault(defaultProvider));
    }
  }

  cachedManager = manager;
  cachedHash = hash;
  return manager;
}
