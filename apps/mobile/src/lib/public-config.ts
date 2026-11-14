// Mobile authentication UI switches resolved from Expo build-time environment variables.
// 移动端认证方式展示开关：直接从 Expo 客户端环境变量（EXPO_PUBLIC_*）读取，不再请求服务端 config 接口。

export type MobileSocialProvider = "google" | "apple";

export type PasswordlessMode = "magic-link" | "email-otp";

export interface MobileAuthEnv {
  EXPO_PUBLIC_APPLE_AUTH_ENABLED?: string;
  EXPO_PUBLIC_EMAIL_AUTH_ENABLED?: string;
  EXPO_PUBLIC_EMAIL_OTP_ENABLED?: string;
  EXPO_PUBLIC_GOOGLE_AUTH_ENABLED?: string;
  EXPO_PUBLIC_MAGIC_LINK_ENABLED?: string;
  EXPO_PUBLIC_PASSWORD_RESET_ENABLED?: string;
}

export interface EnabledAuthMethods {
  emailPassword: boolean;
  passwordReset: boolean;
  socialProviders: MobileSocialProvider[];
}

export interface EnabledPasswordlessModes {
  emailOtp: boolean;
  magicLink: boolean;
}

/**
 * Read Expo client auth flags using static property access so Metro can inline them at build time.
 * 使用静态属性访问读取 Expo 客户端环境变量，确保 Metro 构建期正确内联。
 */
export function readMobileAuthEnv(): MobileAuthEnv {
  return {
    EXPO_PUBLIC_APPLE_AUTH_ENABLED: process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED,
    EXPO_PUBLIC_EMAIL_AUTH_ENABLED: process.env.EXPO_PUBLIC_EMAIL_AUTH_ENABLED,
    EXPO_PUBLIC_EMAIL_OTP_ENABLED: process.env.EXPO_PUBLIC_EMAIL_OTP_ENABLED,
    EXPO_PUBLIC_GOOGLE_AUTH_ENABLED: process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED,
    EXPO_PUBLIC_MAGIC_LINK_ENABLED: process.env.EXPO_PUBLIC_MAGIC_LINK_ENABLED,
    EXPO_PUBLIC_PASSWORD_RESET_ENABLED: process.env.EXPO_PUBLIC_PASSWORD_RESET_ENABLED,
  };
}

/**
 * Resolve enabled email/password, password reset, and social providers for mobile sign-in.
 * 解析移动端启用的邮箱密码、找回密码及第三方 OAuth 登录方式（默认仅开启邮箱密码）。
 */
export function resolveEnabledProviders(env: MobileAuthEnv = readMobileAuthEnv()): EnabledAuthMethods {
  const socialProviders: MobileSocialProvider[] = [];
  if (env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === "true") {
    socialProviders.push("google");
  }
  if (env.EXPO_PUBLIC_APPLE_AUTH_ENABLED === "true") {
    socialProviders.push("apple");
  }

  return {
    emailPassword: env.EXPO_PUBLIC_EMAIL_AUTH_ENABLED !== "false",
    passwordReset: env.EXPO_PUBLIC_PASSWORD_RESET_ENABLED === "true",
    socialProviders,
  };
}

/**
 * Resolve enabled passwordless authentication modes for mobile sign-in.
 * 解析移动端启用的无密码登录方式（Magic Link 与 Email OTP 默认关闭）。
 */
export function resolvePasswordlessModes(
  env: MobileAuthEnv = readMobileAuthEnv(),
): EnabledPasswordlessModes {
  return {
    emailOtp: env.EXPO_PUBLIC_EMAIL_OTP_ENABLED === "true",
    magicLink: env.EXPO_PUBLIC_MAGIC_LINK_ENABLED === "true",
  };
}
