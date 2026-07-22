// @openstarter/email 包入口 —— 导出事务性邮件的模板枚举。
// 位于 auth 依赖层之下，不依赖 packages/api、packages/auth（避免环依赖）。
// 服务端发送入口（sendEmail/EmailManager/EmailProvider）由 ./server 提供（任务 4.2）。
// Requirements: 22.2、22.6。

// ultracite 禁用 TS enum，改用 `as const` 对象 + 同名类型（值取 kebab-case）。
// 键集须与 Auth_Service（packages/auth/src/server.ts）实际引用的 EmailTemplate.XXX 完全一致，
// 覆盖 auth 现有 7 个触发场景，与 src/templates 下的模板组件一一对应。
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
