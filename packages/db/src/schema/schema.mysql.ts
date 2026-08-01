/**
 * MySQL dialect schema definitions.
 *
 * Active when DATABASE_PROVIDER is `mysql`.
 * Exports the same symbol names and `$inferSelect` / `$inferInsert` types as
 * the `schema.sqlite` and `schema.postgres` dialects so callers and drizzle-kit
 * remain dialect-agnostic.
 *
 * Per the design's dialect field convention, identifier / general string
 * columns use `varchar(255)`; enum-like short fields keep narrower lengths and
 * large text/JSON payloads use `longtext`.
 *
 * Composite / secondary performance indexes (e.g. the credit FIFO index
 * `idx_credit_consume_fifo`) are declared per table via the table callback and
 * kept equivalent across all three dialects (same index names, same column
 * order). All indexed columns are `varchar`/`int`/`timestamp` (never
 * `text`/`longtext`), so no MySQL index prefix length is required. Column-level
 * `.unique()` constraints are part of the data model.
 */

import {
  boolean,
  index,
  int,
  longtext,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const table = mysqlTable;

const varchar255 = (name: string) => varchar(name, { length: 255 });

// ─── Auth ────────────────────────────────────────────────────────────────────

export const user = table(
  "user",
  {
    banExpires: timestamp("ban_expires"),
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    email: varchar255("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    id: varchar255("id").primaryKey(),
    image: text("image"),
    ip: varchar("ip", { length: 45 }).notNull().default(""),
    isAnonymous: boolean("is_anonymous").default(false),
    locale: varchar("locale", { length: 20 }).notNull().default(""),
    name: varchar255("name").notNull(),
    role: varchar255("role"),
    twoFactorEnabled: boolean("two_factor_enabled").default(false),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    utmSource: varchar("utm_source", { length: 100 }).notNull().default(""),
  },
  (t) => [
    index("idx_user_name").on(t.name),
    index("idx_user_created_at").on(t.createdAt),
  ]
);

export const session = table(
  "session",
  {
    activeOrganizationId: varchar255("active_organization_id"),
    activeTeamId: varchar255("active_team_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: varchar255("id").primaryKey(),
    impersonatedBy: varchar255("impersonated_by"),
    ipAddress: varchar("ip_address", { length: 45 }),
    token: varchar255("token").notNull().unique(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    userAgent: text("user_agent"),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("idx_session_user_expires").on(t.userId, t.expiresAt)]
);

export const account = table(
  "account",
  {
    accessToken: text("access_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    accountId: varchar255("account_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: varchar255("id").primaryKey(),
    idToken: text("id_token"),
    password: text("password"),
    providerId: varchar("provider_id", { length: 50 }).notNull(),
    refreshToken: text("refresh_token"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: varchar("scope", { length: 255 }),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_account_user_id").on(t.userId),
    index("idx_account_provider_account").on(t.providerId, t.accountId),
  ]
);

export const verification = table(
  "verification",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: varchar255("id").primaryKey(),
    identifier: varchar255("identifier").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    value: text("value").notNull(),
  },
  (t) => [index("idx_verification_identifier").on(t.identifier)]
);

export const passkey = table(
  "passkey",
  {
    aaguid: varchar255("aaguid"),
    backedUp: boolean("backed_up").notNull(),
    counter: int("counter").notNull(),
    createdAt: timestamp("created_at"),
    credentialID: varchar255("credential_id").notNull(),
    deviceType: varchar("device_type", { length: 50 }).notNull(),
    id: varchar255("id").primaryKey(),
    name: varchar255("name"),
    publicKey: text("public_key").notNull(),
    transports: text("transports"),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_passkey_user_id").on(t.userId),
    index("idx_passkey_credential_id").on(t.credentialID),
  ]
);

export const twoFactor = table(
  "two_factor",
  {
    backupCodes: longtext("backup_codes").notNull(),
    id: varchar255("id").primaryKey(),
    secret: varchar255("secret").notNull(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
  },
  (t) => [
    index("idx_two_factor_secret").on(t.secret),
    index("idx_two_factor_user_id").on(t.userId),
  ]
);

export const organization = table(
  "organization",
  {
    createdAt: timestamp("created_at").notNull(),
    id: varchar255("id").primaryKey(),
    logo: text("logo"),
    metadata: longtext("metadata"),
    name: varchar255("name").notNull(),
    slug: varchar255("slug").notNull().unique(),
  },
  (t) => [index("idx_organization_slug").on(t.slug)]
);

export const member = table(
  "member",
  {
    createdAt: timestamp("created_at").notNull(),
    id: varchar255("id").primaryKey(),
    organizationId: varchar255("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: varchar255("role").notNull().default("member"),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_member_organization_id").on(t.organizationId),
    index("idx_member_user_id").on(t.userId),
  ]
);

export const invitation = table(
  "invitation",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    email: varchar255("email").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: varchar255("id").primaryKey(),
    inviterId: varchar255("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: varchar255("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: varchar255("role"),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    teamId: varchar255("team_id"),
  },
  (t) => [
    index("idx_invitation_organization_id").on(t.organizationId),
    index("idx_invitation_email").on(t.email),
  ]
);

export const team = table(
  "team",
  {
    createdAt: timestamp("created_at").notNull(),
    id: varchar255("id").primaryKey(),
    name: varchar255("name").notNull(),
    organizationId: varchar255("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at").onUpdateNow(),
  },
  (t) => [index("idx_team_organization_id").on(t.organizationId)]
);

export const teamMember = table(
  "team_member",
  {
    createdAt: timestamp("created_at"),
    id: varchar255("id").primaryKey(),
    teamId: varchar255("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_team_member_team_id").on(t.teamId),
    index("idx_team_member_user_id").on(t.userId),
  ]
);

// ─── Device Authorization (RFC 8628) ─────────────────────────────────────────
// Better Auth deviceAuthorization 插件要求 deviceCode 模型：CLI 登录经设备授权流写于此。
// 插件字段契约见 better-auth@1.6.11 dist/plugins/device-authorization/index.d.mts。

export const deviceCode = table(
  "device_code",
  {
    clientId: varchar255("client_id"),
    deviceCode: varchar255("device_code").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    id: varchar255("id").primaryKey(),
    lastPolledAt: timestamp("last_polled_at"),
    pollingInterval: int("polling_interval"),
    scope: varchar255("scope"),
    status: varchar255("status").notNull(),
    userCode: varchar255("user_code").notNull(),
    userId: varchar255("user_id"),
  },
  (t) => [
    index("idx_device_code_user_code").on(t.userCode),
    index("idx_device_code_status").on(t.status),
  ]
);

// ─── Content ─────────────────────────────────────────────────────────────────

export const config = table("config", {
  name: varchar255("name").unique().notNull(),
  value: text("value"),
});

export const taxonomy = table(
  "taxonomy",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    description: text("description"),
    icon: varchar255("icon"),
    id: varchar255("id").primaryKey(),
    image: text("image"),
    parentId: varchar255("parent_id"),
    slug: varchar255("slug").unique().notNull(),
    sort: int("sort").default(0).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("idx_taxonomy_type_status").on(t.type, t.status)]
);

export const post = table(
  "post",
  {
    authorImage: text("author_image"),
    authorName: varchar255("author_name"),
    categories: text("categories"),
    content: longtext("content"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    description: text("description"),
    id: varchar255("id").primaryKey(),
    image: text("image"),
    parentId: varchar255("parent_id"),
    slug: varchar255("slug").unique().notNull(),
    sort: int("sort").default(0).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    tags: text("tags"),
    title: varchar("title", { length: 255 }),
    type: varchar("type", { length: 50 }).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("idx_post_type_status").on(t.type, t.status)]
);

// ─── Business ────────────────────────────────────────────────────────────────

export const order = table(
  "order",
  {
    amount: int("amount").notNull(),
    callbackUrl: text("callback_url"),
    checkoutInfo: text("checkout_info").notNull(),
    checkoutResult: text("checkout_result"),
    checkoutUrl: text("checkout_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    creditsAmount: int("credits_amount"),
    creditsValidDays: int("credits_valid_days"),
    currency: varchar("currency", { length: 10 }).notNull(),
    deletedAt: timestamp("deleted_at"),
    description: text("description"),
    discountAmount: int("discount_amount"),
    discountCode: varchar255("discount_code"),
    discountCurrency: varchar("discount_currency", { length: 10 }),
    id: varchar255("id").primaryKey(),
    invoiceId: varchar255("invoice_id"),
    invoiceUrl: text("invoice_url"),
    orderNo: varchar255("order_no").unique().notNull(),
    paidAt: timestamp("paid_at"),
    paymentAmount: int("payment_amount"),
    paymentCurrency: varchar("payment_currency", { length: 10 }),
    paymentEmail: varchar255("payment_email"),
    paymentInterval: varchar("payment_interval", { length: 50 }),
    paymentProductId: varchar255("payment_product_id"),
    paymentProvider: varchar("payment_provider", { length: 50 }).notNull(),
    paymentResult: text("payment_result"),
    paymentSessionId: varchar255("payment_session_id"),
    paymentType: varchar("payment_type", { length: 50 }),
    paymentUserId: varchar255("payment_user_id"),
    paymentUserName: varchar255("payment_user_name"),
    planName: varchar255("plan_name"),
    productId: varchar255("product_id"),
    productName: varchar("product_name", { length: 255 }),
    status: varchar("status", { length: 50 }).notNull(),
    subscriptionId: varchar255("subscription_id"),
    subscriptionNo: varchar255("subscription_no"),
    subscriptionResult: text("subscription_result"),
    transactionId: varchar255("transaction_id"),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    userEmail: varchar255("user_email"),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_order_user_status_payment_type").on(
      t.userId,
      t.status,
      t.paymentType
    ),
    index("idx_order_transaction_provider").on(
      t.transactionId,
      t.paymentProvider
    ),
    index("idx_order_created_at").on(t.createdAt),
  ]
);

export const subscription = table(
  "subscription",
  {
    amount: int("amount"),
    billingUrl: text("billing_url"),
    canceledAt: timestamp("canceled_at"),
    canceledEndAt: timestamp("canceled_end_at"),
    canceledReason: text("canceled_reason"),
    canceledReasonType: varchar("canceled_reason_type", { length: 50 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    creditsAmount: int("credits_amount"),
    creditsValidDays: int("credits_valid_days"),
    currency: varchar("currency", { length: 10 }),
    currentPeriodEnd: timestamp("current_period_end"),
    currentPeriodStart: timestamp("current_period_start"),
    deletedAt: timestamp("deleted_at"),
    description: text("description"),
    id: varchar255("id").primaryKey(),
    interval: varchar("interval", { length: 50 }),
    intervalCount: int("interval_count"),
    paymentProductId: varchar255("payment_product_id"),
    paymentProvider: varchar("payment_provider", { length: 50 }).notNull(),
    paymentUserId: varchar255("payment_user_id"),
    planName: varchar255("plan_name"),
    productId: varchar255("product_id"),
    productName: varchar("product_name", { length: 255 }),
    status: varchar("status", { length: 50 }).notNull(),
    subscriptionId: varchar255("subscription_id").notNull(),
    subscriptionNo: varchar255("subscription_no").unique().notNull(),
    subscriptionResult: text("subscription_result"),
    trialPeriodDays: int("trial_period_days"),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    userEmail: varchar255("user_email"),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_subscription_user_status_interval").on(
      t.userId,
      t.status,
      t.interval
    ),
    index("idx_subscription_provider_id").on(
      t.subscriptionId,
      t.paymentProvider
    ),
    index("idx_subscription_created_at").on(t.createdAt),
  ]
);

export const credit = table(
  "credit",
  {
    consumedDetail: text("consumed_detail"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    credits: int("credits").notNull(),
    deletedAt: timestamp("deleted_at"),
    description: text("description"),
    expiresAt: timestamp("expires_at"),
    id: varchar255("id").primaryKey(),
    metadata: text("metadata"),
    orderNo: varchar255("order_no"),
    remainingCredits: int("remaining_credits").notNull().default(0),
    status: varchar("status", { length: 50 }).notNull(),
    subscriptionNo: varchar255("subscription_no"),
    transactionNo: varchar255("transaction_no").unique().notNull(),
    transactionScene: varchar("transaction_scene", { length: 50 }),
    transactionType: varchar("transaction_type", { length: 50 }).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    userEmail: varchar255("user_email"),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_credit_consume_fifo").on(
      t.userId,
      t.status,
      t.transactionType,
      t.remainingCredits,
      t.expiresAt
    ),
    index("idx_credit_order_no").on(t.orderNo),
    index("idx_credit_subscription_no").on(t.subscriptionNo),
  ]
);

export const apikey = table(
  "apikey",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    id: varchar255("id").primaryKey(),
    keyHash: varchar255("key_hash").notNull(),
    keyPrefix: varchar255("key_prefix").notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    title: varchar255("title").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_apikey_user_status").on(t.userId, t.status),
    index("idx_apikey_keyhash_status").on(t.keyHash, t.status),
  ]
);

// ─── RBAC ────────────────────────────────────────────────────────────────────

export const role = table(
  "role",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    id: varchar255("id").primaryKey(),
    name: varchar255("name").notNull().unique(),
    sort: int("sort").default(0).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    title: varchar255("title").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_role_status").on(t.status)]
);

export const permission = table(
  "permission",
  {
    action: varchar("action", { length: 50 }).notNull(),
    code: varchar255("code").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    id: varchar255("id").primaryKey(),
    resource: varchar("resource", { length: 50 }).notNull(),
    title: varchar255("title").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_permission_resource_action").on(t.resource, t.action)]
);

export const rolePermission = table(
  "role_permission",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    id: varchar255("id").primaryKey(),
    permissionId: varchar255("permission_id")
      .notNull()
      .references(() => permission.id, { onDelete: "cascade" }),
    roleId: varchar255("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_role_permission_role_permission").on(t.roleId, t.permissionId),
  ]
);

export const userRole = table(
  "user_role",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
    id: varchar255("id").primaryKey(),
    roleId: varchar255("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_user_role_user_expires").on(t.userId, t.expiresAt),
    uniqueIndex("uq_user_role_user_role").on(t.userId, t.roleId),
  ]
);

// ─── AI ──────────────────────────────────────────────────────────────────────

export const aiTask = table(
  "ai_task",
  {
    costCredits: int("cost_credits").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    creditId: varchar255("credit_id"),
    deletedAt: timestamp("deleted_at"),
    id: varchar255("id").primaryKey(),
    mediaType: varchar("media_type", { length: 50 }).notNull(),
    model: varchar255("model").notNull(),
    options: longtext("options"),
    prompt: longtext("prompt").notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
    scene: varchar("scene", { length: 100 }).notNull().default(""),
    status: varchar("status", { length: 50 }).notNull(),
    taskId: varchar255("task_id"),
    taskInfo: longtext("task_info"),
    taskResult: longtext("task_result"),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_ai_task_user_media_type").on(t.userId, t.mediaType),
    index("idx_ai_task_media_type_status").on(t.mediaType, t.status),
  ]
);

export const chat = table(
  "chat",
  {
    content: longtext("content"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: varchar255("id").primaryKey(),
    metadata: longtext("metadata"),
    model: varchar255("model").notNull(),
    parts: longtext("parts").notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }).notNull().default(""),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("idx_chat_user_status").on(t.userId, t.status)]
);

export const chatMessage = table(
  "chat_message",
  {
    chatId: varchar255("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: varchar255("id").primaryKey(),
    metadata: longtext("metadata"),
    model: varchar255("model").notNull(),
    parts: longtext("parts").notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
    role: varchar("role", { length: 50 }).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_chat_message_chat_id").on(t.chatId, t.status),
    index("idx_chat_message_user_id").on(t.userId, t.status),
  ]
);

// ─── Tickets (support) ─────────────────────────────────────────────────────────

export const ticket = table(
  "ticket",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: varchar255("id").primaryKey(),
    status: varchar("status", { length: 50 }).notNull().default("open"),
    title: varchar("title", { length: 255 }).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id),
  },
  (t) => [
    index("idx_ticket_user").on(t.userId),
    index("idx_ticket_status").on(t.status),
  ]
);

export const ticketMessage = table(
  "ticket_message",
  {
    attachments: longtext("attachments").notNull().default("[]"),
    content: longtext("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: varchar255("id").primaryKey(),
    role: varchar("role", { length: 50 }).notNull().default("user"),
    ticketId: varchar255("ticket_id")
      .notNull()
      .references(() => ticket.id),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id),
  },
  (t) => [index("idx_ticket_message_ticket").on(t.ticketId)]
);

// ─── Invite Codes ──────────────────────────────────────────────────────────────

export const inviteCode = table(
  "invite_code",
  {
    code: varchar255("code").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: varchar255("created_by").references(() => user.id),
    expiresAt: timestamp("expires_at"),
    id: varchar255("id").primaryKey(),
    maxUses: int("max_uses").notNull().default(1),
    note: text("note").default(""),
    trialDays: int("trial_days").notNull().default(15),
    usedCount: int("used_count").notNull().default(0),
  },
  (t) => [index("idx_invite_code_code").on(t.code)]
);

export const userInvite = table(
  "user_invite",
  {
    activatedAt: timestamp("activated_at").defaultNow().notNull(),
    id: varchar255("id").primaryKey(),
    inviteCodeId: varchar255("invite_code_id")
      .notNull()
      .references(() => inviteCode.id),
    trialEndsAt: timestamp("trial_ends_at").notNull(),
    userId: varchar255("user_id")
      .notNull()
      .unique()
      .references(() => user.id),
  },
  (t) => [
    index("idx_user_invite_user").on(t.userId),
    index("idx_user_invite_code").on(t.inviteCodeId),
  ]
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type Config = typeof config.$inferSelect;
export type Taxonomy = typeof taxonomy.$inferSelect;
export type NewTaxonomy = typeof taxonomy.$inferInsert;
export type Post = typeof post.$inferSelect;
export type NewPost = typeof post.$inferInsert;
export type Order = typeof order.$inferSelect;
export type NewOrder = typeof order.$inferInsert;
export type Subscription = typeof subscription.$inferSelect;
export type NewSubscription = typeof subscription.$inferInsert;
export type Credit = typeof credit.$inferSelect;
export type NewCredit = typeof credit.$inferInsert;
export type Apikey = typeof apikey.$inferSelect;
export type NewApikey = typeof apikey.$inferInsert;
export type Role = typeof role.$inferSelect;
export type NewRole = typeof role.$inferInsert;
export type Permission = typeof permission.$inferSelect;
export type RolePermission = typeof rolePermission.$inferSelect;
export type UserRole = typeof userRole.$inferSelect;
export type AiTask = typeof aiTask.$inferSelect;
export type NewAiTask = typeof aiTask.$inferInsert;
export type Chat = typeof chat.$inferSelect;
export type NewChat = typeof chat.$inferInsert;
export type ChatMessage = typeof chatMessage.$inferSelect;
export type NewChatMessage = typeof chatMessage.$inferInsert;
export type Ticket = typeof ticket.$inferSelect;
export type NewTicket = typeof ticket.$inferInsert;
export type TicketMessage = typeof ticketMessage.$inferSelect;
export type NewTicketMessage = typeof ticketMessage.$inferInsert;
export type InviteCode = typeof inviteCode.$inferSelect;
export type NewInviteCode = typeof inviteCode.$inferInsert;
export type UserInvite = typeof userInvite.$inferSelect;
export type NewUserInvite = typeof userInvite.$inferInsert;
export type DeviceCode = typeof deviceCode.$inferSelect;
export type NewDeviceCode = typeof deviceCode.$inferInsert;
