/**
 * PostgreSQL dialect schema definitions.
 *
 * Active when DATABASE_PROVIDER is `postgres`.
 * Exports the same symbol names and `$inferSelect` / `$inferInsert` types as
 * the `schema.sqlite` and `schema.mysql` dialects so callers and drizzle-kit
 * remain dialect-agnostic.
 *
 * Composite / secondary performance indexes (e.g. the credit FIFO index
 * `idx_credit_consume_fifo`) are declared per table via the table callback and
 * kept equivalent across all three dialects (same index names, same column
 * order). Column-level `.unique()` constraints are part of the data model.
 */

import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const table = pgTable;

// ─── Auth ────────────────────────────────────────────────────────────────────

export const user = table(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    utmSource: text("utm_source").notNull().default(""),
    ip: text("ip").notNull().default(""),
    locale: text("locale").notNull().default(""),
  },
  (t) => [
    index("idx_user_name").on(t.name),
    index("idx_user_created_at").on(t.createdAt),
  ]
);

export const session = table(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("idx_session_user_expires").on(t.userId, t.expiresAt)]
);

export const account = table(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("idx_account_user_id").on(t.userId),
    index("idx_account_provider_account").on(t.providerId, t.accountId),
  ]
);

export const verification = table(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("idx_verification_identifier").on(t.identifier)]
);

// ─── Content ─────────────────────────────────────────────────────────────────

export const config = table("config", {
  name: text("name").unique().notNull(),
  value: text("value"),
});

export const taxonomy = table(
  "taxonomy",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    slug: text("slug").unique().notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    image: text("image"),
    icon: text("icon"),
    status: text("status").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
    sort: integer("sort").default(0).notNull(),
  },
  (t) => [index("idx_taxonomy_type_status").on(t.type, t.status)]
);

export const post = table(
  "post",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    slug: text("slug").unique().notNull(),
    type: text("type").notNull(),
    title: text("title"),
    description: text("description"),
    image: text("image"),
    content: text("content"),
    categories: text("categories"),
    tags: text("tags"),
    authorName: text("author_name"),
    authorImage: text("author_image"),
    status: text("status").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
    sort: integer("sort").default(0).notNull(),
  },
  (t) => [index("idx_post_type_status").on(t.type, t.status)]
);

// ─── Business ────────────────────────────────────────────────────────────────

export const order = table(
  "order",
  {
    id: text("id").primaryKey(),
    orderNo: text("order_no").unique().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userEmail: text("user_email"),
    status: text("status").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    productId: text("product_id"),
    paymentType: text("payment_type"),
    paymentInterval: text("payment_interval"),
    paymentProvider: text("payment_provider").notNull(),
    paymentSessionId: text("payment_session_id"),
    checkoutInfo: text("checkout_info").notNull(),
    checkoutResult: text("checkout_result"),
    paymentResult: text("payment_result"),
    discountCode: text("discount_code"),
    discountAmount: integer("discount_amount"),
    discountCurrency: text("discount_currency"),
    paymentEmail: text("payment_email"),
    paymentAmount: integer("payment_amount"),
    paymentCurrency: text("payment_currency"),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
    description: text("description"),
    productName: text("product_name"),
    subscriptionId: text("subscription_id"),
    subscriptionResult: text("subscription_result"),
    checkoutUrl: text("checkout_url"),
    callbackUrl: text("callback_url"),
    creditsAmount: integer("credits_amount"),
    creditsValidDays: integer("credits_valid_days"),
    planName: text("plan_name"),
    paymentProductId: text("payment_product_id"),
    invoiceId: text("invoice_id"),
    invoiceUrl: text("invoice_url"),
    subscriptionNo: text("subscription_no"),
    transactionId: text("transaction_id"),
    paymentUserName: text("payment_user_name"),
    paymentUserId: text("payment_user_id"),
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
    id: text("id").primaryKey(),
    subscriptionNo: text("subscription_no").unique().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userEmail: text("user_email"),
    status: text("status").notNull(),
    paymentProvider: text("payment_provider").notNull(),
    subscriptionId: text("subscription_id").notNull(),
    subscriptionResult: text("subscription_result"),
    productId: text("product_id"),
    description: text("description"),
    amount: integer("amount"),
    currency: text("currency"),
    interval: text("interval"),
    intervalCount: integer("interval_count"),
    trialPeriodDays: integer("trial_period_days"),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
    planName: text("plan_name"),
    billingUrl: text("billing_url"),
    productName: text("product_name"),
    creditsAmount: integer("credits_amount"),
    creditsValidDays: integer("credits_valid_days"),
    paymentProductId: text("payment_product_id"),
    paymentUserId: text("payment_user_id"),
    canceledAt: timestamp("canceled_at"),
    canceledEndAt: timestamp("canceled_end_at"),
    canceledReason: text("canceled_reason"),
    canceledReasonType: text("canceled_reason_type"),
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
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userEmail: text("user_email"),
    orderNo: text("order_no"),
    subscriptionNo: text("subscription_no"),
    transactionNo: text("transaction_no").unique().notNull(),
    transactionType: text("transaction_type").notNull(),
    transactionScene: text("transaction_scene"),
    credits: integer("credits").notNull(),
    remainingCredits: integer("remaining_credits").notNull().default(0),
    description: text("description"),
    expiresAt: timestamp("expires_at"),
    status: text("status").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
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
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
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
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    sort: integer("sort").default(0).notNull(),
  },
  (t) => [index("idx_role_status").on(t.status)]
);

