// packages/auth/src/auth.config —— Phase 1 认证体验集中配置开关。
//
// 这里把 spec `2026-06-30-phase-1-auth-experience-design.md` §"配置开关"要求的
// 行为常量集中到一处，方便克隆者不改代码、只改这里的常量（或后续接入 Config DB）即
// 可调整认证能力。
//
// 注意：这些是**代码常量**（编译期/启动期生效），与 `getAllConfigs()` 返回的运行时
// Config 不同维度；社交 provider 是否实际注册仍由 env 变量是否齐备决定
// （见 server.ts 中 socialProviders 的条件 spread）。

/**
 * 是否强制邮箱验证门禁。
 *
 * - `true`：未验证邮箱的用户在登录受保护路由时被拦截。
 * - `false`（默认）：邮箱验证仅为能力，不门禁、不提醒。
 *
 * Spec 要求：邮箱验证完全可选，提供能力但不门禁；故默认 `false`。
 */
export const REQUIRE_EMAIL_VERIFICATION = false;

/**
 * Magic Link 链接有效期（秒）。Better-Auth `magicLink.expiresIn` 接受秒数。
 *
 * 默认 30 分钟，与 Better-Auth 默认值一致；克隆者可按安全策略调整。
 */
export const MAGIC_LINK_EXPIRES_IN = 60 * 30;

/**
 * Email OTP 验证码有效期（秒）。Better-Auth `emailOTP.expiresIn` 接受秒数。
 *
 * 默认 5 分钟；OTP 较短以抑制爆破窗口。
 */
export const OTP_EXPIRES_IN = 60 * 5;
