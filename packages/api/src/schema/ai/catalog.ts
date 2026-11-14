import { z } from "zod";

import { paginationSchema } from "../shared";

export const AI_MEDIA_TYPES = ["image", "video", "music", "speech"] as const;

export type AIModelMediaType = (typeof AI_MEDIA_TYPES)[number];

export const createBody = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1),
  displayName: z.string().min(1),
  mediaType: z.enum(AI_MEDIA_TYPES),
  creditPrice: z.number().int().min(0).default(0),
  optionsSchema: z.string().nullable().optional(),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  metadata: z.string().nullable().optional(),
});

export const updateBody = createBody.extend({
  provider: z.string().min(1).optional(),
  modelId: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  mediaType: z.enum(AI_MEDIA_TYPES).optional(),
  creditPrice: z.number().int().min(0).optional(),
  optionsSchema: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  metadata: z.string().nullable().optional(),
});

export const listQuery = paginationSchema.extend({
  mediaType: z.enum(AI_MEDIA_TYPES).optional(),
});
