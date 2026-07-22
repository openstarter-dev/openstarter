// @openstarter/billing/credits 子域（对齐 ShipAny `modules/credits`）。
//
// 本文件按阶段 2 任务 14 增量填充。任务 14.1 提供：
//   - 积分领域词汇（状态 / 交易类型 / 交易场景，均以 `as const` + 联合类型表达，遵循 ultracite 不使用 enum）
//   - `calculateCreditExpirationTime`：到期时间计算（纯函数，无 I/O）
//   - `grant`：授予积分（写入一条 grant 类型流水）
//
// 任务 14.2 追加：`getBalance`（余额）、`consume`（FIFO 扣减，支持事务句柄注入）。
// 任务 14.3 追加：`revoke`（原子返还并软删）、`getHistory`（分页流水）。
// 任务 14.4 追加：`grantCreditsForNewUser`（受 Config 开关控制的新用户初始积分）。

import { credit, type Credit, type NewCredit } from "@openstarter/db/schema";
import { type Database, db } from "@openstarter/db/server";
import { getSnowId, getUuid } from "@openstarter/shared/id";
import { and, asc, desc, eq, gt, isNull, or, sql, sum } from "drizzle-orm";

// ─── 领域词汇（Domain vocabulary） ─────────────────────────────────────────────

/**
 * 积分流水状态。以 `as const` 对象 + 同名联合类型表达（遵循 ultracite：不使用 enum）。
 */
export const CreditStatus = {
  ACTIVE: "active",
  EXPIRED: "expired",
  DELETED: "deleted",
} as const;

export type CreditStatus = (typeof CreditStatus)[keyof typeof CreditStatus];

/**
 * 积分交易类型：授予（grant）与消费（consume）。
 */
export const CreditTransactionType = {
  GRANT: "grant",
  CONSUME: "consume",
} as const;

export type CreditTransactionType =
  (typeof CreditTransactionType)[keyof typeof CreditTransactionType];

/**
 * 积分交易场景，用于区分积分来源（支付 / 订阅 / 续费 / 赠送 / 奖励）。
 */
export const CreditTransactionScene = {
  PAYMENT: "payment",
  SUBSCRIPTION: "subscription",
  RENEWAL: "renewal",
  GIFT: "gift",
  REWARD: "reward",
} as const;

export type CreditTransactionScene =
  (typeof CreditTransactionScene)[keyof typeof CreditTransactionScene];

// ─── 到期时间计算（Expiration） ───────────────────────────────────────────────

/**
 * 计算某批授予积分的到期时间（纯函数，无 I/O；对应 R13.2）。
 *
 * 优先级：
 * 1. 有效天数未提供或 <= 0 → 永不过期（返回 `null`）。
 * 2. 提供了订阅周期结束时间（`currentPeriodEnd`）→ 到期时间随该订阅周期（返回其副本）。
 * 3. 否则 → 基准时间加上有效天数。
 *
 * `now` 可注入以保证纯函数的确定性（便于属性测试）；不传时回退到当前时刻。
 * 返回的 `Date` 均为新实例，不会与入参共享引用。
 */
export function calculateCreditExpirationTime(params: {
  creditsValidDays?: number;
  currentPeriodEnd?: Date | null;
  now?: Date;
}): Date | null {
  const { creditsValidDays, currentPeriodEnd, now } = params;

  if (!creditsValidDays || creditsValidDays <= 0) {
    return null;
  }

  if (currentPeriodEnd) {
    return new Date(currentPeriodEnd.getTime());
  }

  const expiresAt = now ? new Date(now.getTime()) : new Date();
  expiresAt.setDate(expiresAt.getDate() + creditsValidDays);
  return expiresAt;
}

// ─── 授予（Grant） ────────────────────────────────────────────────────────────

/**
 * `grant` 的入参。除 `userId` 与 `credits` 外均为可选，可选项集中放在末尾。
 */
export type GrantCreditsParams = {
  userId: string;
  credits: number;
  userEmail?: string;
  description?: string;
  orderNo?: string;
  subscriptionNo?: string;
  scene?: string;
  expiresAt?: Date | null;
  /**
   * 可选注入的事务句柄；提供时在该事务内写入，否则直接经 `db()` 写入。
   * 供 Webhook 成功编排（18.2）在「建订阅 + 授积分 + 置订单 paid」的同一事务内授予。
   */
  tx?: BillingTransaction;
};

