export const EmailTemplate = {
  DELETE_ACCOUNT: "delete-account",
  CHANGE_EMAIL: "change-email",
  CONFIRM_EMAIL: "confirm-email",
  RESET_PASSWORD: "reset-password",
  MAGIC_LINK: "magic-link",
  SIGN_IN_OTP: "sign-in-otp",
  ORGANIZATION_INVITATION: "organization-invitation",
} as const;

export type EmailTemplate = (typeof EmailTemplate)[keyof typeof EmailTemplate];
