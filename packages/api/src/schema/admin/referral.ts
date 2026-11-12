// packages/api/src/schema/admin/referral —— 分销管理端入参校验
// （modules/admin/referral 路由与服务复用）。
import { z } from "zod";

import { paginationSchema } from "../shared";

export const referralConfigBody = z.object({
  enabled: z.boolean().default(true),
  defaultRate: z.number().int().min(0).max(5000).default(1000),
  minSettleCredits: z.number().int().min(0).default(100),
});

export const commissionsQuery = paginationSchema.extend({
  status: z.string().min(1).optional(),
});

// 手动补记佣金：路由 zValidator 与服务侧 manualCreateCommission 的防御性 parse 共用。
export const manualCreateBody = z.object({
  baseAmount: z.number().int().min(0),
  orderNo: z.string().min(1).max(64),
  rate: z.number().int().min(0).max(5000),
  referredUserId: z.string().min(1),
  referrerId: z.string().min(1),
});

export const rateBody = z.object({
  customRate: z.number().int().min(0).max(5000).nullable(),
});
