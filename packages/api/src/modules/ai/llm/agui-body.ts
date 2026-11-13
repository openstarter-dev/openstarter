import { type SendMessageBody, textPartSchema } from "../../../schema/ai/llm";

export function extractLatestUserText(body: SendMessageBody): string | null {
  for (let i = body.messages.length - 1; i >= 0; i -= 1) {
    const message = body.messages[i];
    if (message == null || message.role !== "user") continue;
    if (message.parts === undefined) {
      const text = typeof message.content === "string" ? message.content.trim() : "";
      return text.length > 0 ? text : null;
    }
    const text = message.parts
      .flatMap((part) => {
        const parsed = textPartSchema.safeParse(part);
        return parsed.success ? [parsed.data.content] : [];
      })
      .join("")
      .trim();
    return text.length > 0 ? text : null;
  }
  return null;
}