/**
 * 授予积分：创建一条 `grant` 类型的积分流水（对应 R13.1）。
 *
 * 写入积分数（`credits`）、剩余积分（`remainingCredits` = 积分数）、状态（`active`）
 * 与到期时间（`expiresAt`，`null` 表示永不过期）。到期时间应由调用方经
 * {@link calculateCreditExpirationTime} 计算后传入。
 *
 * 提供 `tx` 时在该事务内写入（供成功编排的单事务原子性），否则直接经 `db()` 写入；
 * 二者行为一致，不传 `tx` 时与既有调用完全向后兼容。
 *
 * 返回落库所用的记录对象（含生成的 `id` 与 `transactionNo`）。
 */
export async function grant(params: GrantCreditsParams): Promise<NewCredit> {
  const newCredit: NewCredit = {
    id: getUuid(),
    userId: params.userId,
    userEmail: params.userEmail ?? "",
    transactionNo: getSnowId(),
    transactionType: CreditTransactionType.GRANT,
    transactionScene: params.scene ?? CreditTransactionScene.GIFT,
    credits: params.credits,
    remainingCredits: params.credits,
    status: CreditStatus.ACTIVE,
    description: params.description ?? "Grant credit",
    orderNo: params.orderNo ?? "",
    subscriptionNo: params.subscriptionNo ?? "",
    expiresAt: params.expiresAt ?? null,
  };

  if (params.tx) {
    await params.tx.insert(credit).values(newCredit);
  } else {
    await db().insert(credit).values(newCredit);
  }
  return newCredit;
}

// ─── 有效批次过滤（Valid grant conditions） ──────────────────────────────────

/**
 * 「可用批次」过滤条件（纯函数，返回 drizzle SQL 条件）：
 * `transactionType='grant'` 且 `status='active'` 且 `remainingCredits>0` 且未过期
 * （`expiresAt` 为 null 或 > now）。余额累计与 FIFO 取批共用同一口径（R13.3）。
 *
 * `now` 显式传入，使同一次消费的「余额核对」与「取批」使用一致的时间快照。
 */
function validGrantConditions(userId: string, now: Date) {
  return and(
    eq(credit.userId, userId),
    eq(credit.transactionType, CreditTransactionType.GRANT),
    eq(credit.status, CreditStatus.ACTIVE),
    gt(credit.remainingCredits, 0),
    or(isNull(credit.expiresAt), gt(credit.expiresAt, now))
  );
}

/** 将 SQL `SUM(...)` 的返回（`string | null`）归一为非负整数余额。 */
function toBalance(total: string | null | undefined): number {
  return total ? Number.parseInt(total, 10) : 0;
}

// ─── 余额（Balance，14.2 / R13.3） ───────────────────────────────────────────

/**
 * 计算用户可用余额：仅累计 `grant` 且 `active` 且 `remainingCredits>0` 且未过期
 * 批次的剩余积分之和（R13.3）。无有效批次时返回 0。
 */
export async function getBalance(userId: string): Promise<number> {
  const now = new Date();
  const [row] = await db()
    .select({ total: sum(credit.remainingCredits) })
    .from(credit)
    .where(validGrantConditions(userId, now));

  return toBalance(row?.total);
}

// ─── 消费与 FIFO 扣减（Consume，14.2 / R13.4、R13.5） ─────────────────────────

/**
 * 单批扣减明细：记录被扣减的批次 id 与扣减额。
 * 明细之和恒等于本次消费额（金额守恒），`revoke` 据此逐条返还（R13.4、R13.6）。
 */
export type ConsumedDetailItem = {
  creditId: string;
  amount: number;
};

/**
 * 事务句柄类型：从 `Database.transaction` 回调参数萃取，保证与 `db().transaction`
 * 注入的 `tx` 完全一致。供 AI 任务（27.1）与 Webhook 成功编排（18.2）在其自身事务内
 * 调用 `consume`/`grant`/`createSubscription({ tx })`，实现「单事务」原子性。
 */
export type BillingTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

export type ConsumeCreditsParams = {
  userId: string;
  credits: number;
  userEmail?: string;
  scene?: string;
  description?: string;
  metadata?: string;
  /** 可选注入的事务句柄；提供时在该事务内执行，否则自行开启事务。 */
  tx?: BillingTransaction;
};

export type ConsumeCreditsResult = {
  success: boolean;
  consumedCredit?: NewCredit;
};

