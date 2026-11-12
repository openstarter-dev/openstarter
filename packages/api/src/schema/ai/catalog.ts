// packages/api/src/schema/ai/catalog —— ai/catalog 域类型与入参校验
// （modules/ai/catalog 路由与服务复用）。
import { z } from "zod";

import { paginationSchema } from "../shared";

/** AI 生成的媒体类型清单（目录分组键）。 */
export const AI_MEDIA_TYPES = ["text", "image", "video", "music", "speech"] as const;

/** 模型目录的媒体类型。 */
export type AIModelMediaType = (typeof AI_MEDIA_TYPES)[number];

export const createBody = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1),
  displayName: z.string().min(1),
  mediaType: z.enum(AI_MEDIA_TYPES),
  creditPrice: z.number().int().min(0).default(0),
  maxOutputTokens: z.number().int().min(1).nullable().optional(),
  optionsSchema: z.string().nullable().optional(),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  metadata: z.string().nullable().optional(),
});

// update schema 不能复用 createBody.partial()：partial 会保留字段的 .default()，
// 解析时把未提交的字段重置为默认值。这里逐字段 optional（无 default），未提交的
// 键不会出现在解析结果中，updateModel 只更新实际提交的字段。
export const updateBody = createBody.extend({
  provider: z.string().min(1).optional(),
  modelId: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  mediaType: z.enum(AI_MEDIA_TYPES).optional(),
  creditPrice: z.number().int().min(0).optional(),
  maxOutputTokens: z.number().int().min(1).nullable().optional(),
  optionsSchema: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  metadata: z.string().nullable().optional(),
});

export const listQuery = paginationSchema.extend({
  mediaType: z.enum(AI_MEDIA_TYPES).optional(),
});
