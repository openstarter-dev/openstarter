// packages/api/src/schema/auth —— auth 域入参校验（modules/auth 路由复用）。
//
// unlink-account 在数据库语句级维护「至少一个登录方式」不变量，入参只接受
// providerId + 可选 accountId，多余键一律拒绝（strict）。
import { z } from "zod";

export const unlinkAccountSchema = z
  .object({
    accountId: z.string().min(1).optional(),
    providerId: z.string().min(1),
  })
  .strict();