/**
 * 在给定事务句柄内执行消费（余额核对 → FIFO 扣减 → 写 consume 流水）。
 *
 * - 余额 < 消费额 → 整体拒绝，`{ success: false }`，不修改任何记录（R13.5）。
 * - 余额充足 → 取全部有效批次按 `expiresAt ASC`（null 最后）从最早到期起先进先出扣减，
 *   每批新剩余额在 JS 侧依事务内读值算出，再对各不同批次以绝对值并行写回
 *   （互不影响、与顺序无关）；随后写入一条 `consume` 流水，其 `consumedDetail`
 *   持久化逐批扣减明细（金额守恒：Σamount == 消费额，R13.4）。
 */
async function consumeWithinTransaction(
  tx: BillingTransaction,
  params: ConsumeCreditsParams
): Promise<ConsumeCreditsResult> {
  const { userId, credits: amount } = params;
  const now = new Date();

  // 1. 事务内核对可用余额；不足则整体拒绝、不落任何变更（R13.5）。
  const [balanceRow] = await tx
    .select({ total: sum(credit.remainingCredits) })
    .from(credit)
    .where(validGrantConditions(userId, now));
  if (toBalance(balanceRow?.total) < amount) {
    return { success: false };
  }

  // 2. 取全部有效批次，按 `expiresAt ASC`（null 最后）排序：最早到期者优先（FIFO）。
  //    `case when expires_at is null then 1 else 0 end` 在三方言下等价，保证 null 排最后。
  const batches = await tx
    .select()
    .from(credit)
    .where(validGrantConditions(userId, now))
    .orderBy(
      sql`case when ${credit.expiresAt} is null then 1 else 0 end`,
      asc(credit.expiresAt)
    );

  // 3. 纯计算逐批扣减方案（无 I/O）：记录每批新剩余额与扣减额。
  let remaining = amount;
  const plan: { creditId: string; newRemaining: number; amount: number }[] = [];
  for (const batch of batches) {
    if (remaining <= 0) {
      break;
    }
    const take = Math.min(remaining, batch.remainingCredits);
    plan.push({
      creditId: batch.id,
      newRemaining: batch.remainingCredits - take,
      amount: take,
    });
    remaining -= take;
  }

  // 4. 对各不同批次并行写回绝对剩余额（distinct 行、绝对值 → 与顺序无关，事务内原子提交）。
  await Promise.all(
    plan.map((item) =>
      tx
        .update(credit)
        .set({ remainingCredits: item.newRemaining })
        .where(eq(credit.id, item.creditId))
    )
  );

  // 5. 写入一条 consume 流水，`consumedDetail` 保存逐批明细 `[{ creditId, amount }]`。
  const detail: ConsumedDetailItem[] = plan.map((item) => ({
    creditId: item.creditId,
    amount: item.amount,
  }));
  const consumedCredit: NewCredit = {
    id: getUuid(),
    userId,
    userEmail: params.userEmail ?? "",
    transactionNo: getSnowId(),
    transactionType: CreditTransactionType.CONSUME,
    transactionScene: params.scene ?? "",
    credits: -amount,
    remainingCredits: 0,
    status: CreditStatus.ACTIVE,
    description: params.description ?? "",
    consumedDetail: JSON.stringify(detail),
    metadata: params.metadata ?? "",
  };
  await tx.insert(credit).values(consumedCredit);

  return { success: true, consumedCredit };
}

/**
 * 消费积分（FIFO，R13.4、R13.5）。
 *
 * 若注入了事务句柄 `tx`（如 AI 任务在其自身事务内），则在该事务内执行；
 * 否则自行开启事务，保证「余额核对 + 逐批扣减 + 写流水」整体原子。
 */
export function consume(
  params: ConsumeCreditsParams
): Promise<ConsumeCreditsResult> {
  if (params.tx) {
    return consumeWithinTransaction(params.tx, params);
  }
  return db().transaction((tx) => consumeWithinTransaction(tx, params));
}

// ─── 撤销（Revoke，14.3 / R13.6） ─────────────────────────────────────────────

export type RevokeCreditsParams = {
  /** 目标 `consume` 流水的记录 id。 */
  consumeCreditId: string;
};

/**
 * 撤销一条消费记录（R13.6）。
 *
 * 依目标 `consume` 记录的 `consumedDetail` 逐条**原子自增**返还对应批次的
 * `remainingCredits`（`remaining = remaining + amount`，SQL 表达式避免读改写竞态），
 * 并将该 consume 记录置为 `status='deleted'`（软删）。全程在单个事务内完成，
 * 保证「返还总额 == 原扣减总额」。
 *
 * 目标记录不存在、非 `active` 的 `consume`、或无明细时为无操作（幂等）。
 */
