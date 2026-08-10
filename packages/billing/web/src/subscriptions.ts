// @openstarter/billing-web/subscriptions 子域（对齐 ShipAny `modules/subscriptions`）。
//
// 订阅生命周期管理（R11）。业务侧只依赖此处的服务函数与 `./payment/types` 的
// 归一化 `SubscriptionStatus`，数据访问统一走 `@openstarter/db`。续费周期的积分
// 授予复用同包 `./credits` 的 `grant` + `calculateCreditExpirationTime`（不跨到
// api/auth，保持依赖分层无环）。
//
// 任务 17.1：订阅生命周期核心方法
//   - `createSubscription`：支付渠道确认订阅创建后落库订阅记录（含计费周期与套餐）。
//   - `updateBySubscriptionNo` / `findBySubscriptionNo` / `findByProviderSubscriptionId`
//     / `getCurrentSubscription`。
// 任务 17.2：取消与续费周期积分授予
//   - `cancelSubscription`：记录 `canceledAt`/`canceledEndAt` 与反映取消的 `status`。
//   - `renewSubscription`：进入新计费周期并完成扣款后，更新计费周期起止时间，并
//     触发该周期对应的积分授予（复用 `./credits`）。
// 任务 17.3：settings 订阅状态展示数据接口
//   - `getSubscriptionStatusView`：返回当前订阅状态、套餐名称与下一计费日期，供
//     settings 面板经 RPC 消费（此处仅 billing 服务函数，不新增 api 路由）。

import {
  type NewCredit,
  type NewSubscription,
  type Subscription,
  subscription,
} from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { getSnowId, getUuid } from "@openstarter/shared/id";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  type BillingTransaction,
  calculateCreditExpirationTime,
  CreditTransactionScene,
  grant,
} from "./credits";
import { SubscriptionStatus } from "./payment/types";

// ─── 通用类型（Types） ────────────────────────────────────────────────────────

/**
 * 订阅更新载荷：允许更新除主键 / 订阅号 / 创建时间外的任意字段。
 * （`id`/`subscriptionNo`/`createdAt` 为不可变标识，排除以防误改。）
 */
export type UpdateSubscription = Partial<
  Omit<NewSubscription, "id" | "subscriptionNo" | "createdAt">
>;

// 归属「当前订阅」的状态集合：活跃 / 待取消（仍在计费周期内）/ 试用中。
const CURRENT_SUBSCRIPTION_STATUSES = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PENDING_CANCEL,
  SubscriptionStatus.TRIALING,
] as const;

const DEFAULT_SUBSCRIPTION_DESCRIPTION = "Subscription Created";
const RENEWAL_CREDIT_DESCRIPTION = "Grant credit";

// ─── 创建（Create，17.1 / R11.1） ────────────────────────────────────────────

/**
 * `createSubscription` 入参：计费周期起止时间必填（R11.1 要求写入计费周期），
 * 套餐 / 金额 / 渠道等信息随归一化 `SubscriptionInfo` 提供。
 */
export type CreateSubscriptionParams = {
  userId: string;
  paymentProvider: string;
  subscriptionId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  status?: SubscriptionStatus;
  userEmail?: string;
  subscriptionNo?: string;
  subscriptionResult?: string;
  productId?: string;
  productName?: string;
  planName?: string;
  description?: string;
  amount?: number;
  currency?: string;
  interval?: string;
  intervalCount?: number;
  trialPeriodDays?: number;
  billingUrl?: string;
  creditsAmount?: number;
  creditsValidDays?: number;
  paymentProductId?: string;
  paymentUserId?: string;
  /**
   * 可选注入的事务句柄；提供时在该事务内写入，否则直接经 `db()` 写入。
   * 供 Webhook 成功编排（18.2）在「建订阅 + 授积分 + 置订单 paid」的同一事务内建订阅。
   */
  tx?: BillingTransaction;
};

/**
 * 创建订阅记录（R11.1）：支付渠道确认订阅创建成功后调用，写入**计费周期起止时间**
 * （`currentPeriodStart`/`currentPeriodEnd`）与所选**套餐信息**（`planName`/`productName`/
 * 金额 / 周期等）。
 *
 * 生成 `id` 与 `subscriptionNo`（可由 `params.subscriptionNo` 覆盖），落库后返回所构建
 * 的记录（含生成的 `subscriptionNo`，便于成功编排 —— 任务 18.2 —— 回填订单 / 积分）。
 * 状态默认 `active`。仿照同包 `credits.grant` 的返回约定（返回构建对象），跨方言一致
 * （不依赖 MySQL 无 `.returning()`）。提供 `tx` 时在该事务内写入（供成功编排的单事务
 * 原子性），否则直接经 `db()` 写入；不传 `tx` 时与既有调用完全向后兼容。
 */
