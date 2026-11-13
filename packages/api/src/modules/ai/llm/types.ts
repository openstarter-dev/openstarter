export interface Chat {
  id: string;
  title: string;
  model: string;
  provider: string;
  status: "active" | "archived" | "deleted";
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewChat {
  title?: string;
  model?: string;
  provider?: string;
  userId: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  parts?: string;
  model?: string;
  provider?: string;
  status: "success" | "error";
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewChatMessage {
  chatId: string;
  role: "user" | "assistant";
  content: string;
  parts?: string;
  model?: string;
  provider?: string;
  userId: string;
}

export interface StreamEventMessage {
  type: "text" | "tool-call" | "error" | "done";
  text?: string;
  finishReason?: "stop" | "length" | "content-filter" | "tool-calls" | "error";
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  error?: {
    message: string;
    code?: string;
  };
}
