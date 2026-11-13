import { z } from "zod";

export const textPartSchema = z.object({ type: z.literal("text"), content: z.string() });

export const sendMessageBody = z.object({
  threadId: z.string().optional(),
  runId: z.string().optional(),
  messages: z
    .array(
      z.object({
        id: z.string().optional(),
        role: z.string().min(1),
        parts: z.array(z.unknown()).optional(),
        content: z.string().optional(),
      }),
    )
    .min(1),
  forwardedProps: z.record(z.string(), z.unknown()).optional(),
});

export type SendMessageBody = z.infer<typeof sendMessageBody>;

export const createChatBody = z.object({
  title: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
});