export async function createSubscription(
  params: CreateSubscriptionParams
): Promise<NewSubscription> {
  const record: NewSubscription = {
    id: getUuid(),
    subscriptionNo: params.subscriptionNo ?? getSnowId(),
    userId: params.userId,
    userEmail: params.userEmail ?? "",
    status: params.status ?? SubscriptionStatus.ACTIVE,
    paymentProvider: params.paymentProvider,
    subscriptionId: params.subscriptionId,
    subscriptionResult: params.subscriptionResult ?? null,
    productId: params.productId ?? null,
    description: params.description ?? DEFAULT_SUBSCRIPTION_DESCRIPTION,
    amount: params.amount ?? null,
    currency: params.currency ?? null,
    interval: params.interval ?? null,
    intervalCount: params.intervalCount ?? null,
    trialPeriodDays: params.trialPeriodDays ?? null,
    currentPeriodStart: params.currentPeriodStart,
    currentPeriodEnd: params.currentPeriodEnd,
    planName: params.planName ?? null,
    billingUrl: params.billingUrl ?? null,
    productName: params.productName ?? null,
    creditsAmount: params.creditsAmount ?? null,
    creditsValidDays: params.creditsValidDays ?? null,
    paymentProductId: params.paymentProductId ?? null,
    paymentUserId: params.paymentUserId ?? null,
  };

  if (params.tx) {
    await params.tx.insert(subscription).values(record);
  } else {
    await db().insert(subscription).values(record);
  }
  return record;
}

// ─── 查询（Read，17.1） ───────────────────────────────────────────────────────

/** 按订阅号查询单条订阅记录。 */
export async function findBySubscriptionNo(
  subscriptionNo: string
): Promise<Subscription | undefined> {
  const [result] = await db()
    .select()
    .from(subscription)
    .where(eq(subscription.subscriptionNo, subscriptionNo));
  return result;
}

/**
 * 按「渠道 + 渠道订阅 id」查询订阅（R11.2/R11.3 编排定位既有订阅用）。
 * 供续费 / 更新 / 取消等 Webhook 事件（任务 18）依渠道回传的 `subscriptionId` 命中本地记录。
 */
export async function findByProviderSubscriptionId(params: {
  provider: string;
  subscriptionId: string;
}): Promise<Subscription | undefined> {
  const [result] = await db()
    .select()
    .from(subscription)
    .where(
      and(
        eq(subscription.paymentProvider, params.provider),
        eq(subscription.subscriptionId, params.subscriptionId)
      )
    );
  return result;
}

/**
 * 取用户「当前订阅」：状态属于 {@link CURRENT_SUBSCRIPTION_STATUSES}
 * （`active`/`pending_cancel`/`trialing`）中最新创建的一条；无则返回 `undefined`。
 * 供 settings 展示（R11.4）与方案状态判定（R11.5 的 `member`）复用。
 */
export async function getCurrentSubscription(
  userId: string
): Promise<Subscription | undefined> {
  const [result] = await db()
    .select()
    .from(subscription)
    .where(
      and(
        eq(subscription.userId, userId),
        inArray(subscription.status, [...CURRENT_SUBSCRIPTION_STATUSES])
      )
    )
    .orderBy(desc(subscription.createdAt))
    .limit(1);
  return result;
}

// ─── 更新（Update，17.1） ─────────────────────────────────────────────────────

/**
 * 按订阅号更新订阅并返回更新后的完整记录（不存在则返回 `undefined`）。
 *
 * 先执行 `update`、再按订阅号 `select` 回读，避免依赖 MySQL 缺失的 `.returning()`，
 * 保证三方言返回结构一致。取消 / 续费 / 状态变更等均复用此方法。
 */
export async function updateBySubscriptionNo(
  subscriptionNo: string,
  data: UpdateSubscription
): Promise<Subscription | undefined> {
  await db()
    .update(subscription)
    .set(data)
    .where(eq(subscription.subscriptionNo, subscriptionNo));
  return findBySubscriptionNo(subscriptionNo);
}

// ─── 取消（Cancel，17.2 / R11.3） ────────────────────────────────────────────

/**
 * `cancelSubscription` 入参：`canceledEndAt` 为取消**生效时间**（如周期结束时刻）。
 * `status` 默认 `canceled`（立即取消）；「周期末取消」可传 `pending_cancel` 并将
 * `canceledEndAt` 设为当前周期结束时间。
 */
export type CancelSubscriptionParams = {
  subscriptionNo: string;
  canceledAt?: Date;
  canceledEndAt?: Date | null;
  status?: SubscriptionStatus;
  canceledReason?: string;
  canceledReasonType?: string;
};

/**
 * 取消订阅（R11.3）：记录**取消时间**（`canceledAt`，默认当前时刻）与**取消生效时间**
 * （`canceledEndAt`），并将 `status` 更新为**反映取消的状态**（默认 `canceled`；周期末
 * 取消可传 `pending_cancel`）。返回更新后的订阅记录。
 */
