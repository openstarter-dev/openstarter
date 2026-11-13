import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import { passkey } from "@better-auth/passkey";
import { db, getAuthAdapterProvider } from "@openstarter/db/server";
import { EmailTemplate } from "@openstarter/email";
import { sendEmail as deliverEmail, type SendEmailParams } from "@openstarter/email/server";
import { getLocaleFromRequest } from "@openstarter/i18n-web/server";
import { getAllConfigs } from "@openstarter/shared/config";
import { NodeEnv } from "@openstarter/shared/constants";
import { logger } from "@openstarter/shared/logger";
import { apiKey } from "@better-auth/api-key";
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
import { MAGIC_LINK_EXPIRES_IN, OTP_EXPIRES_IN, REQUIRE_EMAIL_VERIFICATION } from "./auth.config";
import { authSchema, organizationTeams } from "./auth-database-schema";
import { createAuthEmailCallbacks, createChangeEmailOptions } from "./email-callbacks";
import { env } from "./env";
import { hooks } from "./hooks";
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

const runtimeConfigs = await getAllConfigs();
const isEnabled = (key: string): boolean => runtimeConfigs[key] === "true";
const googleEnabled =
  isEnabled("google_auth_enabled") && Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
const githubEnabled =
  isEnabled("github_auth_enabled") && Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
const appleEnabled =
  isEnabled("apple_auth_enabled") && Boolean(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET);
const magicLinkEnabled = isEnabled("magic_link_enabled");
const emailOtpEnabled = isEnabled("email_otp_enabled");

const magicLinkExpiresIn = runtimeConfigs.magic_link_expires_in
  ? Number(runtimeConfigs.magic_link_expires_in)
  : MAGIC_LINK_EXPIRES_IN;
const otpExpiresIn = runtimeConfigs.email_otp_expires_in
  ? Number(runtimeConfigs.email_otp_expires_in)
  : OTP_EXPIRES_IN;

const appUrl = getAppUrl();
const isHttpsAppUrl = appUrl.startsWith("https://");
const allowLocalOrigins = isLoopbackAppUrl(appUrl);

const mobileOrigin = mobileSchemeOrigin(env.MOBILE_APP_SCHEME);
const extensionOrigin = env.EXTENSION_ORIGIN.trim();
const extraTrustedOrigins = parseOriginList(env.TRUSTED_ORIGINS);

const oneTapClientId = runtimeConfigs.google_client_id || env.GOOGLE_CLIENT_ID;
const oneTapEnabled =
  isEnabled("google_one_tap_enabled") && googleEnabled && Boolean(oneTapClientId);

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
    sendOnSignUp: runtimeConfigs.email_verification_enabled !== "false",
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
    anonymous(),
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
