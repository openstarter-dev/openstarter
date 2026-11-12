// packages/api/src/schema/support/apikeys —— apikeys 域入参校验
// （modules/support/apikeys 路由复用）。
import { z } from "zod";

import { createPaginationSchema } from "../shared";

export const createBody = z.object({ title: z.string().min(1) });

export const listQuery = createPaginationSchema(100, 10).extend({
  search: z.string().optional(),
});
