// packages/api/src/schema/demo —— demo 域入参校验（modules/demo 路由复用）。
import { z } from "zod";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export const createSchema = z.object({
  description: z.string().optional(),
  name: z.string().min(1).max(200),
});

export const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});
