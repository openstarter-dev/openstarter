import * as z from "zod";

import type { AuthErrorCode } from "./server";
import type { TranslationKey } from "@openstarter/i18n";

const SocialProvider = {
  APPLE: "apple",
  GOOGLE: "google",
  GITHUB: "github",
} as const;

type SocialProvider = (typeof SocialProvider)[keyof typeof SocialProvider];

const AuthProvider = {
  ...SocialProvider,
  PASSWORD: "password",
  MAGIC_LINK: "magicLink",
  EMAIL_OTP: "emailOtp",
  ANONYMOUS: "anonymous",
  PASSKEY: "passkey",
} as const;

type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

const SecondFactor = {
  TOTP: "totp",
  BACKUP_CODE: "backupCode",
} as const;

type SecondFactor = (typeof SecondFactor)[keyof typeof SecondFactor];

const authConfigSchema = z.object({
  providers: z.object({
    [AuthProvider.PASSWORD]: z.boolean(),
    [AuthProvider.MAGIC_LINK]: z.boolean(),
    [AuthProvider.EMAIL_OTP]: z.boolean(),
    [AuthProvider.ANONYMOUS]: z.boolean(),
    [AuthProvider.PASSKEY]: z.boolean().optional(),
    oAuth: z.array(z.enum(SocialProvider)),
  }),
});

const UserRole = {
  USER: "user",
  ADMIN: "admin",
} as const;

type UserRole = (typeof UserRole)[keyof typeof UserRole];

const MemberRole = {
  MEMBER: "member",
  ADMIN: "admin",
  OWNER: "owner",
} as const;

type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];

const InvitationStatus = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  CANCELED: "canceled",
  REJECTED: "rejected",
} as const;

type InvitationStatus =
  (typeof InvitationStatus)[keyof typeof InvitationStatus];

const VerificationType = {
  MAGIC_LINK: "magic-link",
  DELETE_ACCOUNT: "delete-account",
  CONFIRM_EMAIL: "confirm-email",
} as const;

type VerificationType =
  (typeof VerificationType)[keyof typeof VerificationType];

type AuthConfig = z.infer<typeof authConfigSchema>;

