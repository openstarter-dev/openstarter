import type { TranslationKey } from "@openstarter/i18n";
// biome-ignore lint/performance/noNamespaceImport: zod 的 z.infer 等类型助手以命名空间形式导出，具名导入会丢失部分类型推断；沿用 packages/auth/src/env.ts 同款写法。
import * as z from "zod";
import type { AuthErrorCode } from "./server";

const SocialProvider = {
  APPLE: "apple",
  GITHUB: "github",
  GOOGLE: "google",
} as const;

type SocialProvider = (typeof SocialProvider)[keyof typeof SocialProvider];

const AuthProvider = {
  ...SocialProvider,
  ANONYMOUS: "anonymous",
  EMAIL_OTP: "emailOtp",
  MAGIC_LINK: "magicLink",
  PASSKEY: "passkey",
  PASSWORD: "password",
} as const;

type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

const SecondFactor = {
  BACKUP_CODE: "backupCode",
  TOTP: "totp",
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
  ADMIN: "admin",
  USER: "user",
} as const;

type UserRole = (typeof UserRole)[keyof typeof UserRole];

const MemberRole = {
  ADMIN: "admin",
  MEMBER: "member",
  OWNER: "owner",
} as const;

type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];

const InvitationStatus = {
  ACCEPTED: "accepted",
  CANCELED: "canceled",
  PENDING: "pending",
  REJECTED: "rejected",
} as const;

type InvitationStatus =
  (typeof InvitationStatus)[keyof typeof InvitationStatus];

const VerificationType = {
  CONFIRM_EMAIL: "confirm-email",
  DELETE_ACCOUNT: "delete-account",
  MAGIC_LINK: "magic-link",
} as const;

type VerificationType =
  (typeof VerificationType)[keyof typeof VerificationType];

type AuthConfig = z.infer<typeof authConfigSchema>;