export async function revoke(params: RevokeCreditsParams): Promise<void> {
  const { consumeCreditId } = params;

  const [record] = await db()
    .select()
    .from(credit)
    .where(
      and(
        eq(credit.id, consumeCreditId),
        eq(credit.transactionType, CreditTransactionType.CONSUME),
        eq(credit.status, CreditStatus.ACTIVE)
      )
    )
    .limit(1);

  if (!record?.consumedDetail) {
    return;
  }

  const items = JSON.parse(record.consumedDetail) as ConsumedDetailItem[];

  await db().transaction(async (tx) => {
    // 各批次互不影响，逐条原子自增可并行执行。
    await Promise.all(
      items.map((item) =>
        tx
          .update(credit)
          .set({
            remainingCredits: sql`${credit.remainingCredits} + ${item.amount}`,
          })
          .where(eq(credit.id, item.creditId))
      )
    );

    // 将该 consume 记录软删（status='deleted'），完成撤销。
    await tx
      .update(credit)
      .set({ status: CreditStatus.DELETED })
      .where(eq(credit.id, consumeCreditId));
  });
}

// ─── 历史查询（History，14.3） ────────────────────────────────────────────────

const DEFAULT_HISTORY_PAGE_SIZE = 50;

export type GetHistoryOptions = {
  limit?: number;
  offset?: number;
};

/**
 * 分页返回该用户的积分流水（grant 与 consume），按创建时间倒序。
 * 排除物理软删（`deletedAt` 非空）的记录。
 */
export function getHistory(
  userId: string,
  options?: GetHistoryOptions
): Promise<Credit[]> {
  const limit = options?.limit ?? DEFAULT_HISTORY_PAGE_SIZE;
  const offset = options?.offset ?? 0;

  return db()
    .select()
    .from(credit)
    .where(and(eq(credit.userId, userId), isNull(credit.deletedAt)))
    .orderBy(desc(credit.createdAt))
    .limit(limit)
    .offset(offset);
}

// ─── 新用户初始积分（Grant for new user，14.4 / R13.7） ───────────────────────

// 初始积分相关 Config 键（与 ShipAny `modules/credits` 对齐）。
const INITIAL_CREDITS_ENABLED_KEY = "initial_credits_enabled";
const INITIAL_CREDITS_AMOUNT_KEY = "initial_credits_amount";
const INITIAL_CREDITS_VALID_DAYS_KEY = "initial_credits_valid_days";
const INITIAL_CREDITS_DESCRIPTION_KEY = "initial_credits_description";
const DEFAULT_INITIAL_CREDITS_DESCRIPTION = "Initial credits";

export type GrantCreditsForNewUserParams = {
  userId: string;
  configs: Record<string, string>;
  userEmail?: string;
};

/**
 * 新用户初始积分授予（R13.7）。
 *
 * 受 Config 开关控制：`initial_credits_enabled === 'true'` 且 `initial_credits_amount > 0`
 * 时，按配置数量调用 {@link grant} 授予初始积分（到期时间经
 * {@link calculateCreditExpirationTime} 依 `initial_credits_valid_days` 计算，
 * 0 或缺省表示永不过期）；否则不授予并返回 `undefined`。
 *
 * 仅为独立函数——auth `databaseHooks` 的装配（幂等叠加于 `create.after`）属任务 15。
 */
export function grantCreditsForNewUser(
  params: GrantCreditsForNewUserParams
): Promise<NewCredit | undefined> {
  const { userId, configs, userEmail } = params;

  if (configs[INITIAL_CREDITS_ENABLED_KEY] !== "true") {
    return Promise.resolve(undefined);
  }

  const amount = Number.parseInt(configs[INITIAL_CREDITS_AMOUNT_KEY] ?? "", 10);
  if (Number.isNaN(amount) || amount <= 0) {
    return Promise.resolve(undefined);
  }

  const parsedValidDays = Number.parseInt(
    configs[INITIAL_CREDITS_VALID_DAYS_KEY] ?? "",
    10
  );
  const creditsValidDays = Number.isNaN(parsedValidDays) ? 0 : parsedValidDays;
  const description =
    configs[INITIAL_CREDITS_DESCRIPTION_KEY] ?? DEFAULT_INITIAL_CREDITS_DESCRIPTION;

  const expiresAt = calculateCreditExpirationTime({ creditsValidDays });

  return grant({
    userId,
    userEmail,
    credits: amount,
    description,
    scene: CreditTransactionScene.GIFT,
    expiresAt,
  });
}
