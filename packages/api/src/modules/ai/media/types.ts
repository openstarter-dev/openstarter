export const AIMediaType = {
  MUSIC: "music",
  IMAGE: "image",
  VIDEO: "video",
  TEXT: "text",
  SPEECH: "speech",
} as const;

export type AIMediaType = (typeof AIMediaType)[keyof typeof AIMediaType];

export const AITaskStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  SUCCESS: "success",
  FAILED: "failed",
  CANCELED: "canceled",
} as const;

export type AITaskStatus = (typeof AITaskStatus)[keyof typeof AITaskStatus];

export interface AISong {
  id?: string;
  createTime?: Date;
  audioUrl: string;
  imageUrl: string;
  duration: number;
  prompt: string;
  title: string;
  tags: string;
  style: string;
  model?: string;
  artist?: string;
  album?: string;
}

export interface AIImage {
  id?: string;
  createTime?: Date;
  imageType?: string;
  imageUrl?: string;
}

export interface AIVideo {
  id?: string;
  createTime?: Date;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
}

export interface AIGenerateParams {
  mediaType: AIMediaType;
  prompt: string;
  model?: string;
  options?: Record<string, unknown>;
  callbackUrl?: string;
  stream?: boolean;
  async?: boolean;
}

export interface AITaskInfo {
  songs?: AISong[];
  images?: AIImage[];
  videos?: AIVideo[];
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  createTime?: Date;
}

export interface AITaskResult {
  taskStatus: AITaskStatus;
  taskId: string;
  taskInfo?: AITaskInfo;
  taskResult?: unknown;
}

export interface AIFile {
  url: string;
  contentType: string;
  key: string;
  index?: number;
  type?: string;
}

export type SaveFilesFunction = (files: AIFile[]) => Promise<AIFile[] | undefined>;

export type UuidFunction = () => string;

export interface AIProviderInjection {
  saveFiles?: SaveFilesFunction;
  uuid?: UuidFunction;
  customStorage?: boolean;
}

export interface AIProvider {
  readonly name: string;

  generate(args: { params: AIGenerateParams }): Promise<AITaskResult>;

  query?(args: { taskId: string; mediaType?: AIMediaType; model?: string }): Promise<AITaskResult>;
}
