import { z } from "zod";

export const MAX_FILES = 9;

const base64Item = z.object({
  contentType: z.string().min(1),
  data: z.string().min(1),
  filename: z.string().min(1).optional(),
});

export const base64Body = z.object({
  files: z.array(base64Item).min(1).max(MAX_FILES),
});
