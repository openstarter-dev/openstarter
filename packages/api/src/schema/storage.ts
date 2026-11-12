// packages/api/src/schema/storage —— storage 域入参校验（modules/storage 路由复用）。
import { z } from "zod";

// 单次上传文件数上限（multipart 与 base64 JSON 两种通道共用）。
export const MAX_FILES = 9;

const base64Item = z.object({
  contentType: z.string().min(1),
  data: z.string().min(1),
  filename: z.string().min(1).optional(),
});

// JSON base64 上传入参（multipart 通道不走 schema，由路由直接归一化为条目）。
export const base64Body = z.object({
  files: z.array(base64Item).min(1).max(MAX_FILES),
});
