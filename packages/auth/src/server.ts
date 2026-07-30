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
import { NodeEnv } from "@openstarter/shared/constants";
import { logger } from "@openstarter/shared/logger";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import {
  admin,
  anonymous,
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
  database: drizzleAdapter(db, {
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
    magicLink({
      expiresIn: MAGIC_LINK_EXPIRES_IN,
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
    emailOTP({
      expiresIn: OTP_EXPIRES_IN,
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
          variables: { otp, url: getUrl({ request: ctx?.request }).toString() },
        });
      },
    }),
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
    nextCookies(),
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  // 条件注册：仅当对应 OAuth 的 client id 与 secret 都齐备时才注册该 provider，
  // 避免给 Better-Auth 传空字符串触发未配置 provider 的告警/报错。
  // 使用对象字面量 + 条件 spread，保留 Better-Auth 对 socialProviders 键集合的静态推断。
  socialProviders: {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          [SocialProvider.GOOGLE]: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? {
          [SocialProvider.GITHUB]: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    ...(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET
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
