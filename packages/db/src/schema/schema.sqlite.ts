/**
 * SQLite dialect schema definitions.
 *
 * Active when DATABASE_PROVIDER is `sqlite`, `turso` or `d1`.
 * Exports the same symbol names and `$inferSelect` / `$inferInsert` types as
 * the `schema.postgres` and `schema.mysql` dialects so callers and drizzle-kit
 * remain dialect-agnostic.
 *
 * Composite / secondary performance indexes (e.g. the credit FIFO index
 * `idx_credit_consume_fifo`) are declared per table via the table callback and
 * kept equivalent across all three dialects (same index names, same column
 * order). Column-level `.unique()` constraints are part of the data model.
 */

import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const table = sqliteTable;

const sqliteNowMs = sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`;

// ─── Auth ────────────────────────────────────────────────────────────────────

export const user = table(
  "user",
  {
    banExpires: integer("ban_expires", { mode: "timestamp_ms" }),
    banned: integer("banned", { mode: "boolean" }).default(false),
    banReason: text("ban_reason"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sqliteNowMs).notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
    id: text("id").primaryKey(),
    image: text("image"),
    ip: text("ip").notNull().default(""),
    isAnonymous: integer("is_anonymous", { mode: "boolean" }).default(false),
    locale: text("locale").notNull().default(""),
    name: text("name").notNull(),
    role: text("role"),
    twoFactorEnabled: integer("two_factor_enabled", {
      mode: "boolean",
    }).default(false),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    utmSource: text("utm_source").notNull().default(""),
  },
  (t) => [index("idx_user_name").on(t.name), index("idx_user_created_at").on(t.createdAt)],
);

export const session = table(
  "session",
  {
    activeOrganizationId: text("active_organization_id"),
    activeTeamId: text("active_team_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sqliteNowMs).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    impersonatedBy: text("impersonated_by"),
    ipAddress: text("ip_address"),
    token: text("token").notNull().unique(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("idx_session_user_expires").on(t.userId, t.expiresAt)],
);

export const account = table(
  "account",
  {
    accessToken: text("access_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    accountId: text("account_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sqliteNowMs).notNull(),
    id: text("id").primaryKey(),
    idToken: text("id_token"),
    password: text("password"),
    providerId: text("provider_id").notNull(),
    refreshToken: text("refresh_token"),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_account_user_id").on(t.userId),
    index("idx_account_provider_account").on(t.providerId, t.accountId),
  ],
);

export const verification = table(
  "verification",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sqliteNowMs).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    value: text("value").notNull(),
  },
  (t) => [index("idx_verification_identifier").on(t.identifier)],
);

export const passkey = table(
  "passkey",
  {
    aaguid: text("aaguid"),
    backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
    counter: integer("counter").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    credentialID: text("credential_id").notNull(),
    deviceType: text("device_type").notNull(),
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    transports: text("transports"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_passkey_user_id").on(t.userId),
    index("idx_passkey_credential_id").on(t.credentialID),
  ],
);

export const twoFactor = table(
  "two_factor",
  {
    backupCodes: text("backup_codes").notNull(),
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: integer("verified", { mode: "boolean" }).default(true),
  },
  (t) => [
    index("idx_two_factor_secret").on(t.secret),
    index("idx_two_factor_user_id").on(t.userId),
  ],
);

export const organization = table(
  "organization",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    logo: text("logo"),
    metadata: text("metadata"),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
  },
  (t) => [index("idx_organization_slug").on(t.slug)],
);

export const member = table(
  "member",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_member_organization_id").on(t.organizationId),
    index("idx_member_user_id").on(t.userId),
  ],
);

export const invitation = table(
  "invitation",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sqliteNowMs).notNull(),
    email: text("email").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: text("role"),
    status: text("status").notNull().default("pending"),
    teamId: text("team_id"),
  },
  (t) => [
    index("idx_invitation_organization_id").on(t.organizationId),
    index("idx_invitation_email").on(t.email),
  ],
);

export const team = table(
  "team",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$onUpdate(() => new Date()),
  },
  (t) => [index("idx_team_organization_id").on(t.organizationId)],
);

export const teamMember = table(
  "team_member",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_team_member_team_id").on(t.teamId),
    index("idx_team_member_user_id").on(t.userId),
  ],
);

// ─── Device Authorization (RFC 8628) ─────────────────────────────────────────
// Better Auth deviceAuthorization 插件要求 deviceCode 模型：CLI 登录经设备授权流写于此。
// 插件字段契约见 better-auth@1.6.11 dist/plugins/device-authorization/index.d.mts。

export const deviceCode = table(
  "device_code",
  {
    clientId: text("client_id"),
    deviceCode: text("device_code").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    lastPolledAt: integer("last_polled_at", { mode: "timestamp_ms" }),
    pollingInterval: integer("polling_interval"),
    scope: text("scope"),
    status: text("status").notNull(),
    userCode: text("user_code").notNull(),
    userId: text("user_id"),
  },
  (t) => [
    index("idx_device_code_user_code").on(t.userCode),
    index("idx_device_code_status").on(t.status),
  ],
);

// ─── Content ─────────────────────────────────────────────────────────────────

export const config = table("config", {
  name: text("name").unique().notNull(),
  value: text("value"),
});

export const taxonomy = table(
  "taxonomy",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sqliteNowMs).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    description: text("description"),
    icon: text("icon"),
    id: text("id").primaryKey(),
    image: text("image"),
    parentId: text("parent_id"),
    slug: text("slug").unique().notNull(),
    sort: integer("sort").default(0).notNull(),
    status: text("status").notNull(),
    title: text("title").notNull(),
    type: text("type").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("idx_taxonomy_type_status").on(t.type, t.status)],
);

export const post = table(
  "post",
  {
    authorImage: text("author_image"),
    authorName: text("author_name"),
    categories: text("categories"),
    content: text("content"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sqliteNowMs).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    description: text("description"),
    id: text("id").primaryKey(),
    image: text("image"),
    parentId: text("parent_id"),
    slug: text("slug").unique().notNull(),
    sort: integer("sort").default(0).notNull(),
    status: text("status").notNull(),
    tags: text("tags"),
    title: text("title"),
    type: text("type").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("idx_post_type_status").on(t.type, t.status)],
);

// ─── Business ────────────────────────────────────────────────────────────────

export const order = table(
  "order",
  {
    amount: integer("amount").notNull(),
    callbackUrl: text("callback_url"),
    checkoutInfo: text("checkout_info").notNull(),
    checkoutResult: text("checkout_result"),
    checkoutUrl: text("checkout_url"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sqliteNowMs).notNull(),
    creditsAmount: integer("credits_amount"),
    creditsValidDays: integer("credits_valid_days"),
    currency: text("currency").notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    description: text("description"),
    discountAmount: integer("discount_amount"),
    discountCode: text("discount_code"),
    discountCurrency: text("discount_currency"),
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id"),
    invoiceUrl: text("invoice_url"),
    orderNo: text("order_no").unique().notNull(),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    paymentAmount: integer("payment_amount"),
    paymentCurrency: text("payment_currency"),
    paymentEmail: text("payment_email"),
    paymentInterval: text("payment_interval"),
    paymentProductId: text("payment_product_id"),
    paymentProvider: text("payment_provider").notNull(),
    paymentResult: text("payment_result"),
    paymentSessionId: text("payment_session_id"),
    paymentType: text("payment_type"),
    paymentUserId: text("payment_user_id"),
    paymentUserName: text("payment_user_name"),
    planName: text("plan_name"),
    productId: text("product_id"),
    productName: text("product_name"),
    status: text("status").notNull(),
    subscriptionId: text("subscription_id"),
    subscriptionNo: text("subscription_no"),
    subscriptionResult: text("subscription_result"),
    transactionId: text("transaction_id"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    userEmail: text("user_email"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_order_user_status_payment_type").on(t.userId, t.status, t.paymentType),
    index("idx_order_transaction_provider").on(t.transactionId, t.paymentProvider),
    index("idx_order_created_at").on(t.createdAt),
  ],
);

export const subscription = table(
  "subscription",
  {
    amount: integer("amount"),
    billingUrl: text("billing_url"),
    canceledAt: integer("canceled_at", { mode: "timestamp_ms" }),
    canceledEndAt: integer("canceled_end_at", { mode: "timestamp_ms" }),
    canceledReason: text("canceled_reason"),
    canceledReasonType: text("canceled_reason_type"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sqliteNowMs).notNull(),
    creditsAmount: integer("credits_amount"),
    creditsValidDays: integer("credits_valid_days"),
    currency: text("currency"),
    currentPeriodEnd: integer("current_period_end", { mode: "timestamp_ms" }),
    currentPeriodStart: integer("current_period_start", {
      mode: "timestamp_ms",
    }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    description: text("description"),
    id: text("id").primaryKey(),
    interval: text("interval"),
    intervalCount: integer("interval_count"),
    paymentProductId: text("payment_product_id"),
    paymentProvider: text("payment_provider").notNull(),
    paymentUserId: text("payment_user_id"),
    planName: text("plan_name"),
    productId: text("product_id"),
    productName: text("product_name"),
    status: text("status").notNull(),
    subscriptionId: text("subscription_id").notNull(),
    subscriptionNo: text("subscription_no").unique().notNull(),
    subscriptionResult: text("subscription_result"),
    trialPeriodDays: integer("trial_period_days"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    userEmail: text("user_email"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_subscription_user_status_interval").on(t.userId, t.status, t.interval),
    index("idx_subscription_provider_id").on(t.subscriptionId, t.paymentProvider),
    index("idx_subscription_created_at").on(t.createdAt),
  ],
);

export const credit = table(
  "credit",
  {
    consumedDetail: text("consumed_detail"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sqliteNowMs).notNull(),
    credits: integer("credits").notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    description: text("description"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    id: text("id").primaryKey(),
    metadata: text("metadata"),
    orderNo: text("order_no"),
    remainingCredits: integer("remaining_credits").notNull().default(0),
    status: text("status").notNull(),
    subscriptionNo: text("subscription_no"),
    transactionNo: text("transaction_no").unique().notNull(),
    transactionScene: text("transaction_scene"),
    transactionType: text("transaction_type").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    userEmail: text("user_email"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_credit_consume_fifo").on(
      t.userId,
      t.status,
      t.transactionType,
      t.remainingCredits,
      t.expiresAt,
    ),
    index("idx_credit_order_no").on(t.orderNo),
    index("idx_credit_subscription_no").on(t.subscriptionNo),
  ],
);

export const apikey = table(
  "apikey",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sqliteNowMs).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    id: text("id").primaryKey(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    status: text("status").notNull(),
    title: text("title").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_apikey_user_status").on(t.userId, t.status),
    index("idx_apikey_keyhash_status").on(t.keyHash, t.status),
  ],
);

// ─── RBAC ────────────────────────────────────────────────────────────────────

export const role = table(
  "role",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sqliteNowMs).notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    sort: integer("sort").default(0).notNull(),
    status: text("status").notNull(),
    title: text("title").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("idx_role_status").on(t.status)],
);

export const permission = table(
  "permission",
  {
    action: text("action").notNull(),
    code: text("code").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sqliteNowMs).notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    resource: text("resource").notNull(),
    title: text("title").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("idx_permission_resource_action").on(t.resource, t.action)],
);

export const rolePermission = table(
  "role_permission",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sqliteNowMs).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    id: text("id").primaryKey(),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permission.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("idx_role_permission_role_permission").on(t.roleId, t.permissionId)],
);

export const userRole = table(
  "user_role",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sqliteNowMs).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    id: text("id").primaryKey(),
    roleId: text("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_user_role_user_expires").on(t.userId, t.expiresAt),
    uniqueIndex("uq_user_role_user_role").on(t.userId, t.roleId),
  ],
);

// ─── AI ──────────────────────────────────────────────────────────────────────

export const aiTask = table(
  "ai_task",
  {
    costCredits: integer("cost_credits").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sqliteNowMs).notNull(),
    creditId: text("credit_id"),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    id: text("id").primaryKey(),
    mediaType: text("media_type").notNull(),
    model: text("model").notNull(),
    options: text("options"),
    prompt: text("prompt").notNull(),
    provider: text("provider").notNull(),
    scene: text("scene").notNull().default(""),
    status: text("status").notNull(),
    taskId: text("task_id"),
    taskInfo: text("task_info"),
    taskResult: text("task_result"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_ai_task_user_media_type").on(t.userId, t.mediaType),
    index("idx_ai_task_media_type_status").on(t.mediaType, t.status),
  ],
);

export const chat = table(
  "chat",
  {
    content: text("content"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sqliteNowMs).notNull(),
    id: text("id").primaryKey(),
    metadata: text("metadata"),
    model: text("model").notNull(),
    parts: text("parts").notNull(),
    provider: text("provider").notNull(),
    status: text("status").notNull(),
    title: text("title").notNull().default(""),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("idx_chat_user_status").on(t.userId, t.status)],
);

export const chatMessage = table(
  "chat_message",
  {
    chatId: text("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(sqliteNowMs).notNull(),
    id: text("id").primaryKey(),
    metadata: text("metadata"),
    model: text("model").notNull(),
    parts: text("parts").notNull(),
    provider: text("provider").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_chat_message_chat_id").on(t.chatId, t.status),
    index("idx_chat_message_user_id").on(t.userId, t.status),
  ],
);

// ─── Tickets (support) ─────────────────────────────────────────────────────────

export const ticket = table(
  "ticket",
  {
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    id: text("id").primaryKey(),
    status: text("status").notNull().default("open"),
    title: text("title").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
  },
  (t) => [index("idx_ticket_user").on(t.userId), index("idx_ticket_status").on(t.status)],
);

export const ticketMessage = table(
  "ticket_message",
  {
    attachments: text("attachments").notNull().default("[]"),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    id: text("id").primaryKey(),
    role: text("role").notNull().default("user"),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => ticket.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
  },
  (t) => [index("idx_ticket_message_ticket").on(t.ticketId)],
);

// ─── Invite Codes ──────────────────────────────────────────────────────────────

export const inviteCode = table(
  "invite_code",
  {
    code: text("code").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    createdBy: text("created_by").references(() => user.id),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    id: text("id").primaryKey(),
    maxUses: integer("max_uses").notNull().default(1),
    note: text("note").default(""),
    trialDays: integer("trial_days").notNull().default(15),
    usedCount: integer("used_count").notNull().default(0),
  },
  (t) => [index("idx_invite_code_code").on(t.code)],
);

export const userInvite = table(
  "user_invite",
  {
    activatedAt: integer("activated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    id: text("id").primaryKey(),
    inviteCodeId: text("invite_code_id")
      .notNull()
      .references(() => inviteCode.id),
    trialEndsAt: integer("trial_ends_at", { mode: "timestamp" }).notNull(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id),
  },
  (t) => [
    index("idx_user_invite_user").on(t.userId),
    index("idx_user_invite_code").on(t.inviteCodeId),
  ],
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