export const permission = table(
  "permission",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    resource: text("resource").notNull(),
    action: text("action").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("idx_permission_resource_action").on(t.resource, t.action)]
);

export const rolePermission = table(
  "role_permission",
  {
    id: text("id").primaryKey(),
    roleId: text("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permission.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("idx_role_permission_role_permission").on(t.roleId, t.permissionId),
  ]
);

export const userRole = table(
  "user_role",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    expiresAt: timestamp("expires_at"),
  },
  (t) => [index("idx_user_role_user_expires").on(t.userId, t.expiresAt)]
);

// ─── AI ──────────────────────────────────────────────────────────────────────

export const aiTask = table(
  "ai_task",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mediaType: text("media_type").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    prompt: text("prompt").notNull(),
    options: text("options"),
    status: text("status").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
    taskId: text("task_id"),
    taskInfo: text("task_info"),
    taskResult: text("task_result"),
    costCredits: integer("cost_credits").notNull().default(0),
    scene: text("scene").notNull().default(""),
    creditId: text("credit_id"),
  },
  (t) => [
    index("idx_ai_task_user_media_type").on(t.userId, t.mediaType),
    index("idx_ai_task_media_type_status").on(t.mediaType, t.status),
  ]
);

export const chat = table(
  "chat",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    model: text("model").notNull(),
    provider: text("provider").notNull(),
    title: text("title").notNull().default(""),
    parts: text("parts").notNull(),
    metadata: text("metadata"),
    content: text("content"),
  },
  (t) => [index("idx_chat_user_status").on(t.userId, t.status)]
);

export const chatMessage = table(
  "chat_message",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chatId: text("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    role: text("role").notNull(),
    parts: text("parts").notNull(),
    metadata: text("metadata"),
    model: text("model").notNull(),
    provider: text("provider").notNull(),
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
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    title: text("title").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_ticket_user").on(t.userId),
    index("idx_ticket_status").on(t.status),
  ]
);

export const ticketMessage = table(
  "ticket_message",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => ticket.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    role: text("role").notNull().default("user"),
    content: text("content").notNull(),
    attachments: text("attachments").notNull().default("[]"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_ticket_message_ticket").on(t.ticketId)]
);

// ─── Invite Codes ──────────────────────────────────────────────────────────────

export const inviteCode = table(
  "invite_code",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    maxUses: integer("max_uses").notNull().default(1),
    usedCount: integer("used_count").notNull().default(0),
    trialDays: integer("trial_days").notNull().default(15),
    note: text("note").default(""),
    createdBy: text("created_by").references(() => user.id),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_invite_code_code").on(t.code)]
);

export const userInvite = table(
  "user_invite",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    inviteCodeId: text("invite_code_id")
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
