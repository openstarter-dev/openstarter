import { z } from "zod";

import { AIMediaType, AITaskStatus } from "../../modules/ai/media/types";
import { paginationSchema } from "../shared";

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
