import { z } from "zod";

export const CommissionStatus = {
  PENDING: "pending",
  SETTLED: "settled",
  VOID: "void",
} as const;

export type CommissionStatus = (typeof CommissionStatus)[keyof typeof CommissionStatus];

export const REFERRAL_RATE_MAX_BPS = 5000;

export const REFERRAL_SCENE = "referral";

export const DEFAULT_REFERRAL_RATE_BPS = 1000;

export const DEFAULT_MIN_SETTLE_CREDITS = 100;

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

export const settleCommissionSchema = z.object({ note: z.string().max(200).optional() });

export function resolveRate(customRate: number | null | undefined, defaultRate: number): number {
  if (customRate === null || customRate === undefined) {
    return defaultRate;
  }
  return customRate;
}

export function calcCommissionCredits(baseAmount: number, rateBps: number): number {
  if (!Number.isFinite(baseAmount) || !Number.isFinite(rateBps)) return 0;
  if (baseAmount <= 0 || rateBps <= 0) return 0;
  return Math.round((baseAmount * rateBps) / 10000);
}
