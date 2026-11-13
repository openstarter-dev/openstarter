import { getUuid } from "@openstarter/shared/id";
import { AIProviderRequestError } from "./errors";
import { persistMediaFiles } from "./save-files";
import {
  type AIGenerateParams,
  type AIImage,
  AIMediaType,
  type AIProvider,
  type AIProviderInjection,
  type AITaskResult,
  AITaskStatus,
  type AIVideo,
} from "./types";

const MIN_N = 1;
const MAX_N = 4;

interface NewAPIImageResponse {
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
}

interface NewAPIVideoTaskResponse {
  task_id?: string;
  taskId?: string;
  id?: string;
  status?: string;
  url?: string;
  format?: string;
  metadata?: {
    duration?: number;
    fps?: number;
    width?: number;
    height?: number;
    seed?: number;
  };
  error?: {
    code?: number | string;
    message?: string;
  };
  data?: unknown;
  videos?: unknown;
  output?: unknown;
}

export interface NewAPIConfigs extends AIProviderInjection {
  apiKey: string;
  baseUrl: string;
}

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    if ((url.pathname === "" || url.pathname === "/") && !url.search && !url.hash) {
      return `${trimmed}/v1`;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function clampN(value: unknown): number | undefined {
  const n = readNumber(value);
  if (n === undefined) {
    return undefined;
  }
  return Math.min(MAX_N, Math.max(MIN_N, Math.trunc(n)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readImageInput(options: Record<string, unknown> | undefined): string | undefined {
  if (!options) {
    return undefined;
  }
  const image = options.image;
  if (typeof image === "string" && image) {
    return image;
  }
  const input = options.image_input;
  if (typeof input === "string" && input) {
    return input;
  }
  if (Array.isArray(input) && typeof input[0] === "string" && input[0]) {
    return input[0];
  }
  return undefined;
}

function extractVideoUrls(data: NewAPIVideoTaskResponse): string[] {
  const urls: string[] = [];
  const push = (value: unknown): void => {
    if (typeof value === "string" && value) {
      urls.push(value);
    } else if (isRecord(value) && typeof value.url === "string" && value.url) {
      urls.push(value.url);
    }
  };

  push(data.url);
  for (const key of ["data", "videos", "output"] as const) {
    const value = data[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        push(item);
      }
    } else {
      push(value);
    }
  }

  return [...new Set(urls)];
}

function mapVideoStatus(status: string | undefined): AITaskStatus {
  switch (status) {
    case "queued":
    case "pending":
      return AITaskStatus.PENDING;
    case "in_progress":
    case "processing":
    case "running":
      return AITaskStatus.PROCESSING;
    case "completed":
    case "succeeded":
    case "success":
      return AITaskStatus.SUCCESS;
    case "failed":
    case "error":
      return AITaskStatus.FAILED;
    case "canceled":
    case "cancelled":
      return AITaskStatus.CANCELED;
    default:
      return AITaskStatus.PROCESSING;
  }
}

export class NewAPIProvider implements AIProvider {
  readonly name = "newapi";
  private readonly configs: NewAPIConfigs;
  private readonly baseUrl: string;

  constructor(configs: NewAPIConfigs) {
    this.configs = configs;
    this.baseUrl = normalizeBaseUrl(configs.baseUrl);
  }

  private getUuid(): string {
    return (this.configs.uuid || getUuid)();
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.configs.apiKey}`,
    };
  }

  async generate({ params }: { params: AIGenerateParams }): Promise<AITaskResult> {
    const { mediaType, model, prompt } = params;

    if (!model) {
      throw new Error("model is required");
    }
    if (!prompt) {
      throw new Error("prompt is required");
    }

    if (mediaType === AIMediaType.IMAGE) {
      return this.generateImage(params);
    }
    if (mediaType === AIMediaType.VIDEO) {
      return this.generateVideo(params);
    }
    throw new Error(
      `newapi provider only supports mediaType 'image' or 'video', got: ${mediaType}`,
    );
  }

  private async generateImage(params: AIGenerateParams): Promise<AITaskResult> {
    const { model, prompt, options } = params;
    const body: Record<string, unknown> = {
      model,
      prompt,
      n: clampN(options?.n) ?? MIN_N,
    };
    if (typeof options?.size === "string") {
      body.size = options.size;
    }
    if (typeof options?.quality === "string") {
      body.quality = options.quality;
    }
    if (typeof options?.style === "string") {
      body.style = options.style;
    }
    if (typeof options?.response_format === "string") {
      body.response_format = options.response_format;
    }

    const resp = await fetch(`${this.baseUrl}/images/generations`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      throw new AIProviderRequestError(this.name, resp.status);
    }

    const data = (await resp.json()) as NewAPIImageResponse;
    const createTime = new Date();
    const images: AIImage[] = (data.data ?? []).map((item) => ({
      id: "",
      createTime,
      imageUrl: item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url,
    }));

    if (this.configs.customStorage) {
      await persistMediaFiles({
        items: images,
        getUrl: (item) => item.imageUrl,
        setUrl: (item, url) => {
          item.imageUrl = url;
        },
        saveFiles: this.configs.saveFiles,
        uuid: () => this.getUuid(),
        keyPrefix: this.name,
        contentType: "image/png",
        type: "image",
        ext: "png",
      });
    }

    return {
      taskStatus: AITaskStatus.SUCCESS,
      taskId: this.getUuid(),
      taskInfo: {
        images,
        status: AITaskStatus.SUCCESS,
        errorCode: "",
        errorMessage: "",
        createTime,
      },
      taskResult: data,
    };
  }

  private async generateVideo(params: AIGenerateParams): Promise<AITaskResult> {
    const { model, prompt, options } = params;
    const body: Record<string, unknown> = { model, prompt };

    const image = readImageInput(options);
    if (image) {
      body.image = image;
    }

    for (const key of ["duration", "width", "height", "fps", "seed", "n"] as const) {
      const value = readNumber(options?.[key]);
      if (value !== undefined) {
        body[key] = value;
      }
    }
    if (typeof options?.response_format === "string") {
      body.response_format = options.response_format;
    }

    const known = new Set([
      "image",
      "image_input",
      "duration",
      "width",
      "height",
      "fps",
      "seed",
      "n",
      "response_format",
      "metadata",
    ]);
    const metadata: Record<string, unknown> = isRecord(options?.metadata)
      ? { ...options.metadata }
      : {};
    for (const [key, value] of Object.entries(options ?? {})) {
      if (!known.has(key) && value !== undefined) {
        metadata[key] = value;
      }
    }
    if (Object.keys(metadata).length > 0) {
      body.metadata = metadata;
    }

    const resp = await fetch(`${this.baseUrl}/video/generations`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      throw new AIProviderRequestError(this.name, resp.status);
    }

    const data = (await resp.json()) as NewAPIVideoTaskResponse;
    const taskId = data.task_id ?? data.taskId ?? data.id;
    if (!taskId) {
      throw new Error("generate failed: no task_id");
    }

    return {
      taskStatus: AITaskStatus.PENDING,
      taskId,
      taskInfo: {
        status: data.status ?? AITaskStatus.PENDING,
        errorCode: "",
        errorMessage: "",
        createTime: new Date(),
      },
      taskResult: data,
    };
  }

  async query({
    taskId,
    mediaType,
  }: {
    taskId: string;
    mediaType?: AIMediaType;
    model?: string;
  }): Promise<AITaskResult> {
    if (mediaType && mediaType !== AIMediaType.VIDEO) {
      throw new Error(`newapi query only supports video tasks, got: ${mediaType}`);
    }

    const resp = await fetch(`${this.baseUrl}/video/generations/${encodeURIComponent(taskId)}`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!resp.ok) {
      throw new AIProviderRequestError(this.name, resp.status);
    }

    const data = (await resp.json()) as NewAPIVideoTaskResponse;
    const taskStatus = mapVideoStatus(data.status);
    const createTime = new Date();
    const errorMessage = data.error?.message ?? "";
    const errorCode = data.error?.code !== undefined ? String(data.error.code) : "";

    let videos: AIVideo[] | undefined;
    if (taskStatus === AITaskStatus.SUCCESS) {
      const format = data.format === "webm" ? "webm" : "mp4";
      videos = extractVideoUrls(data).map((videoUrl) => ({
        id: "",
        createTime,
        videoUrl,
        duration: data.metadata?.duration,
      }));

      if (this.configs.customStorage) {
        await persistMediaFiles({
          items: videos,
          getUrl: (item) => item.videoUrl,
          setUrl: (item, url) => {
            item.videoUrl = url;
          },
          saveFiles: this.configs.saveFiles,
          uuid: () => this.getUuid(),
          keyPrefix: this.name,
          contentType: `video/${format}`,
          type: "video",
          ext: format,
        });
      }
    }

    return {
      taskId,
      taskStatus,
      taskInfo: {
        videos,
        status: data.status ?? taskStatus,
        errorCode,
        errorMessage,
        createTime,
      },
      taskResult: data,
    };
  }
}
