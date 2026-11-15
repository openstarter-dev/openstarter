// Referral commission ledger service (reads static/env referral rules, no DB config table).
// 分销记账服务（从静态默认/环境变量读取返佣规则，不依赖数据库 config 表）。

import type { Database } from "../../../db/server";
import { commission, referral, referralRelation } from "../../../db/schema";
import { getUuid } from "@openstarter/shared/id";
import { logger } from "@openstarter/shared/logger";
import { eq } from "../../../db/orm";

import { readBooleanEnv, readIntEnv } from "../../../lib/env";
import {
  calcCommissionCredits,
  CommissionStatus,
  DEFAULT_MIN_SETTLE_CREDITS,
  DEFAULT_REFERRAL_RATE_BPS,
  referralConfigSchema,
  resolveRate,
  type ReferralConfig,
} from "./commission";

/** 已支付订单的最小字段（来自 webhook 编排的 {@link NewOrder} 子集，避免硬依赖 payment 模块）。 */
export interface PaidOrder {
  orderNo: string;
  paymentAmount: number | null;
  paymentCurrency: string | null;
  userId: string;
}

/** 推荐记账配置查询结果（节流/调试友好）。 */
export interface RecordCommissionResult {
  commissionId?: string;
  skipped?: boolean;
  reason?: "no_relation" | "disabled" | "no_amount" | "error";
}

/**
 * 事务/数据库句柄最小接口（insert + select），兼容 Database 与 SQLiteTransaction。
 * 满足 Plan Note 中 Pick<AppTransaction, "insert" | "select"> 的契约。
 */
export type CommissionTx = Pick<Database, "insert" | "select">;

// ─── 配置读取（getReferralConfig） ─────────────────────────────────────────────

/**
 * Read referral rules from environment variables (`REFERRAL_ENABLED`,
 * `REFERRAL_DEFAULT_RATE_BPS`, `REFERRAL_MIN_SETTLE_CREDITS`) and validate via
 * {@link referralConfigSchema}; invalid env overrides fall back to safe defaults.
 *
 * 读取分销静态配置（基于环境变量 `REFERRAL_*`，经 {@link referralConfigSchema} 校验）：
 * 缺失或非法时回退默认值（enabled=true, defaultRate=1000, minSettleCredits=100）。
 */
export async function getReferralConfig(): Promise<ReferralConfig> {
  const candidate = {
    enabled: readBooleanEnv("REFERRAL_ENABLED", true),
    defaultRate: readIntEnv("REFERRAL_DEFAULT_RATE_BPS", DEFAULT_REFERRAL_RATE_BPS),
    minSettleCredits: readIntEnv("REFERRAL_MIN_SETTLE_CREDITS", DEFAULT_MIN_SETTLE_CREDITS),
  };

  const parsed = referralConfigSchema.safeParse(candidate);
  if (parsed.success) {
    return parsed.data;
  }

  logger.warn("[referral] invalid referral env config, using defaults:", parsed.error.issues);
  return referralConfigSchema.parse({});
}

// ─── 推荐关系查询（纯查询，便于幂等与旁路判定） ───────────────────────────────

interface ReferralChain {
  code: string;
  referrerId: string;
  customRate: number | null;
}

/**
 * 依被推荐人 userId 查找其推荐关系，返回推荐人 id、推荐码与代理 customRate（无则 undefined）。
 * 接受 db() 或事务句柄。
 */
async function findReferralChain(
  dbOrTx: CommissionTx,
  referredUserId: string,
): Promise<ReferralChain | undefined> {
  const [relation] = await dbOrTx
    .select({ code: referralRelation.code, referrerId: referralRelation.referrerId })
    .from(referralRelation)
    .where(eq(referralRelation.referredUserId, referredUserId))
    .limit(1);
  if (!relation) {
    return;
  }

  const [ref] = await dbOrTx
    .select({ customRate: referral.customRate })
    .from(referral)
    .where(eq(referral.userId, relation.referrerId))
    .limit(1);

  if (!ref) {
    return;
  }
  return { code: relation.code, referrerId: relation.referrerId, customRate: ref.customRate };
}

// ─── 记账（recordCommission） ──────────────────────────────────────────────────

/**
 * 记录分销佣金（在支付成功编排的事务内调用）。
 *
 * 链路：被推荐人(paidOrder.userId) → referral_relation → 推荐人(referral)。
 * - 开关关闭 / 无推荐关系 / paymentAmount 非法 → 旁路不记账（返回 skipped 原因）。
 * - 命中 → 记一笔 pending 佣金：rate 取推荐人 customRate（代理）否则全局默认
 *   defaultRate；commissionCredits 经 {@link calcCommissionCredits} 取整。
 * - 幂等：commission.orderNo 唯一约束，重复订单号直接回读跳过（不抛错、不重复记账）。
 * - 任何内部异常按旁路处理（log 后返回 reason="error"），不影响主支付流程。
 *
 * 返回落库记录 id 或跳过原因；异常不向上抛出（旁路语义）。
 */
export async function recordCommission(
  tx: CommissionTx,
  paidOrder: PaidOrder,
): Promise<RecordCommissionResult> {
  try {
    const cfg = await getReferralConfig();
    if (!cfg.enabled) {
      return { reason: "disabled", skipped: true };
    }

    const chain = await findReferralChain(tx, paidOrder.userId);
    if (!chain) {
      return { reason: "no_relation", skipped: true };
    }

    const amount = paidOrder.paymentAmount ?? null;
    if (amount === null || !Number.isFinite(amount) || amount <= 0) {
      return { reason: "no_amount", skipped: true };
    }

    // 幂等：同 orderNo 已记账则跳过（捕获唯一约束冲突或先回读）。
    const [existing] = await tx
      .select({ id: commission.id })
      .from(commission)
      .where(eq(commission.orderNo, paidOrder.orderNo))
      .limit(1);
    if (existing) {
      return { commissionId: existing.id, skipped: true };
    }

    const rate = resolveRate(chain.customRate, cfg.defaultRate);
    const credits = calcCommissionCredits(amount, rate);
    const id = getUuid();

    await tx
      .insert(commission)
      .values({
        baseAmount: amount,
        baseCurrency: paidOrder.paymentCurrency ?? null,
        commissionCredits: credits,
        id,
        orderNo: paidOrder.orderNo,
        rate,
        referredUserId: paidOrder.userId,
        referrerId: chain.referrerId,
        status: CommissionStatus.PENDING,
      })
      .onConflictDoNothing({ target: commission.orderNo });

    return { commissionId: id };
  } catch (err) {
    // 旁路：分销记账失败不影响主支付流程；记录日志供人工补记。
    logger.warn("[referral] 记账旁路失败（订单号 %s）：", paidOrder.orderNo, err);
    return { reason: "error", skipped: true };
  }
}
