import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import { passkey } from "@better-auth/passkey";
import { db, getAuthAdapterProvider } from "@openstarter/db/server";
import { EmailTemplate } from "@openstarter/email";
import {
  sendEmail as deliverEmail,
  type SendEmailParams,
} from "@openstarter/email/server";
import { getLocaleFromRequest } from "@openstarter/i18n/server";
import { getAllConfigs } from "@openstarter/shared/config";
import { NodeEnv } from "@openstarter/shared/constants";
import { logger } from "@openstarter/shared/logger";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import {
  admin,
  anonymous,
  bearer,
  emailOTP,
  lastLoginMethod,
  magicLink,
  oneTap,
  organization,
  twoFactor,
} from "better-auth/plugins";
import {
  MAGIC_LINK_EXPIRES_IN,
  OTP_EXPIRES_IN,
  REQUIRE_EMAIL_VERIFICATION,
} from "./auth.config";
import { authSchema, organizationTeams } from "./auth-database-schema";
import {
  createAuthEmailCallbacks,
  createChangeEmailOptions,
} from "./email-callbacks";
import { env } from "./env";
import { hooks } from "./hooks";
import { getUrl } from "./lib/utils";
import { ac, roles } from "./rbac";
import { AuthProvider, SocialProvider, VerificationType } from "./types";

// better-auth 的邮件回调契约要求返回 Promise<void>，而 @openstarter/email 的 sendEmail 返回
// 结构化 EmailSendResult（R22.3，供程序化调用方判断成败）。此轻量适配器丢弃返回值
// （better-auth 不消费该结果，且投递失败已在 sendEmail 内部经 logger 记录），
// 使既有 7 处邮件回调无需改写即满足返回类型契约——保留发信能力，叠加而非裁剪。
const sendEmail = async (params: SendEmailParams): Promise<void> => {
  await deliverEmail(params);
};

const emailCallbacks = createAuthEmailCallbacks(sendEmail);
const LOGIN_METHOD_BY_PATH = new Map<string, AuthProvider>([
  ["/magic-link/verify", AuthProvider.MAGIC_LINK],
  ["/passkey/verify-authentication", AuthProvider.PASSKEY],
  ["/sign-in/email-otp", AuthProvider.EMAIL_OTP],
]);

// ─── 运行时配置读取（Runtime config-driven enablement）──────────────────────────
//
// 此前 OAuth provider 与无密码插件是否注册仅由 `env` 决定（client_id/secret 是否齐备），
// admin 后台的 `*_auth_enabled` / `magic_link_enabled` / `email_otp_enabled` 开关只用于前端
// 是否渲染按钮。这导致「开关关闭但 env 已配置」时后端登录通路仍可达，是行为回退。
//
// 下面在模块加载期读取 `getAllConfigs()`（环境变量 + DB 合并，带 1h 缓存），与 `env` **共同**
// 决定是否注册对应 provider / 插件：开关未开启或凭据缺失任一者不满足即跳过注册，
// 使「开关关闭」在后端真正生效（better-auth 对未注册 provider/plugin 的端点返回 404）。
//
// 注意：这是**启动期一次读取 + 单例构造**——与现有 env 驱动语义一致（关闭需重启进程方能解注册）。
// 管理员后台保存配置会失效 `getAllConfigs` 的缓存（见 `shared/config.ts`），
// 但已构造的 better-auth 单例不会重建；运行期切换仍由前端按公开配置决定是否展示按钮兜底。
// 将来如需运行期实时生效，需把 `auth` 改为按请求重建或加守卫中间件拦截已关闭端点。
const runtimeConfigs = await getAllConfigs();
const isEnabled = (key: string): boolean => runtimeConfigs[key] === "true";
const googleEnabled =
  isEnabled("google_auth_enabled") &&
  Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
const githubEnabled =
  isEnabled("github_auth_enabled") &&
  Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
const appleEnabled =
  isEnabled("apple_auth_enabled") &&
  Boolean(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET);
const magicLinkEnabled = isEnabled("magic_link_enabled");
const emailOtpEnabled = isEnabled("email_otp_enabled");

const magicLinkExpiresIn = runtimeConfigs.magic_link_expires_in
  ? Number(runtimeConfigs.magic_link_expires_in)
  : MAGIC_LINK_EXPIRES_IN;
const otpExpiresIn = runtimeConfigs.email_otp_expires_in
  ? Number(runtimeConfigs.email_otp_expires_in)
  : OTP_EXPIRES_IN;