const ERROR_MESSAGES = {
  YOU_CANNOT_BAN_YOURSELF: "auth:error.user.cannotBanYourself",
  YOU_CANNOT_IMPERSONATE_ADMINS: "auth:error.user.cannotImpersonateAdmins",
  INVALID_EMAIL_FORMAT: "auth:error.credentials.email.invalidFormat",
  ORGANIZATION_SLUG_ALREADY_TAKEN: "organization:error.slugAlreadyTaken",
  FAILED_TO_DELETE_ANONYMOUS_USER:
    "auth:error.user.failedToDeleteAnonymousUser",
  USER_IS_NOT_ANONYMOUS: "auth:error.user.notAnonymous",
  DELETE_ANONYMOUS_USER_DISABLED: "auth:error.user.deleteAnonymousUserDisabled",
  YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE:
    "auth:error.cannotSetNonExistentValue",
  INVALID_ROLE_TYPE: "auth:error.invalidRoleType",
  MISSING_OR_NULL_ORIGIN: "auth:error.missingOrNullOrigin",
  FAILED_TO_CREATE_VERIFICATION: "auth:error.failedToCreateVerification",
  FIELD_NOT_ALLOWED: "auth:error.fieldNotAllowed",
  ASYNC_VALIDATION_NOT_SUPPORTED: "auth:error.asyncValidationNotSupported",
  VALIDATION_ERROR: "auth:error.validationError",
  MISSING_FIELD: "auth:error.missingField",
  CROSS_SITE_NAVIGATION_LOGIN_BLOCKED:
    "auth:error.crossSiteNavigationLoginBlocked",
  VERIFICATION_EMAIL_NOT_ENABLED: "auth:error.user.verificationEmailNotEnabled",
  EMAIL_ALREADY_VERIFIED: "auth:error.user.emailAlreadyVerified",
  EMAIL_MISMATCH: "auth:error.user.emailMismatch",
  SESSION_NOT_FRESH: "auth:error.session.notFresh",
  LINKED_ACCOUNT_ALREADY_EXISTS:
    "auth:error.account.linkedAccountAlreadyExists",
  INVALID_ORIGIN: "auth:error.invalidOrigin",
  YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE: "auth:error.user.cannotChangeRole",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS: "admin:error.cannotCreateUsers",
  YOU_ARE_NOT_ALLOWED_TO_LIST_USERS: "admin:error.cannotListUsers",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS: "admin:error.cannotUpdateUsers",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS: "admin:error.cannotDeleteUsers",
  YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS:
    "admin:error.cannotListUsersSessions",
  YOU_ARE_NOT_ALLOWED_TO_BAN_USERS: "admin:error.cannotBanUsers",
  YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS:
    "admin:error.cannotImpersonateUsers",
  YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS:
    "admin:error.cannotRevokeUsersSessions",
  YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD:
    "admin:error.cannotSetUsersPassword",
  BANNED_USER: "auth:error.user.banned",
  NO_DATA_TO_UPDATE: "auth:error.noDataToUpdate",
  YOU_CANNOT_REMOVE_YOURSELF: "auth:error.user.cannotRemoveYourself",
  YOU_ARE_NOT_ALLOWED_TO_GET_USER: "auth:error.user.cannotGetUser",
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER:
    "organization:error.cannotLeaveWithoutOwner",
  MISSING_AC_INSTANCE: "organization:error.ac.missingAcInstance",
  YOU_MUST_BE_IN_AN_ORGANIZATION_TO_CREATE_A_ROLE:
    "organization:error.ac.mustBeInOrganizationToCreateRole",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_A_ROLE:
    "organization:error.ac.cannotCreateRole",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_A_ROLE:
    "organization:error.ac.cannotUpdateRole",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_A_ROLE:
    "organization:error.ac.cannotDeleteRole",
  YOU_ARE_NOT_ALLOWED_TO_READ_A_ROLE: "organization:error.ac.cannotReadRole",
  YOU_ARE_NOT_ALLOWED_TO_LIST_A_ROLE: "organization:error.ac.cannotListRole",
  YOU_ARE_NOT_ALLOWED_TO_GET_A_ROLE: "organization:error.ac.cannotGetRole",
  TOO_MANY_ROLES: "organization:error.ac.tooManyRoles",
  INVALID_RESOURCE: "organization:error.ac.invalidResource",
  CANNOT_DELETE_A_PRE_DEFINED_ROLE:
    "organization:error.ac.cannotDeletePreDefinedRole",
  ROLE_NAME_IS_ALREADY_TAKEN: "organization:error.ac.roleNameAlreadyTaken",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION:
    "organization:error.cannotCreateNew",
  YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS:
    "organization:error.maximumNumberOfOrganizations",
  ORGANIZATION_ALREADY_EXISTS: "organization:error.alreadyExists",
  ORGANIZATION_NOT_FOUND: "organization:error.notFound",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "auth:error.user.alreadyExistsUseAnotherEmail",
  USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION: "organization:error.userNotMember",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION:
    "organization:error.cannotUpdate",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION:
    "organization:error.cannotDelete",
  NO_ACTIVE_ORGANIZATION: "organization:error.noActive",
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION:
    "organization:error.userAlreadyMember",
  MEMBER_NOT_FOUND: "organization:error.memberNotFound",
  YOU_DO_NOT_HAVE_AN_ACTIVE_TEAM: "organization:error.team.noActive",
  YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION: "organization:error.userNotMember",
  ROLE_NOT_FOUND: "organization:error.role.notFound",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM_MEMBER:
    "organization:error.team.cannotCreateNewMember",
  YOU_ARE_NOT_ALLOWED_TO_REMOVE_A_TEAM_MEMBER:
    "organization:error.team.cannotRemoveMember",
  YOU_ARE_NOT_ALLOWED_TO_ACCESS_THIS_ORGANIZATION:
    "organization:error.cannotAccess",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM:
    "organization:error.team.cannotCreateNew",
  TEAM_ALREADY_EXISTS: "organization:error.team.alreadyExists",
  TEAM_NOT_FOUND: "organization:error.team.notFound",
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER:
    "organization:error.cannotLeaveAsOnlyOwner",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER:
    "organization:error.cannotDeleteMember",
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION:
    "organization:error.invitation.cannotInviteUsers",
  YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION:
    "organization:error.invitation.cannotCancel",
  INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION:
    "organization:error.invitation.inviterNoLongerMember",
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE:
    "organization:error.invitation.cannotInviteUserWithRole",
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION:
    "organization:error.invitation.userAlreadyInvited",
  INVITATION_NOT_FOUND: "organization:error.invitation.notFound",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_TEAMS_IN_THIS_ORGANIZATION:
    "organization:error.team.cannotCreateNew",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_TEAMS_IN_THIS_ORGANIZATION:
    "organization:error.team.cannotDelete",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_TEAM:
    "organization:error.team.cannotUpdate",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_TEAM:
    "organization:error.team.cannotDelete",
  INVITATION_LIMIT_REACHED: "organization:error.invitation.limitReached",
  TEAM_MEMBER_LIMIT_REACHED: "organization:error.team.memberLimitReached",
  USER_IS_NOT_A_MEMBER_OF_THE_TEAM: "organization:error.team.userNotMember",
  YOU_CAN_NOT_ACCESS_THE_MEMBERS_OF_THIS_TEAM:
    "organization:error.team.cannotAccessMembers",
  YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_TEAMS:
    "organization:error.team.maximumNumberOfTeams",
  UNABLE_TO_REMOVE_LAST_TEAM: "organization:error.team.unableToRemoveLastTeam",
  EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION:
    "organization:error.invitation.emailVerificationRequired",
  FAILED_TO_RETRIEVE_INVITATION:
    "organization:error.invitation.failedToRetrieve",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER:
    "organization:error.cannotUpdateMember",
  ORGANIZATION_MEMBERSHIP_LIMIT_REACHED:
    "organization:error.membershipLimitReached",
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION:
    "organization:error.invitation.notRecipient",
  USER_NOT_FOUND: "auth:error.user.notFound",
  USER_ALREADY_HAS_PASSWORD: "auth:error.user.alreadyHasPassword",
  AUTHENTICATION_FAILED: "auth:error.authenticationFailed",
  FAILED_TO_CREATE_USER: "auth:error.account.creation",
  FAILED_TO_CREATE_SESSION: "auth:error.session.creation",
  UNABLE_TO_CREATE_SESSION: "auth:error.session.creation",
  COULD_NOT_CREATE_SESSION: "auth:error.session.creation",
  FAILED_TO_UPDATE_USER: "auth:error.account.update",
  FAILED_TO_GET_SESSION: "auth:error.session.retrieval",
  INVALID_PASSWORD: "auth:error.credentials.password.invalid",
  INVALID_EMAIL: "auth:error.credentials.email.invalid",
  INVALID_EMAIL_OR_PASSWORD: "auth:error.credentials.invalidEmailOrPassword",
  SOCIAL_ACCOUNT_ALREADY_LINKED: "auth:error.social.alreadyLinked",
  PROVIDER_NOT_FOUND: "auth:error.social.providerNotFound",
  INVALID_TOKEN: "auth:error.token.invalid",
  ID_TOKEN_NOT_SUPPORTED: "auth:error.token.idNotSupported",
  FAILED_TO_GET_USER_INFO: "auth:error.user.infoNotFound",
  USER_EMAIL_NOT_FOUND: "auth:error.user.emailNotFound",
  EMAIL_NOT_VERIFIED: "auth:error.credentials.email.notVerified",
  PASSWORD_TOO_SHORT: "auth:error.credentials.password.tooShort",
  PASSWORD_TOO_LONG: "auth:error.credentials.password.tooLong",
  USER_ALREADY_EXISTS: "auth:error.user.alreadyExists",
  EMAIL_CAN_NOT_BE_UPDATED: "auth:error.credentials.email.cannotUpdate",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "auth:error.credentials.notFound",
  SESSION_EXPIRED: "auth:error.session.expired",
  FAILED_TO_UNLINK_LAST_ACCOUNT: "auth:error.social.unlinkLastAccount",
  ACCOUNT_NOT_FOUND: "auth:error.user.accountNotFound",
  CHALLENGE_NOT_FOUND: "auth:error.passkey.challengeNotFound",
  YOU_ARE_NOT_ALLOWED_TO_REGISTER_THIS_PASSKEY: "auth:error.passkey.notAllowed",
  FAILED_TO_VERIFY_REGISTRATION: "auth:error.passkey.verificationFailed",
  PASSKEY_NOT_FOUND: "auth:error.passkey.notFound",
  FAILED_TO_UPDATE_PASSKEY: "auth:error.passkey.updateFailed",
  ANONYMOUS_USERS_CANNOT_SIGN_IN_AGAIN_ANONYMOUSLY:
    "auth:error.anonymous.cannotSignInAgain",
  OTP_NOT_ENABLED: "auth:error.otp.notEnabled",
  OTP_HAS_EXPIRED: "auth:error.otp.expired",
  OTP_EXPIRED: "auth:error.otp.expired",
  INVALID_OTP: "auth:error.code.invalid",
  TOO_MANY_ATTEMPTS: "auth:error.code.tooManyAttempts",
  TOTP_NOT_ENABLED: "auth:error.totp.notEnabled",
  TWO_FACTOR_NOT_ENABLED: "auth:error.twoFactor.notEnabled",
  BACKUP_CODES_NOT_ENABLED: "auth:error.backupCodes.notEnabled",
  INVALID_BACKUP_CODE: "auth:error.code.invalid",
  INVALID_CODE: "auth:error.code.invalid",
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: "auth:error.code.tooManyAttempts",
  INVALID_TWO_FACTOR_COOKIE: "auth:error.twoFactor.invalidCookie",
  INVALID_CALLBACK_URL: "auth:error.url.invalidCallbackUrl",
  INVALID_REDIRECT_URL: "auth:error.url.invalidRedirectUrl",
  INVALID_ERROR_CALLBACK_URL: "auth:error.url.invalidErrorCallbackUrl",
  INVALID_NEW_USER_CALLBACK_URL: "auth:error.url.invalidNewUserCallbackUrl",
  CALLBACK_URL_REQUIRED: "auth:error.url.callbackUrlRequired",
  ROLE_IS_ASSIGNED_TO_MEMBERS: "organization:error.ac.roleAssignedToMembers",
  INVALID_USER: "auth:error.user.invalid",
  TOKEN_EXPIRED: "auth:error.token.expired",
  METHOD_NOT_ALLOWED_DEFER_SESSION_REQUIRED:
    "auth:error.methodNotAllowedDeferSessionRequired",
  BODY_MUST_BE_AN_OBJECT: "auth:error.bodyMustBeAnObject",
  PASSWORD_ALREADY_SET: "auth:error.credentials.password.alreadySet",
  PREVIOUSLY_REGISTERED: "auth:error.user.previouslyRegistered",
  REGISTRATION_CANCELLED: "auth:error.user.registrationCancelled",
  AUTH_CANCELLED: "auth:error.authCancelled",
  UNKNOWN_ERROR: "auth:error.unknown",
  RESOLVED_USER_INVALID: "auth:error.user.invalid",
  RESOLVE_USER_REQUIRED: "auth:error.user.resolveRequired",
  SESSION_REQUIRED: "auth:error.session.required",
  // 由 anonymous / organization / changeEmail 插件贡献的错误码（随第三方依赖落位后
  // auth.$ERROR_CODES 完整解析而补全其翻译键映射）。
  FAILED_TO_DELETE_ANONYMOUS_USER_SESSIONS:
    "auth:error.user.failedToDeleteAnonymousUserSessions",
  EMAIL_VERIFICATION_REQUIRED_FOR_INVITATION:
    "organization:error.invitation.emailVerificationRequiredForInvitation",
  CHANGE_EMAIL_DISABLED: "auth:error.credentials.email.changeDisabled",
} as const satisfies Record<AuthErrorCode, TranslationKey>;

export type { AuthConfig, AuthErrorCode };

export {
  authConfigSchema,
  SocialProvider,
  AuthProvider,
  SecondFactor,
  ERROR_MESSAGES,
  MemberRole,
  UserRole,
  InvitationStatus,
  VerificationType,
};

export type {
  User,
  Session,
  Invitation,
  Organization,
  ActiveOrganization,
  Member,
  Permissions,
} from "./server";