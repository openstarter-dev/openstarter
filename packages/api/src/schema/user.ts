// packages/api/src/schema/user —— user 域入参校验（modules/user 路由复用）。
import { z } from "zod";

const DEFAULT_HISTORY_LIMIT = 50;

// 积分流水分页：limit/offset 形态（与 page/pageSize 的通用分页不同）。
export const creditsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_HISTORY_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});
