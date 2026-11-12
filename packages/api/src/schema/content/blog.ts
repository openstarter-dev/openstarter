// packages/api/src/schema/content/blog —— blog 域入参校验（modules/content/blog 路由复用）。
import { z } from "zod";

import { createPaginationSchema } from "../shared";

export const listQuery = createPaginationSchema(100, 12).extend({
  category: z.string().min(1).optional(),
});

export const slugParam = z.object({ slug: z.string().min(1) });