const ERROR_MESSAGES = {
  ACCESS_DENIED: "auth:error.device.accessDenied",
  ACCOUNT_NOT_FOUND: "auth:error.user.accountNotFound",
  ANONYMOUS_USERS_CANNOT_SIGN_IN_AGAIN_ANONYMOUSLY:
    "auth:error.anonymous.cannotSignInAgain",
  ASYNC_VALIDATION_NOT_SUPPORTED: "auth:error.asyncValidationNotSupported",
  AUTH_CANCELLED: "auth:error.authCancelled",
  AUTHENTICATION_FAILED: "auth:error.authenticationFailed",
  AUTHENTICATION_REQUIRED: "auth:error.device.authenticationRequired",
  AUTHORIZATION_PENDING: "auth:error.device.authorizationPending",
  BACKUP_CODES_NOT_ENABLED: "auth:error.backupCodes.notEnabled",
  BANNED_USER: "auth:error.user.banned",
  BODY_MUST_BE_AN_OBJECT: "auth:error.bodyMustBeAnObject",
  CALLBACK_URL_REQUIRED: "auth:error.url.callbackUrlRequired",
  CANNOT_DELETE_A_PRE_DEFINED_ROLE:
    "organization:error.ac.cannotDeletePreDefinedRole",
  CHALLENGE_NOT_FOUND: "auth:error.passkey.challengeNotFound",
  CHANGE_EMAIL_DISABLED: "auth:error.credentials.email.changeDisabled",
  COULD_NOT_CREATE_SESSION: "auth:error.session.creation",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "auth:error.credentials.notFound",
  CROSS_SITE_NAVIGATION_LOGIN_BLOCKED:
    "auth:error.crossSiteNavigationLoginBlocked",
  DELETE_ANONYMOUS_USER_DISABLED: "auth:error.user.deleteAnonymousUserDisabled",
  DEVICE_CODE_ALREADY_PROCESSED: "auth:error.device.alreadyProcessed",
  DEVICE_CODE_NOT_CLAIMED: "auth:error.device.notClaimed",
  EMAIL_ALREADY_VERIFIED: "auth:error.user.emailAlreadyVerified",
  EMAIL_CAN_NOT_BE_UPDATED: "auth:error.credentials.email.cannotUpdate",
  EMAIL_MISMATCH: "auth:error.user.emailMismatch",
  EMAIL_NOT_VERIFIED: "auth:error.credentials.email.notVerified",
  EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION:
    "organization:error.invitation.emailVerificationRequired",
  EMAIL_VERIFICATION_REQUIRED_FOR_INVITATION:
    "organization:error.invitation.emailVerificationRequiredForInvitation",
  EXPIRED_DEVICE_CODE: "auth:error.device.expiredDeviceCode",
  EXPIRED_USER_CODE: "auth:error.device.expiredUserCode",
  FAILED_TO_CREATE_SESSION: "auth:error.session.creation",
  FAILED_TO_CREATE_USER: "auth:error.account.creation",
  FAILED_TO_CREATE_VERIFICATION: "auth:error.failedToCreateVerification",
  FAILED_TO_DELETE_ANONYMOUS_USER:
    "auth:error.user.failedToDeleteAnonymousUser",
  // 由 anonymous / organization / changeEmail 插件贡献的错误码（随第三方依赖落位后
  // auth.$ERROR_CODES 完整解析而补全其翻译键映射）。
  FAILED_TO_DELETE_ANONYMOUS_USER_SESSIONS:
    "auth:error.user.failedToDeleteAnonymousUserSessions",
  FAILED_TO_GET_SESSION: "auth:error.session.retrieval",
  FAILED_TO_GET_USER_INFO: "auth:error.user.infoNotFound",
  FAILED_TO_RETRIEVE_INVITATION:
    "organization:error.invitation.failedToRetrieve",
  FAILED_TO_UNLINK_LAST_ACCOUNT: "auth:error.social.unlinkLastAccount",
  FAILED_TO_UPDATE_PASSKEY: "auth:error.passkey.updateFailed",
  FAILED_TO_UPDATE_USER: "auth:error.account.update",
  FAILED_TO_VERIFY_REGISTRATION: "auth:error.passkey.verificationFailed",
  FIELD_NOT_ALLOWED: "auth:error.fieldNotAllowed",
  ID_TOKEN_NOT_SUPPORTED: "auth:error.token.idNotSupported",
  INVALID_BACKUP_CODE: "auth:error.code.invalid",
  INVALID_CALLBACK_URL: "auth:error.url.invalidCallbackUrl",
  INVALID_CODE: "auth:error.code.invalid",
  // 由 deviceAuthorization 插件（RFC 8628）贡献的错误码：CLI 设备授权流的
  // 取码/轮询/批准/拒绝端点经此映射到可翻译消息键。注意 USER_NOT_FOUND 与
  // FAILED_TO_CREATE_SESSION 已在上方由通用 better-auth 错误码覆盖，此处不重复。
  INVALID_DEVICE_CODE: "auth:error.device.invalidDeviceCode",
  INVALID_DEVICE_CODE_STATUS: "auth:error.device.invalidStatus",
  INVALID_EMAIL: "auth:error.credentials.email.invalid",
  INVALID_EMAIL_FORMAT: "auth:error.credentials.email.invalidFormat",
  INVALID_EMAIL_OR_PASSWORD: "auth:error.credentials.invalidEmailOrPassword",
  INVALID_ERROR_CALLBACK_URL: "auth:error.url.invalidErrorCallbackUrl",
  INVALID_NEW_USER_CALLBACK_URL: "auth:error.url.invalidNewUserCallbackUrl",
  INVALID_ORIGIN: "auth:error.invalidOrigin",
  INVALID_OTP: "auth:error.code.invalid",
  INVALID_PASSWORD: "auth:error.credentials.password.invalid",
  INVALID_REDIRECT_URL: "auth:error.url.invalidRedirectUrl",
  INVALID_RESOURCE: "organization:error.ac.invalidResource",
  INVALID_ROLE_TYPE: "auth:error.invalidRoleType",
  INVALID_TOKEN: "auth:error.token.invalid",
  INVALID_TWO_FACTOR_COOKIE: "auth:error.twoFactor.invalidCookie",
  INVALID_USER: "auth:error.user.invalid",
  INVALID_USER_CODE: "auth:error.device.invalidUserCode",
  INVITATION_LIMIT_REACHED: "organization:error.invitation.limitReached",
  INVITATION_NOT_FOUND: "organization:error.invitation.notFound",
  INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION:
    "organization:error.invitation.inviterNoLongerMember",
  LINKED_ACCOUNT_ALREADY_EXISTS:
    "auth:error.account.linkedAccountAlreadyExists",
  MEMBER_NOT_FOUND: "organization:error.memberNotFound",
  METHOD_NOT_ALLOWED_DEFER_SESSION_REQUIRED:
    "auth:error.methodNotAllowedDeferSessionRequired",
  MISSING_AC_INSTANCE: "organization:error.ac.missingAcInstance",
  MISSING_FIELD: "auth:error.missingField",
  MISSING_OR_NULL_ORIGIN: "auth:error.missingOrNullOrigin",
  NO_ACTIVE_ORGANIZATION: "organization:error.noActive",
  NO_DATA_TO_UPDATE: "auth:error.noDataToUpdate",
  ORGANIZATION_ALREADY_EXISTS: "organization:error.alreadyExists",
  ORGANIZATION_MEMBERSHIP_LIMIT_REACHED:
    "organization:error.membershipLimitReached",
  ORGANIZATION_NOT_FOUND: "organization:error.notFound",
  ORGANIZATION_SLUG_ALREADY_TAKEN: "organization:error.slugAlreadyTaken",
  OTP_EXPIRED: "auth:error.otp.expired",
  OTP_HAS_EXPIRED: "auth:error.otp.expired",
  OTP_NOT_ENABLED: "auth:error.otp.notEnabled",
  PASSKEY_NOT_FOUND: "auth:error.passkey.notFound",
  PASSWORD_ALREADY_SET: "auth:error.credentials.password.alreadySet",
  PASSWORD_TOO_LONG: "auth:error.credentials.password.tooLong",
  PASSWORD_TOO_SHORT: "auth:error.credentials.password.tooShort",
  POLLING_TOO_FREQUENTLY: "auth:error.device.pollingTooFrequently",
  PREVIOUSLY_REGISTERED: "auth:error.user.previouslyRegistered",
  PROVIDER_NOT_FOUND: "auth:error.social.providerNotFound",
  REGISTRATION_CANCELLED: "auth:error.user.registrationCancelled",
  RESOLVE_USER_REQUIRED: "auth:error.user.resolveRequired",
  RESOLVED_USER_INVALID: "auth:error.user.invalid",
  ROLE_IS_ASSIGNED_TO_MEMBERS: "organization:error.ac.roleAssignedToMembers",
  ROLE_NAME_IS_ALREADY_TAKEN: "organization:error.ac.roleNameAlreadyTaken",
  ROLE_NOT_FOUND: "organization:error.role.notFound",
  SESSION_EXPIRED: "auth:error.session.expired",
  SESSION_NOT_FRESH: "auth:error.session.notFresh",
  SESSION_REQUIRED: "auth:error.session.required",
  SOCIAL_ACCOUNT_ALREADY_LINKED: "auth:error.social.alreadyLinked",
  TEAM_ALREADY_EXISTS: "organization:error.team.alreadyExists",
  TEAM_MEMBER_LIMIT_REACHED: "organization:error.team.memberLimitReached",
  TEAM_NOT_FOUND: "organization:error.team.notFound",
  TOKEN_EXPIRED: "auth:error.token.expired",
  TOO_MANY_ATTEMPTS: "auth:error.code.tooManyAttempts",
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: "auth:error.code.tooManyAttempts",
  TOO_MANY_ROLES: "organization:error.ac.tooManyRoles",
  TOTP_NOT_ENABLED: "auth:error.totp.notEnabled",
  TWO_FACTOR_NOT_ENABLED: "auth:error.twoFactor.notEnabled",
  UNABLE_TO_CREATE_SESSION: "auth:error.session.creation",
  UNABLE_TO_REMOVE_LAST_TEAM: "organization:error.team.unableToRemoveLastTeam",
  UNKNOWN_ERROR: "auth:error.unknown",
  USER_ALREADY_EXISTS: "auth:error.user.alreadyExists",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "auth:error.user.alreadyExistsUseAnotherEmail",
  USER_ALREADY_HAS_PASSWORD: "auth:error.user.alreadyHasPassword",
  USER_EMAIL_NOT_FOUND: "auth:error.user.emailNotFound",
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION:
    "organization:error.userAlreadyMember",
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION:
    "organization:error.invitation.userAlreadyInvited",
  USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION: "organization:error.userNotMember",
  USER_IS_NOT_A_MEMBER_OF_THE_TEAM: "organization:error.team.userNotMember",
  USER_IS_NOT_ANONYMOUS: "auth:error.user.notAnonymous",
  USER_NOT_FOUND: "auth:error.user.notFound",
  VALIDATION_ERROR: "auth:error.validationError",
  VERIFICATION_EMAIL_NOT_ENABLED: "auth:error.user.verificationEmailNotEnabled",
  YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION: "organization:error.userNotMember",
  YOU_ARE_NOT_ALLOWED_TO_ACCESS_THIS_ORGANIZATION:
    "organization:error.cannotAccess",
  YOU_ARE_NOT_ALLOWED_TO_BAN_USERS: "admin:error.cannotBanUsers",
  YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION:
    "organization:error.invitation.cannotCancel",
  YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE: "auth:error.user.cannotChangeRole",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION:
    "organization:error.cannotCreateNew",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM:
    "organization:error.team.cannotCreateNew",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM_MEMBER:
    "organization:error.team.cannotCreateNewMember",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_A_ROLE:
    "organization:error.ac.cannotCreateRole",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_TEAMS_IN_THIS_ORGANIZATION:
    "organization:error.team.cannotCreateNew",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS: "admin:error.cannotCreateUsers",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_A_ROLE:
    "organization:error.ac.cannotDeleteRole",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_TEAMS_IN_THIS_ORGANIZATION:
    "organization:error.team.cannotDelete",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER:
    "organization:error.cannotDeleteMember",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION:
    "organization:error.cannotDelete",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_TEAM:
    "organization:error.team.cannotDelete",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS: "admin:error.cannotDeleteUsers",
  YOU_ARE_NOT_ALLOWED_TO_GET_A_ROLE: "organization:error.ac.cannotGetRole",
  YOU_ARE_NOT_ALLOWED_TO_GET_USER: "auth:error.user.cannotGetUser",
  YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS:
    "admin:error.cannotImpersonateUsers",
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE:
    "organization:error.invitation.cannotInviteUserWithRole",
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION:
    "organization:error.invitation.cannotInviteUsers",
  YOU_ARE_NOT_ALLOWED_TO_LIST_A_ROLE: "organization:error.ac.cannotListRole",
  YOU_ARE_NOT_ALLOWED_TO_LIST_USERS: "admin:error.cannotListUsers",
  YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS:
    "admin:error.cannotListUsersSessions",
  YOU_ARE_NOT_ALLOWED_TO_READ_A_ROLE: "organization:error.ac.cannotReadRole",
  YOU_ARE_NOT_ALLOWED_TO_REGISTER_THIS_PASSKEY: "auth:error.passkey.notAllowed",
  YOU_ARE_NOT_ALLOWED_TO_REMOVE_A_TEAM_MEMBER:
    "organization:error.team.cannotRemoveMember",
  YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS:
    "admin:error.cannotRevokeUsersSessions",
  YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE:
    "auth:error.cannotSetNonExistentValue",
  YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD:
    "admin:error.cannotSetUsersPassword",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_A_ROLE:
    "organization:error.ac.cannotUpdateRole",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER:
    "organization:error.cannotUpdateMember",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION:
    "organization:error.cannotUpdate",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_TEAM:
    "organization:error.team.cannotUpdate",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS: "admin:error.cannotUpdateUsers",
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION:
    "organization:error.invitation.notRecipient",
  YOU_CAN_NOT_ACCESS_THE_MEMBERS_OF_THIS_TEAM:
    "organization:error.team.cannotAccessMembers",
  YOU_CANNOT_BAN_YOURSELF: "auth:error.user.cannotBanYourself",
  YOU_CANNOT_IMPERSONATE_ADMINS: "auth:error.user.cannotImpersonateAdmins",
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER:
    "organization:error.cannotLeaveAsOnlyOwner",
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER:
    "organization:error.cannotLeaveWithoutOwner",
  YOU_CANNOT_REMOVE_YOURSELF: "auth:error.user.cannotRemoveYourself",
  YOU_DO_NOT_HAVE_AN_ACTIVE_TEAM: "organization:error.team.noActive",
  YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS:
    "organization:error.maximumNumberOfOrganizations",
  YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_TEAMS:
    "organization:error.team.maximumNumberOfTeams",
  YOU_MUST_BE_IN_AN_ORGANIZATION_TO_CREATE_A_ROLE:
    "organization:error.ac.mustBeInOrganizationToCreateRole",
} as const satisfies Record<AuthErrorCode, TranslationKey>;

export type {
  ActiveOrganization,
  AuthErrorCode,
  Invitation,
  Member,
  Organization,
  Permissions,
  Session,
  User,
} from "./server";
export type { AuthConfig };
export {
  AuthProvider,
  authConfigSchema,
  ERROR_MESSAGES,
  InvitationStatus,
  MemberRole,
  SecondFactor,
  SocialProvider,
  UserRole,
  VerificationType,
};
