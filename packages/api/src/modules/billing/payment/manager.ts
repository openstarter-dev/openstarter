import { readBooleanEnv, readEnv } from "../../../lib/env";
import { createAlipayProvider } from "./alipay";
import { createPayPalProvider } from "./paypal";
import { createStripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";
import { createWechatPayProvider } from "./wechat";

export class PaymentManager {
  private readonly providers: PaymentProvider[] = [];
  private defaultProvider?: PaymentProvider;

  addProvider(provider: PaymentProvider, isDefault = false): void {
    this.providers.push(provider);
    if (isDefault) {
      this.defaultProvider = provider;
    }
  }

  getProvider(name: string): PaymentProvider | undefined {
    return this.providers.find((p) => p.name === name);
  }

  getProviderNames(): string[] {
    return this.providers.map((p) => p.name);
  }

  getDefaultProvider(): PaymentProvider | undefined {
    if (!this.defaultProvider && this.providers.length > 0) {
      this.defaultProvider = this.providers[0];
    }
    return this.defaultProvider;
  }
}

let cachedManager: PaymentManager | null = null;
let cachedHash = "";

type ProviderAssembler = {
  isDefault: (defaultProvider: string) => boolean;
  build: () => PaymentProvider | null;
};

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

function computeEnvHash(): string {
  return JSON.stringify(PAYMENT_ENV_KEYS.map((key) => readEnv(key)));
}

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
