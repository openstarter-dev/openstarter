import { z } from "zod";

import { paginationSchema } from "../shared";

export const commissionsQuery = paginationSchema.extend({
  status: z.string().min(1).optional(),
});

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
