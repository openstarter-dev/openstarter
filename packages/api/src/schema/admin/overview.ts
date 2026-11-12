// packages/api/src/schema/admin/overview —— 管理总览入参校验（modules/admin/overview 路由复用）。
import { z } from "zod";

import { paginationSchema } from "../shared";

const MAX_INVITE_BATCH = 200;

export const listQuery = paginationSchema.extend({
  search: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
});

export const inviteBatchBody = z.object({
  count: z.number().int().min(1).max(MAX_INVITE_BATCH),
  maxUses: z.number().int().min(1).optional(),
  note: z.string().optional(),
  trialDays: z.number().int().min(0).optional(),
});

export const saveConfigBody = z.record(z.string(), z.string());
