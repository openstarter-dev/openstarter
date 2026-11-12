// packages/api/src/schema/ai/media —— ai/media 域入参校验（modules/ai/media 路由复用）。
//
// 说明：AIMediaType / AITaskStatus 是 AI 供应商子域的核心抽象（modules/ai/media/types），
// 被 providers / manager / tasks 等多处消费，且 types.ts 为零依赖的纯类型模块 —— 此处
// 直接引用而不搬迁，避免扰动供应商子域既有（文档化的防环）分层设计。
import { z } from "zod";

import { AIMediaType, AITaskStatus } from "../../modules/ai/media/types";
import { paginationSchema } from "../shared";

// 路由可接受的媒体类型 / 任务状态取值（供 z.enum 复用）。
const MEDIA_TYPE_VALUES = [
  AIMediaType.MUSIC,
  AIMediaType.IMAGE,
  AIMediaType.VIDEO,
  AIMediaType.TEXT,
  AIMediaType.SPEECH,
] as const;

const STATUS_VALUES = [
  AITaskStatus.PENDING,
  AITaskStatus.PROCESSING,
  AITaskStatus.SUCCESS,
  AITaskStatus.FAILED,
  AITaskStatus.CANCELED,
] as const;

export const createBody = z.object({
  mediaType: z.enum(MEDIA_TYPE_VALUES),
  provider: z.string().min(1).optional(),
  model: z.string().min(1),
  prompt: z.string().min(1),
  options: z.record(z.string(), z.unknown()).optional(),
});

export const listQuery = paginationSchema.extend({
  mediaType: z.enum(MEDIA_TYPE_VALUES).optional(),
  status: z.enum(STATUS_VALUES).optional(),
});
