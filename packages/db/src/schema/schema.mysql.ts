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
  varchar,
} from "drizzle-orm/mysql-core";

const table = mysqlTable;

const varchar255 = (name: string) => varchar(name, { length: 255 });

// ─── Auth ────────────────────────────────────────────────────────────────────

export const user = table(
  "user",
  {
    id: varchar255("id").primaryKey(),
    name: varchar255("name").notNull(),
    email: varchar255("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    utmSource: varchar("utm_source", { length: 100 }).notNull().default(""),
    ip: varchar("ip", { length: 45 }).notNull().default(""),
    locale: varchar("locale", { length: 20 }).notNull().default(""),
  },
  (t) => [
    index("idx_user_name").on(t.name),
    index("idx_user_created_at").on(t.createdAt),
  ]
);

export const session = table(
  "session",
  {
    id: varchar255("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: varchar255("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
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
    id: varchar255("id").primaryKey(),
    accountId: varchar255("account_id").notNull(),
    providerId: varchar("provider_id", { length: 50 }).notNull(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: varchar("scope", { length: 255 }),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_account_user_id").on(t.userId),
    index("idx_account_provider_account").on(t.providerId, t.accountId),
  ]
);

export const verification = table(
  "verification",
  {
    id: varchar255("id").primaryKey(),
    identifier: varchar255("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_verification_identifier").on(t.identifier)]
);

// ─── Content ─────────────────────────────────────────────────────────────────

export const config = table("config", {
  name: varchar255("name").unique().notNull(),
  value: text("value"),
});

export const taxonomy = table(
  "taxonomy",
  {
    id: varchar255("id").primaryKey(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    parentId: varchar255("parent_id"),
    slug: varchar255("slug").unique().notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    image: text("image"),
    icon: varchar255("icon"),
    status: varchar("status", { length: 50 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    sort: int("sort").default(0).notNull(),
  },
  (t) => [index("idx_taxonomy_type_status").on(t.type, t.status)]
);

export const post = table(
  "post",
  {
    id: varchar255("id").primaryKey(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    parentId: varchar255("parent_id"),
    slug: varchar255("slug").unique().notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }),
    description: text("description"),
    image: text("image"),
    content: longtext("content"),
    categories: text("categories"),
    tags: text("tags"),
    authorName: varchar255("author_name"),
    authorImage: text("author_image"),
    status: varchar("status", { length: 50 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    sort: int("sort").default(0).notNull(),
  },
  (t) => [index("idx_post_type_status").on(t.type, t.status)]
);

// ─── Business ────────────────────────────────────────────────────────────────

export const order = table(
  "order",
  {
    id: varchar255("id").primaryKey(),
    orderNo: varchar255("order_no").unique().notNull(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userEmail: varchar255("user_email"),
    status: varchar("status", { length: 50 }).notNull(),
    amount: int("amount").notNull(),
    currency: varchar("currency", { length: 10 }).notNull(),
    productId: varchar255("product_id"),
    paymentType: varchar("payment_type", { length: 50 }),
    paymentInterval: varchar("payment_interval", { length: 50 }),
    paymentProvider: varchar("payment_provider", { length: 50 }).notNull(),
    paymentSessionId: varchar255("payment_session_id"),
    checkoutInfo: text("checkout_info").notNull(),
    checkoutResult: text("checkout_result"),
    paymentResult: text("payment_result"),
    discountCode: varchar255("discount_code"),
    discountAmount: int("discount_amount"),
    discountCurrency: varchar("discount_currency", { length: 10 }),
    paymentEmail: varchar255("payment_email"),
    paymentAmount: int("payment_amount"),
    paymentCurrency: varchar("payment_currency", { length: 10 }),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    description: text("description"),
    productName: varchar("product_name", { length: 255 }),
    subscriptionId: varchar255("subscription_id"),
    subscriptionResult: text("subscription_result"),
    checkoutUrl: text("checkout_url"),
    callbackUrl: text("callback_url"),
    creditsAmount: int("credits_amount"),
    creditsValidDays: int("credits_valid_days"),
    planName: varchar255("plan_name"),
    paymentProductId: varchar255("payment_product_id"),
    invoiceId: varchar255("invoice_id"),
    invoiceUrl: text("invoice_url"),
    subscriptionNo: varchar255("subscription_no"),
    transactionId: varchar255("transaction_id"),
    paymentUserName: varchar255("payment_user_name"),
    paymentUserId: varchar255("payment_user_id"),
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
    id: varchar255("id").primaryKey(),
    subscriptionNo: varchar255("subscription_no").unique().notNull(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userEmail: varchar255("user_email"),
    status: varchar("status", { length: 50 }).notNull(),
    paymentProvider: varchar("payment_provider", { length: 50 }).notNull(),
    subscriptionId: varchar255("subscription_id").notNull(),
    subscriptionResult: text("subscription_result"),
    productId: varchar255("product_id"),
    description: text("description"),
    amount: int("amount"),
    currency: varchar("currency", { length: 10 }),
    interval: varchar("interval", { length: 50 }),
    intervalCount: int("interval_count"),
    trialPeriodDays: int("trial_period_days"),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    planName: varchar255("plan_name"),
    billingUrl: text("billing_url"),
    productName: varchar("product_name", { length: 255 }),
    creditsAmount: int("credits_amount"),
    creditsValidDays: int("credits_valid_days"),
    paymentProductId: varchar255("payment_product_id"),
    paymentUserId: varchar255("payment_user_id"),
    canceledAt: timestamp("canceled_at"),
    canceledEndAt: timestamp("canceled_end_at"),
    canceledReason: text("canceled_reason"),
    canceledReasonType: varchar("canceled_reason_type", { length: 50 }),
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
    id: varchar255("id").primaryKey(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userEmail: varchar255("user_email"),
    orderNo: varchar255("order_no"),
    subscriptionNo: varchar255("subscription_no"),
    transactionNo: varchar255("transaction_no").unique().notNull(),
    transactionType: varchar("transaction_type", { length: 50 }).notNull(),
    transactionScene: varchar("transaction_scene", { length: 50 }),
    credits: int("credits").notNull(),
    remainingCredits: int("remaining_credits").notNull().default(0),
    description: text("description"),
    expiresAt: timestamp("expires_at"),
    status: varchar("status", { length: 50 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    consumedDetail: text("consumed_detail"),
    metadata: text("metadata"),
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
    id: varchar255("id").primaryKey(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    keyHash: varchar255("key_hash").notNull(),
    keyPrefix: varchar255("key_prefix").notNull(),
    title: varchar255("title").notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deleted_at"),
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
    id: varchar255("id").primaryKey(),
    name: varchar255("name").notNull().unique(),
    title: varchar255("title").notNull(),
    description: text("description"),
    status: varchar("status", { length: 50 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    sort: int("sort").default(0).notNull(),
  },
  (t) => [index("idx_role_status").on(t.status)]
);

export const permission = table(
  "permission",
  {
    id: varchar255("id").primaryKey(),
    code: varchar255("code").notNull().unique(),
    resource: varchar("resource", { length: 50 }).notNull(),
    action: varchar("action", { length: 50 }).notNull(),
    title: varchar255("title").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_permission_resource_action").on(t.resource, t.action)]
);

export const rolePermission = table(
  "role_permission",
  {
    id: varchar255("id").primaryKey(),
    roleId: varchar255("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    permissionId: varchar255("permission_id")
      .notNull()
      .references(() => permission.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("idx_role_permission_role_permission").on(t.roleId, t.permissionId),
  ]
);

export const userRole = table(
  "user_role",
  {
    id: varchar255("id").primaryKey(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleId: varchar255("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    expiresAt: timestamp("expires_at"),
  },
  (t) => [index("idx_user_role_user_expires").on(t.userId, t.expiresAt)]
);

// ─── AI ──────────────────────────────────────────────────────────────────────

export const aiTask = table(
  "ai_task",
  {
    id: varchar255("id").primaryKey(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mediaType: varchar("media_type", { length: 50 }).notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
    model: varchar255("model").notNull(),
    prompt: longtext("prompt").notNull(),
    options: longtext("options"),
    status: varchar("status", { length: 50 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    taskId: varchar255("task_id"),
    taskInfo: longtext("task_info"),
    taskResult: longtext("task_result"),
    costCredits: int("cost_credits").notNull().default(0),
    scene: varchar("scene", { length: 100 }).notNull().default(""),
    creditId: varchar255("credit_id"),
  },
  (t) => [
    index("idx_ai_task_user_media_type").on(t.userId, t.mediaType),
    index("idx_ai_task_media_type_status").on(t.mediaType, t.status),
  ]
);

export const chat = table(
  "chat",
  {
    id: varchar255("id").primaryKey(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 50 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    model: varchar255("model").notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }).notNull().default(""),
    parts: longtext("parts").notNull(),
    metadata: longtext("metadata"),
    content: longtext("content"),
  },
  (t) => [index("idx_chat_user_status").on(t.userId, t.status)]
);

export const chatMessage = table(
  "chat_message",
  {
    id: varchar255("id").primaryKey(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chatId: varchar255("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 50 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
    role: varchar("role", { length: 50 }).notNull(),
    parts: longtext("parts").notNull(),
    metadata: longtext("metadata"),
    model: varchar255("model").notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
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
    id: varchar255("id").primaryKey(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id),
    title: varchar("title", { length: 255 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("open"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_ticket_user").on(t.userId),
    index("idx_ticket_status").on(t.status),
  ]
);

export const ticketMessage = table(
  "ticket_message",
  {
    id: varchar255("id").primaryKey(),
    ticketId: varchar255("ticket_id")
      .notNull()
      .references(() => ticket.id),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id),
    role: varchar("role", { length: 50 }).notNull().default("user"),
    content: longtext("content").notNull(),
    attachments: longtext("attachments").notNull().default("[]"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_ticket_message_ticket").on(t.ticketId)]
);

// ─── Invite Codes ──────────────────────────────────────────────────────────────

export const inviteCode = table(
  "invite_code",
  {
    id: varchar255("id").primaryKey(),
    code: varchar255("code").notNull().unique(),
    maxUses: int("max_uses").notNull().default(1),
    usedCount: int("used_count").notNull().default(0),
    trialDays: int("trial_days").notNull().default(15),
    note: text("note").default(""),
    createdBy: varchar255("created_by").references(() => user.id),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_invite_code_code").on(t.code)]
);

export const userInvite = table(
  "user_invite",
  {
    id: varchar255("id").primaryKey(),
    userId: varchar255("user_id")
      .notNull()
      .references(() => user.id),
    inviteCodeId: varchar255("invite_code_id")
      .notNull()
      .references(() => inviteCode.id),
    activatedAt: timestamp("activated_at").defaultNow().notNull(),
    trialEndsAt: timestamp("trial_ends_at").notNull(),
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
