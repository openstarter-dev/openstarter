// packages/api/src/schema/referral —— referral 域入参校验（modules/referral 路由复用）。
import { z } from "zod";

export const bindBody = z.object({ code: z.string().min(1).max(64) });
