import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import {
  anonymous,
  emailOTP,
  magicLink,
  twoFactor,
  organization,
  admin,
  oneTap,
  lastLoginMethod,
} from "better-auth/plugins";

import * as schema from "@openstarter/db/schema";
import { db, getAuthAdapterProvider } from "@openstarter/db/server";
import { EmailTemplate } from "@openstarter/email";
import {
  type SendEmailParams,
  sendEmail as deliverEmail,
} from "@openstarter/email/server";
import { getLocaleFromRequest } from "@openstarter/i18n/server";
import { NodeEnv } from "@openstarter/shared/constants";
import { logger } from "@openstarter/shared/logger";

import { env } from "./env";
import { hooks } from "./hooks";
import { getUrl } from "./lib/utils";
import { ac, roles } from "./rbac";
import { AuthProvider, SocialProvider, VerificationType } from "./types";
import {
  MAGIC_LINK_EXPIRES_IN,
  OTP_EXPIRES_IN,
  REQUIRE_EMAIL_VERIFICATION,
} from "./auth.config";

// better-auth 的邮件回调契约要求返回 Promise<void>，而 @openstarter/email 的 sendEmail 返回
// 结构化 EmailSendResult（R22.3，供程序化调用方判断成败）。此轻量适配器丢弃返回值
// （better-auth 不消费该结果，且投递失败已在 sendEmail 内部经 logger 记录），
// 使既有 7 处邮件回调无需改写即满足返回类型契约——保留发信能力，叠加而非裁剪。
const sendEmail = async (params: SendEmailParams): Promise<void> => {
  await deliverEmail(params);
};

export const auth = betterAuth({
  appName: "TurboStarter",
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url }, request) =>
        sendEmail({
          to: user.email,
          template: EmailTemplate.DELETE_ACCOUNT,
          locale: getLocaleFromRequest(request),
          variables: {
            url: getUrl({
              request,
              url,
              type: VerificationType.DELETE_ACCOUNT,
            }).toString(),
          },
        }),
      ...hooks.deleteUser,
    },
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }, request) =>
        sendEmail({
          to: user.email,
          template: EmailTemplate.CHANGE_EMAIL,
          locale: getLocaleFromRequest(request),
          variables: {
            url: getUrl({
              request,
              url,
              type: VerificationType.CONFIRM_EMAIL,
            }).toString(),
            newEmail,
          },
        }),
    },
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
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: REQUIRE_EMAIL_VERIFICATION,
    sendResetPassword: async ({ user, url }, request) =>
      sendEmail({
        to: user.email,
        template: EmailTemplate.RESET_PASSWORD,
        locale: getLocaleFromRequest(request),
        variables: {
          url,
        },
      }),
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }, request) =>
      sendEmail({
        to: user.email,
        template: EmailTemplate.CONFIRM_EMAIL,
        locale: getLocaleFromRequest(request),
        variables: {
          url: getUrl({
            request,
            url,
            type: VerificationType.CONFIRM_EMAIL,
          }).toString(),
        },
      }),
  },
  database: drizzleAdapter(db, {
    provider: getAuthAdapterProvider(),
    schema,
  }),
  databaseHooks: {
    user: hooks.user,
  },
  plugins: [
    magicLink({
      expiresIn: MAGIC_LINK_EXPIRES_IN,
      sendMagicLink: async ({ email, url }, ctx) =>
        sendEmail({
          to: email,
          template: EmailTemplate.MAGIC_LINK,
          locale: getLocaleFromRequest(ctx?.request),
          variables: {
            url: getUrl({
              request: ctx?.request,
              url,
              type: VerificationType.MAGIC_LINK,
            }).toString(),
          },
        }),
    }),
    emailOTP({
      expiresIn: OTP_EXPIRES_IN,
      async sendVerificationOTP({ email, otp, type }, ctx) {
        if (type !== "sign-in") {
          /* Handle other types if you want to use OTP verification
          for other purposes (e.g. change email, delete account, etc.) */
          return;
        }

        return sendEmail({
          to: email,
          template: EmailTemplate.SIGN_IN_OTP,
          locale: getLocaleFromRequest(ctx?.request),
          variables: { otp, url: getUrl({ request: ctx?.request }).toString() },
        });
      },
    }),
    passkey(),
    twoFactor(),
    anonymous(),
    admin(),
    organization({
      sendInvitationEmail: async (
        { invitation, inviter, organization },
        request,
      ) => {
        const url = getUrl({
          request,
        });
        url.searchParams.set("invitationId", invitation.id);
        url.searchParams.set("email", invitation.email);

        return sendEmail({
          to: invitation.email,
          template: EmailTemplate.ORGANIZATION_INVITATION,
          locale: getLocaleFromRequest(request),
          variables: {
            url: url.toString(),
            inviter: inviter.user.name,
            organization: organization.name,
          },
        });
      },
      ac,
      roles,
      organizationHooks: hooks.organization,
    }),
    lastLoginMethod({
      customResolveMethod: (ctx) => {
        switch (ctx.path) {
          case "/magic-link/verify":
            return AuthProvider.MAGIC_LINK;
          case "/passkey/verify-authentication":
            return AuthProvider.PASSKEY;
          case "/sign-in/email-otp":
            return AuthProvider.EMAIL_OTP;
          default:
            return null;
        }
      },
    }),
    oneTap(),
    expo(),
    nextCookies(),
  ],
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
            clientId: env.APPLE_CLIENT_ID,
            clientSecret: env.APPLE_CLIENT_SECRET,
            appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER,
          },
        }
      : {}),
  },
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
  logger: {
    log: (level, ...args) => logger[level](...args),
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

export * from "./hooks";
export * from "./lib/server";