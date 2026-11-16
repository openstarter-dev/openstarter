import type { Database } from "../../../db/server";
import { commission, referral, referralRelation } from "../../../db/schema";
import { getUuid } from "@openstarter/shared/id";
import { logger } from "@openstarter/shared/logger";
import { eq } from "drizzle-orm";

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

export interface PaidOrder {
  orderNo: string;
  paymentAmount: number | null;
  paymentCurrency: string | null;
  userId: string;
}

export interface RecordCommissionResult {
  commissionId?: string;
  skipped?: boolean;
  reason?: "no_relation" | "disabled" | "no_amount" | "error";
}

export type CommissionTx = Pick<Database, "insert" | "select">;

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

interface ReferralChain {
  code: string;
  referrerId: string;
  customRate: number | null;
}

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
    logger.warn("[referral] 记账旁路失败（订单号 %s）：", paidOrder.orderNo, err);
    return { reason: "error", skipped: true };
  }
}
