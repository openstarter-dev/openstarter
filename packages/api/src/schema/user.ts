import { z } from "zod";

const DEFAULT_HISTORY_LIMIT = 50;

export const creditsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_HISTORY_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});