export function cancelSubscription(
  params: CancelSubscriptionParams
): Promise<Subscription | undefined> {
  return updateBySubscriptionNo(params.subscriptionNo, {
    status: params.status ?? SubscriptionStatus.CANCELED,
    canceledAt: params.canceledAt ?? new Date(),
    canceledEndAt: params.canceledEndAt ?? null,
    canceledReason: params.canceledReason ?? null,
    canceledReasonType: params.canceledReasonType ?? null,
  });
}

// ─── 续费与周期积分授予（Renew，17.2 / R11.2） ───────────────────────────────

/**
 * `renewSubscription` 入参：新计费周期的起止时间必填；积分相关字段一般取自订阅记录
 * （`creditsAmount`/`creditsValidDays`），用于为本周期授予积分。
 */
export type RenewSubscriptionParams = {
  subscriptionNo: string;
  userId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  userEmail?: string;
  creditsAmount?: number | null;
  creditsValidDays?: number | null;
};

/** `renewSubscription` 返回：更新后的订阅与（如授予了）本周期的积分流水。 */
export type RenewSubscriptionResult = {
  subscription: Subscription | undefined;
  grantedCredit?: NewCredit;
};

/**
 * 续费进入新计费周期（R11.2）：调用方确认「进入新周期且已完成扣款」后调用。
 *
 * 1. 更新计费周期起止时间（`currentPeriodStart`/`currentPeriodEnd`）。
 * 2. 触发**该周期对应的积分授予**：复用同包 `./credits` 的 {@link grant} 与
 *    {@link calculateCreditExpirationTime}——到期时间随订阅周期结束（`creditsValidDays>0`
 *    且给定 `currentPeriodEnd` 时到期于周期末；`creditsValidDays<=0` 则永不过期），
 *    场景标记为 `renewal` 并回填 `subscriptionNo`。`creditsAmount<=0` 或缺省时不授予。
 *
 * 该方法即为「续费授予」的复用单元，供任务 18.2 的 Webhook 成功编排调用（其自身负责
 * 按 `(transactionId, provider)` 去重，避免重复投递导致重复授予）。
 */
export async function renewSubscription(
  params: RenewSubscriptionParams
): Promise<RenewSubscriptionResult> {
  const updated = await updateBySubscriptionNo(params.subscriptionNo, {
    currentPeriodStart: params.currentPeriodStart,
    currentPeriodEnd: params.currentPeriodEnd,
  });

  const creditsAmount = params.creditsAmount ?? 0;
  if (creditsAmount <= 0) {
    return { subscription: updated };
  }

  const expiresAt = calculateCreditExpirationTime({
    creditsValidDays: params.creditsValidDays ?? 0,
    currentPeriodEnd: params.currentPeriodEnd,
  });

  const grantedCredit = await grant({
    userId: params.userId,
    userEmail: params.userEmail,
    credits: creditsAmount,
    scene: CreditTransactionScene.RENEWAL,
    subscriptionNo: params.subscriptionNo,
    description: RENEWAL_CREDIT_DESCRIPTION,
    expiresAt,
  });

  return { subscription: updated, grantedCredit };
}

// ─── settings 展示数据（Display，17.3 / R11.4） ──────────────────────────────

/**
 * settings 订阅状态展示视图（R11.4）。
 *
 * - `hasSubscription`：是否存在当前订阅。
 * - `status`：当前订阅状态（原始归一化字符串，如 `active`/`pending_cancel`/`trialing`）；
 *   无当前订阅时为 `null`。
 * - `planName`：套餐名称（优先 `planName`，回退 `productName`）；无则 `null`。
 * - `nextBillingDate`：下一计费日期（取当前计费周期结束 `currentPeriodEnd`）；无则 `null`。
 *   对 `pending_cancel` 等不会续费的状态，前端可结合 `status` 将其呈现为「访问截止日」。
 */
export type SubscriptionStatusView = {
  hasSubscription: boolean;
  status: string | null;
  planName: string | null;
  nextBillingDate: Date | null;
};

/**
 * 组装 settings 面板所需的订阅展示数据（R11.4）：当前订阅状态、套餐名称与下一计费日期。
 *
 * 仅为 billing 服务函数，供后续 settings 面板（任务 34）经 RPC 消费——本任务不新增 api 路由。
 * 复用 {@link getCurrentSubscription} 的「当前订阅」口径。
 */
export async function getSubscriptionStatusView(
  userId: string
): Promise<SubscriptionStatusView> {
  const current = await getCurrentSubscription(userId);

  if (!current) {
    return {
      hasSubscription: false,
      status: null,
      planName: null,
      nextBillingDate: null,
    };
  }

  return {
    hasSubscription: true,
    status: current.status,
    planName: current.planName ?? current.productName ?? null,
    nextBillingDate: current.currentPeriodEnd ?? null,
  };
}
