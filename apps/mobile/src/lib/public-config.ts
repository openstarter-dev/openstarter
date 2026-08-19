// apps/mobile/src/lib/public-config.ts —— 由 GET /api/config/public 决定登录页展示什么。
//
// 为什么不能硬编码按钮：packages/auth/src/server.ts 里 Google / GitHub / Apple 是
// **条件注册**的，开关关闭时对应端点根本不存在。硬编码的结果是用户点一下拿到 404
// （见 spec §6）。该端点本就是为登录页设计的（见 packages/api/src/routes/config.ts 注释）。
//
// 开关语义不统一，逐条对齐服务端，不要"顺手统一"：
//   - <provider>_auth_enabled：严格 === "true"，缺失即关闭（服务端 isEnabled 就是严格比较）；
//     与 apps/web 的 getEnabledOAuthProviders 保持一致 —— 两个客户端读同一端点必须给同一结论。
//   - email_auth_enabled：!== "false"，缺失即开启（服务端派生 password_reset_enabled 时就是这么判的）。
//   - password_reset_enabled：服务端已派生（还额外要求邮件渠道配置完成），直接读。
//
// 已知局限：服务端注册 provider 还要求 env 里的 client id/secret 齐备，而本端点
// 不下发 secret 是否存在。开关开着但凭据缺失时，按钮仍会渲染并 404。
// apps/web 有完全相同的局限；要修应该修端点，而不是在单个客户端打补丁。

// v1 支持的社交登录方式（spec §2 决策表：邮箱密码 + Google/Apple）。
// 要加 GitHub：把 "github" 加进这个元组，并在登录页补一个按钮即可。
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
