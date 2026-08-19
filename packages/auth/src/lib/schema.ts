// packages/auth/src/lib/schema —— 认证相关 zod schema（@openstarter/auth 的 `./lib/schema`）。
//
// 经 `index.ts` 的 `export * from "./lib/schema"` 暴露于 @openstarter/auth 根入口，
// 供前端表单与服务端入参校验复用。各 schema 与现有 `server.ts` 装配的认证能力对应：
// 邮箱密码（requireEmailVerification）、密码重置、email OTP、magic link。
//
// 采用 zod 4 顶层格式 API（如 `z.email()`），与 `env.ts` / `types.ts` 的用法保持一致。

import { z } from "zod";

// 口令长度约束（对齐 better-auth 默认：最短 8、最长 128）。
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
// 登录 OTP 位数。
const OTP_LENGTH = 6;

/** 邮箱地址。 */
export const emailSchema = z.email();

/** 账户口令。 */
export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

/** 邮箱 + 口令登录凭据。 */
export const credentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

/** 邮箱注册入参。 */
export const signUpSchema = z.object({
  name: z.string().min(1),
  email: emailSchema,
  password: passwordSchema,
});

/** 发起密码重置（仅需邮箱；响应对存在与否保持一致，账户枚举防护见任务 8）。 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/** 提交密码重置（携带令牌与新口令）。 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

/** 登录 OTP 校验入参。 */
export const otpSchema = z.object({
  email: emailSchema,
  otp: z.string().length(OTP_LENGTH),
});

/** magic link 发起入参。 */
export const magicLinkSchema = z.object({
  email: emailSchema,
});

export type Credentials = z.infer<typeof credentialsSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type OtpInput = z.infer<typeof otpSchema>;
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
