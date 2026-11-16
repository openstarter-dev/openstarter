import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import { passkey } from "@better-auth/passkey";
import { user as userTable } from "../../db/schema";
import { db } from "../../db/server";
import { EmailTemplate } from "@openstarter/email";
import { sendEmail as deliverEmail, type SendEmailParams } from "@openstarter/email/server";
import { getLocaleFromRequest } from "@openstarter/i18n-web/server";
import { NodeEnv } from "@openstarter/shared/constants";
import { logger } from "@openstarter/shared/logger";
import { apiKey } from "@better-auth/api-key";
import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { admin } from "better-auth/plugins/admin";
import { anonymous } from "better-auth/plugins/anonymous";
import { bearer } from "better-auth/plugins/bearer";
import { deviceAuthorization } from "better-auth/plugins/device-authorization";
import { emailOTP } from "better-auth/plugins/email-otp";
import { magicLink } from "better-auth/plugins/magic-link";
import { oneTap } from "better-auth/plugins/one-tap";
import { organization } from "better-auth/plugins/organization";
import { twoFactor } from "better-auth/plugins/two-factor";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { eq } from "drizzle-orm";
import { MAGIC_LINK_EXPIRES_IN, OTP_EXPIRES_IN } from "./auth.config";
import { authSchema, organizationTeams } from "./auth-database-schema";
import { createAuthEmailCallbacks, createChangeEmailOptions } from "./email-callbacks";
import { env } from "./env";
import { hooks } from "./hooks";
import { redeemInviteCode, validateInviteCode } from "./invite-codes";
import { readBooleanEnv, readEnv, readPositiveIntEnv } from "./lib/runtime-env";
import {
  getAppUrl,
  getUrl,
  isLoopbackAppUrl,
  mobileSchemeOrigin,
  parseOriginList,
} from "./lib/utils";
import {
  ac as orgAc,
  ADMIN_ROLES,
  DEFAULT_ROLE,
  platformAc,
  platformRoles,
  roles as orgRoles,
} from "./rbac";
import { SocialProvider, VerificationType } from "./types";

const sendEmail = async (params: SendEmailParams): Promise<void> => {
  await deliverEmail(params);
};

const emailCallbacks = createAuthEmailCallbacks(sendEmail);

const hasGoogleCredentials = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
const hasGithubCredentials = Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
const hasAppleCredentials = Boolean(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET);

const googleEnabled =
  readBooleanEnv("GOOGLE_AUTH_ENABLED", hasGoogleCredentials) && hasGoogleCredentials;
const githubEnabled =
  readBooleanEnv("GITHUB_AUTH_ENABLED", hasGithubCredentials) && hasGithubCredentials;
const appleEnabled =
  readBooleanEnv("APPLE_AUTH_ENABLED", hasAppleCredentials) && hasAppleCredentials;
const magicLinkEnabled = readBooleanEnv("MAGIC_LINK_ENABLED", false);
const emailOtpEnabled = readBooleanEnv("EMAIL_OTP_ENABLED", false);
const emailAuthEnabled = readBooleanEnv("EMAIL_AUTH_ENABLED", true);
const emailVerificationRequired = readBooleanEnv(
  "EMAIL_VERIFICATION_REQUIRED",
  readBooleanEnv("EMAIL_VERIFICATION_ENABLED", false),
);
const inviteCodeRequired = readBooleanEnv("INVITE_CODE_REQUIRED", false);
export const anonymousAuthEnabled = readBooleanEnv("ANONYMOUS_AUTH_ENABLED", false);

const magicLinkExpiresIn = readPositiveIntEnv("MAGIC_LINK_EXPIRES_IN", MAGIC_LINK_EXPIRES_IN);
const otpExpiresIn = readPositiveIntEnv("EMAIL_OTP_EXPIRES_IN", OTP_EXPIRES_IN);

const appUrl = getAppUrl();
const isHttpsAppUrl = appUrl.startsWith("https://");
const allowLocalOrigins = isLoopbackAppUrl(appUrl);

const mobileOrigin = mobileSchemeOrigin(env.MOBILE_APP_SCHEME);
const extensionOrigin = env.EXTENSION_ORIGIN.trim();
const extraTrustedOrigins = parseOriginList(env.TRUSTED_ORIGINS);

const oneTapClientId = readEnv("VITE_GOOGLE_CLIENT_ID") || env.GOOGLE_CLIENT_ID;
const oneTapEnabled =
  readBooleanEnv("GOOGLE_ONE_TAP_ENABLED", false) && googleEnabled && Boolean(oneTapClientId);

const INVITE_CODE_COOKIE = "openstarter_invite_code";

type UserCreateAfter = NonNullable<NonNullable<typeof hooks.user.create>["after"]>;
type CreatedUser = Parameters<UserCreateAfter>[0];
type HookContext = Parameters<UserCreateAfter>[1];

function readCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    if (key !== name) {
      continue;
    }
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function readInviteCode(context: HookContext): string | undefined {
  const headers = (context as { headers?: Headers } | null)?.headers;
  const headerCode = headers?.get("x-invite-code")?.trim();
  if (headerCode) {
    return headerCode;
  }

  const body = (context as { body?: unknown } | null)?.body;
  if (body && typeof body === "object" && "inviteCode" in body) {
    const value = (body as { inviteCode?: unknown }).inviteCode;
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return readCookie(headers?.get("cookie") ?? null, INVITE_CODE_COOKIE);
}

async function deleteCreatedUser(userId: string): Promise<void> {
  await db().delete(userTable).where(eq(userTable.id, userId));
}

const userCreateBefore = async (_createdUser: CreatedUser, context: HookContext) => {
  if (!inviteCodeRequired) {
    return;
  }

  const code = readInviteCode(context);
  if (!code) {
    throw new APIError("BAD_REQUEST", { message: "Invite code is required" });
  }

  const validation = await validateInviteCode(code);
  if (!validation.valid) {
    throw new APIError("BAD_REQUEST", {
      message: validation.error ?? "Invalid invite code",
    });
  }
};

const userCreateAfter: UserCreateAfter = async (createdUser, context) => {
  if (inviteCodeRequired) {
    // Re-read from the same request (header/body/cookie); no in-memory state, so it is safe
    // across Workers isolates and serverless instances.
    // 从同一请求重新读取邀请码（header/body/cookie），不依赖内存状态，适用于多实例/Workers
    const code = readInviteCode(context);

    if (!code) {
      await deleteCreatedUser(createdUser.id);
      throw new APIError("BAD_REQUEST", { message: "Invite code is required" });
    }

    const redemption = await redeemInviteCode({ code, userId: createdUser.id });
    if (!redemption.ok) {
      await deleteCreatedUser(createdUser.id);
      throw new APIError("BAD_REQUEST", {
        message: redemption.error ?? "Invalid invite code",
      });
    }
  }

  await hooks.user.create?.after?.(createdUser, context);
};

export const auth = betterAuth({
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: [],
    },
  },
  advanced: {
    cookiePrefix: "openstarter",
    cookies: {
      state: {
        attributes: isHttpsAppUrl ? { sameSite: "none", secure: true } : {},
      },
    },
  },
  appName: "OpenStarter",
  baseURL: appUrl,
  database: drizzleAdapter(db(), {
    provider: "sqlite",
    schema: authSchema,
  }),
  databaseHooks: {
    user: {
      ...hooks.user,
      create: {
        ...(hooks.user.create ?? {}),
        after: userCreateAfter,
        before: userCreateBefore,
      },
    },
  },
  emailAndPassword: {
    enabled: emailAuthEnabled,
    requireEmailVerification: emailVerificationRequired,
    sendResetPassword: emailCallbacks.sendResetPassword,
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    sendOnSignUp: emailVerificationRequired,
    sendVerificationEmail: emailCallbacks.sendVerificationEmail,
  },
  logger: {
    log: (level, ...args) => logger[level](...args),
  },
  plugins: [
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
    ...(anonymousAuthEnabled ? [anonymous()] : []),
    apiKey({
      defaultPrefix: "sk_",
      startingCharactersConfig: { charactersLength: 11 },
      requireName: true,
    }),
    admin({
      ac: platformAc,
      adminRoles: [...ADMIN_ROLES],
      defaultRole: DEFAULT_ROLE,
      roles: platformRoles,
    }),
    organization({
      ac: orgAc,
      organizationHooks: hooks.organization,
      roles: orgRoles,
      sendInvitationEmail: (
        { invitation, inviter, organization: invitedOrganization },
        request,
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
    ...(oneTapEnabled && oneTapClientId ? [oneTap({ clientId: oneTapClientId })] : []),
    expo(),
    deviceAuthorization({
      deviceCodeLength: 32,
      expiresIn: "10m",
      interval: "5s",
      userCodeLength: 8,
    }),
    bearer({ requireSignature: true }),
    tanstackStartCookies(),
  ],
  rateLimit: {
    enabled: env.NODE_ENV !== NodeEnv.TEST,
    max: 100,
    // Persist counters in the DB (rate_limit table) so limits hold across isolates/instances
    // 计数持久化到数据库（rate_limit 表），多实例/Workers 下限流仍然有效
    storage: "database",
    window: 60,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60,
    },
  },
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
    mobileOrigin,
    "https://appleid.apple.com",
    ...(extensionOrigin ? [extensionOrigin] : []),
    ...extraTrustedOrigins,
    ...(allowLocalOrigins ? ["http://localhost*", "https://localhost*"] : []),
  ],
  user: {
    changeEmail: createChangeEmailOptions(emailCallbacks.sendChangeEmailConfirmation),
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: emailCallbacks.sendDeleteAccountVerification,
      ...hooks.deleteUser,
    },
  },
});

export const createAuth = () => auth;

export type AuthErrorCode = keyof typeof auth.$ERROR_CODES;
export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
export type Invitation = typeof auth.$Infer.Invitation;
export type Organization = typeof auth.$Infer.Organization;
export type ActiveOrganization = typeof auth.$Infer.ActiveOrganization;
export type Member = typeof auth.$Infer.Member;
export type Permissions = NonNullable<
  NonNullable<Parameters<typeof auth.api.hasPermission>[0]>["body"]["permissions"]
>;
