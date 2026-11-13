import { z } from "zod";

export const bindBody = z.object({ code: z.string().min(1).max(64) });
