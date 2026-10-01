// 佣金数学：比例解析（代理覆盖 ?? 全局默认）与积分取整计算。
// 万分比整数存储（1000 = 10%），上限 REFERRAL_RATE_MAX_BPS = 5000。

import { z } from "zod";

/** 佣金账目状态：pending（待结算）/ settled（已结算）/ void（已作废）。 */
export const CommissionStatus = {
  PENDING: "pending",
  SETTLED: "settled",
  VOID: "void",
} as const;

export type CommissionStatus = (typeof CommissionStatus)[keyof typeof CommissionStatus];

/** 比例上限（万分比）：防配置事故。 */
export const REFERRAL_RATE_MAX_BPS = 5000;

/** config 表中分销配置的键名。 */
export const REFERRAL_CONFIG_KEY = "referral";

/** 分销场景键（credit grant 用）。 */
export const REFERRAL_SCENE = "referral";

/** 全局默认佣金比例（万分比，1000 = 10%）。 */
export const DEFAULT_REFERRAL_RATE_BPS = 1000;

/** 结算门槛：低于该积分值的 pending 佣金管理端提示不可结算。 */
export const DEFAULT_MIN_SETTLE_CREDITS = 100;

/** config 表 `referral` 键的 JSON 值校验（系统边界）。 */
export const referralConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultRate: z
    .number()
    .int()
    .min(0)
    .max(REFERRAL_RATE_MAX_BPS)
    .default(DEFAULT_REFERRAL_RATE_BPS),
  minSettleCredits: z.number().int().min(0).default(DEFAULT_MIN_SETTLE_CREDITS),
});

export type ReferralConfig = z.infer<typeof referralConfigSchema>;

/** 允许结算 / 手动补记请求体的业务校验。 */
export const settleCommissionSchema = z.object({ note: z.string().max(200).optional() });

/** 解析生效比例：用户级覆盖（代理）优先，否则全局默认。 */
export function resolveRate(customRate: number | null | undefined, defaultRate: number): number {
  if (customRate === null || customRate === undefined) {
    return defaultRate;
  }
  return customRate;
}

/**
 * 佣金积分：round(baseAmount × rateBps / 10000)。
 * 非法输入（负数 / NaN / 零比例）一律返回 0 —— 调用方按 0 跳过记账。
 */
export function calcCommissionCredits(baseAmount: number, rateBps: number): number {
  if (!Number.isFinite(baseAmount) || !Number.isFinite(rateBps)) return 0;
  if (baseAmount <= 0 || rateBps <= 0) return 0;
  return Math.round((baseAmount * rateBps) / 10000);
}
