import { EmailTemplate } from "@openstarter/email";
import type { SendEmailParams } from "@openstarter/email/server";
import { getLocaleFromRequest } from "@openstarter/i18n/server";
import type { BetterAuthOptions } from "better-auth";

import { getUrl } from "./lib/utils";
import { VerificationType } from "./types";

type DeleteUserOptions = NonNullable<
  NonNullable<BetterAuthOptions["user"]>["deleteUser"]
>;
type ChangeEmailOptions = NonNullable<
  NonNullable<BetterAuthOptions["user"]>["changeEmail"]
>;
type EmailAndPasswordOptions = NonNullable<
  BetterAuthOptions["emailAndPassword"]
>;
type EmailVerificationOptions = NonNullable<
  BetterAuthOptions["emailVerification"]
>;

interface AuthEmailCallbacks {
  sendChangeEmailConfirmation: NonNullable<
    ChangeEmailOptions["sendChangeEmailConfirmation"]
  >;
  sendDeleteAccountVerification: NonNullable<
    DeleteUserOptions["sendDeleteAccountVerification"]
  >;
  sendResetPassword: NonNullable<EmailAndPasswordOptions["sendResetPassword"]>;
  sendVerificationEmail: NonNullable<
    EmailVerificationOptions["sendVerificationEmail"]
  >;
}

const CHANGE_EMAIL_VERIFICATION_REQUEST = "change-email-verification";

interface VerificationTokenPayload {
  requestType?: string;
  updateTo?: string;
}

const decodeVerificationTokenPayload = (
  token: string
): VerificationTokenPayload | null => {
  const encodedPayload = token.split(".").at(1);
  if (!encodedPayload) {
    return null;
  }

  try {
    const base64 = encodedPayload.replaceAll("-", "+").replaceAll("_", "/");
    const paddedBase64 = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    const bytes = Uint8Array.from(atob(paddedBase64), (character) =>
      character.charCodeAt(0)
    );
    const payload = JSON.parse(
      new TextDecoder().decode(bytes)
    ) as VerificationTokenPayload;
    return payload;
  } catch {
    return null;
  }
};

const isUnverifiedEmailChange = (
  token: string,
  emailVerified: boolean
): VerificationTokenPayload | null => {
  if (emailVerified) {
    return null;
  }

  const payload = decodeVerificationTokenPayload(token);
  return payload?.requestType === CHANGE_EMAIL_VERIFICATION_REQUEST &&
    payload.updateTo
    ? payload
    : null;
};

export const createChangeEmailOptions = (
  sendChangeEmailConfirmation: AuthEmailCallbacks["sendChangeEmailConfirmation"]
): ChangeEmailOptions => ({
  enabled: true,
  sendChangeEmailConfirmation,
  updateEmailWithoutVerification: false,
});

export type AuthEmailSender = (params: SendEmailParams) => Promise<void>;

export const createAuthEmailCallbacks = (
  sendEmail: AuthEmailSender
): AuthEmailCallbacks => ({
  sendChangeEmailConfirmation: async ({ user, newEmail, url }, request) =>
    sendEmail({
      locale: getLocaleFromRequest(request),
      template: EmailTemplate.CHANGE_EMAIL,
      to: user.email,
      variables: {
        newEmail,
        url: getUrl({
          request,
          type: VerificationType.CONFIRM_EMAIL,
          url,
        }).toString(),
      },
    }),
  sendDeleteAccountVerification: async ({ user, url }, request) =>
    sendEmail({
      locale: getLocaleFromRequest(request),
      template: EmailTemplate.DELETE_ACCOUNT,
      to: user.email,
      variables: {
        url: getUrl({
          request,
          type: VerificationType.DELETE_ACCOUNT,
          url,
        }).toString(),
      },
    }),
  sendResetPassword: async ({ user, url }, request) =>
    sendEmail({
      locale: getLocaleFromRequest(request),
      template: EmailTemplate.RESET_PASSWORD,
      to: user.email,
      variables: { url },
    }),
  sendVerificationEmail: ({ user, url, token }, request) => {
    const emailChange = isUnverifiedEmailChange(token, user.emailVerified);
    return sendEmail({
      locale: getLocaleFromRequest(request),
      template: emailChange
        ? EmailTemplate.CHANGE_EMAIL
        : EmailTemplate.CONFIRM_EMAIL,
      to: user.email,
      variables: {
        ...(emailChange?.updateTo ? { newEmail: emailChange.updateTo } : {}),
        url: getUrl({
          request,
          type: VerificationType.CONFIRM_EMAIL,
          url,
        }).toString(),
      },
    });
  },
});