export const auth = betterAuth({
  advanced: {
    cookiePrefix: "turbostarter",
    cookies: {
      state: {
        attributes: {
          sameSite: "none",
          secure: true,
        },
      },
    },
  },
  appName: "TurboStarter",
  database: drizzleAdapter(db(), {
    provider: getAuthAdapterProvider(),
    schema: authSchema,
  }),
  databaseHooks: {
    user: hooks.user,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: REQUIRE_EMAIL_VERIFICATION,
    sendResetPassword: emailCallbacks.sendResetPassword,
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    sendOnSignUp: true,
    sendVerificationEmail: emailCallbacks.sendVerificationEmail,
  },
  logger: {
    log: (level, ...args) => logger[level](...args),
  },
  plugins: [
    // Magic Link 与 Email OTP 插件按 `*_enabled` 开关条件注册——开关关闭时插件不挂载，
    // 对应端点（/sign-in/magic-link、/sign-in/email-otp）随之不存在，避免「开关关闭后端仍可登录」。
    ...(magicLinkEnabled
      ? [
          magicLink({
            expiresIn: magicLinkExpiresIn,
            sendMagicLink: async ({ email, url }, ctx) =>
              sendEmail({
                locale: getLocaleFromRequest(ctx?.request),
                template: EmailTemplate.MAGIC_LINK,
                to: email,
                variables: {
                  url: getUrl({
                    request: ctx?.request,
                    type: VerificationType.MAGIC_LINK,
                    url,
                  }).toString(),
                },
              }),
          }),
        ]
      : []),
    ...(emailOtpEnabled
      ? [
          emailOTP({
            expiresIn: otpExpiresIn,
            sendVerificationOTP({ email, otp, type }, ctx) {
              if (type !== "sign-in") {
                /* Handle other types if you want to use OTP verification
                for other purposes (e.g. change email, delete account, etc.) */
                return Promise.resolve();
              }

              return sendEmail({
                locale: getLocaleFromRequest(ctx?.request),
                template: EmailTemplate.SIGN_IN_OTP,
                to: email,
                variables: {
                  otp,
                  url: getUrl({ request: ctx?.request }).toString(),
                },
              });
            },
          }),
        ]
      : []),
    passkey(),
    twoFactor(),
    anonymous(),
    admin(),
    organization({
      ac,
      organizationHooks: hooks.organization,
      roles,
      sendInvitationEmail: (
        { invitation, inviter, organization: invitedOrganization },
        request
      ) => {
        const url = getUrl({
          request,
        });
        url.searchParams.set("invitationId", invitation.id);
        url.searchParams.set("email", invitation.email);

        return sendEmail({
          locale: getLocaleFromRequest(request),
          template: EmailTemplate.ORGANIZATION_INVITATION,
          to: invitation.email,
          variables: {
            inviter: inviter.user.name,
            organization: invitedOrganization.name,
            url: url.toString(),
          },
        });
      },
      teams: organizationTeams,
    }),
    lastLoginMethod({
      customResolveMethod: (ctx) => LOGIN_METHOD_BY_PATH.get(ctx.path) ?? null,
    }),
    oneTap(),
    expo(),
    // Bearer 转发（浏览器插件端会话桥接，见 docs/superpowers/specs/2026-08-01-browser-extension-app-design.md
    // §3.2/§4）：插件把 web 端的会话 cookie 值原样作为 Authorization: Bearer 头转发；
    // requireSignature: true 拒绝未签名的裸 token，正常路径（真实会话 cookie 值本就带签名）不受影响。
    // 必须在 nextCookies() 之前注册 —— nextCookies() 必须是数组最后一项。
    bearer({ requireSignature: true }),
    nextCookies(),
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  // 条件注册：仅当对应 OAuth 的 admin 开关开启且 env client id/secret 都齐备时才注册该 provider。
  // 开关关闭即解注册（端点 404），凭据缺失亦跳过，避免给 Better-Auth 传空字符串触发未配置告警。
  // 使用对象字面量 + 条件 spread，保留 Better-Auth 对 socialProviders 键集合的静态推断。
  socialProviders: {
    ...(googleEnabled
      ? {
          [SocialProvider.GOOGLE]: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(githubEnabled
      ? {
          [SocialProvider.GITHUB]: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    ...(appleEnabled
      ? {
          [SocialProvider.APPLE]: {
            appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER,
            clientId: env.APPLE_CLIENT_ID,
            clientSecret: env.APPLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  trustedOrigins: [
    "chrome-extension://",
    "turbostarter://",
    /* Needed only for Apple ID authentication */
    "https://appleid.apple.com",
    ...(env.NODE_ENV === NodeEnv.DEVELOPMENT
      ? ["http://localhost*", "https://localhost*"]
      : []),
  ],
  user: {
    changeEmail: createChangeEmailOptions(
      emailCallbacks.sendChangeEmailConfirmation
    ),
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification:
        emailCallbacks.sendDeleteAccountVerification,
      ...hooks.deleteUser,
    },
  },
});

/**
 * Factory accessor for the configured better-auth instance.
 *
 * Returns the module singleton so `packages/api`'s session middleware and
 * better-auth handler mount cheaply (no per-request re-initialization). This
 * preserves the documented `createAuth` contract consumed by `@openstarter/api`.
 */
export const createAuth = () => auth;

export type AuthErrorCode = keyof typeof auth.$ERROR_CODES;
export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
export type Invitation = typeof auth.$Infer.Invitation;
export type Organization = typeof auth.$Infer.Organization;
export type ActiveOrganization = typeof auth.$Infer.ActiveOrganization;
export type Member = typeof auth.$Infer.Member;
export type Permissions = NonNullable<
  NonNullable<
    Parameters<typeof auth.api.hasPermission>[0]
  >["body"]["permissions"]
>;
