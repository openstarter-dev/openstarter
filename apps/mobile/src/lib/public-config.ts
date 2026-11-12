export const MOBILE_SOCIAL_PROVIDERS = ["google", "apple"] as const;

export type MobileSocialProvider = (typeof MOBILE_SOCIAL_PROVIDERS)[number];

export type PublicConfig = Record<string, string>;

export interface EnabledAuthMethods {
  emailPassword: boolean;
  passwordReset: boolean;
  socialProviders: MobileSocialProvider[];
}

const SWITCH_KEYS: Record<MobileSocialProvider, string> = {
  apple: "apple_auth_enabled",
  google: "google_auth_enabled",
};

export function resolveEnabledProviders(config: PublicConfig): EnabledAuthMethods {
  const socialProviders: MobileSocialProvider[] = [];
  for (const provider of MOBILE_SOCIAL_PROVIDERS) {
    if (config[SWITCH_KEYS[provider]] === "true") {
      socialProviders.push(provider);
    }
  }

  return {
    emailPassword: config.email_auth_enabled !== "false",
    passwordReset: config.password_reset_enabled === "true",
    socialProviders,
  };
}

/** 无密码登录模式：magic link（点邮件里的链接）或 email OTP（回填验证码）。 */
export type PasswordlessMode = "email-otp" | "magic-link";

export interface EnabledPasswordlessModes {
  emailOtp: boolean;
  magicLink: boolean;
}

/**
 * 由公开配置解析可用的无密码模式（严格 === "true"，对齐服务端 isEnabled）。
 * 两个开关都关时返回空集合 —— 调用方据此不渲染无密码入口。
 */
export function resolvePasswordlessModes(config: PublicConfig): EnabledPasswordlessModes {
  return {
    emailOtp: config.email_otp_enabled === "true",
    magicLink: config.magic_link_enabled === "true",
  };
}
