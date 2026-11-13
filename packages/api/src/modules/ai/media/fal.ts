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
import { isValidCallbackUrl, omitKeys } from "./utils";

const DEFAULT_BASE_URL = "https://queue.fal.run";

const KLING_EDIT_MODELS: readonly string[] = ["fal-ai/kling-video/o1/video-to-video/edit"];

export interface FalConfigs extends AIProviderInjection {
  apiKey: string;
}

interface FalCreateResponse {
  request_id?: string;
}

interface FalStatusResponse {
  status: string;
}

interface FalMediaItem {
  url?: string;
}

interface FalResultResponse {
  video?: FalMediaItem;
  videos?: FalMediaItem[];
  images?: FalMediaItem[];
}

export class FalProvider implements AIProvider {
  readonly name = "fal";
  private readonly configs: FalConfigs;
  private readonly baseUrl = DEFAULT_BASE_URL;

  constructor(configs: FalConfigs) {
    this.configs = configs;
  }

  private getUuid(): string {
    return (this.configs.uuid || getUuid)();
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Key ${this.configs.apiKey}`,
    };
  }

  async generate({ params }: { params: AIGenerateParams }): Promise<AITaskResult> {
    const { mediaType, model, prompt, callbackUrl } = params;

    if (!mediaType) {
      throw new Error("mediaType is required");
    }
    if (!model) {
      throw new Error("model is required");
    }
    if (!prompt) {
      throw new Error("prompt is required");
    }

    const input = this.formatInput({ model, prompt, options: params.options });
    const apiUrl = isValidCallbackUrl(callbackUrl)
      ? `${this.baseUrl}/${model}?fal_webhook=${callbackUrl}`
      : `${this.baseUrl}/${model}`;

    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(input),
    });
    if (!resp.ok) {
      throw new AIProviderRequestError(this.name, resp.status);
    }

    const data = (await resp.json()) as FalCreateResponse;
    if (!data.request_id) {
      throw new Error("generate failed: no request_id");
    }

    return {
      taskStatus: AITaskStatus.PENDING,
      taskId: data.request_id,
      taskInfo: {},
      taskResult: data,
    };
  }

  async query({
    taskId,
    model,
    mediaType,
  }: {
    taskId: string;
    model?: string;
    mediaType?: AIMediaType;
  }): Promise<AITaskResult> {
    const queryModel = this.getQueryModel(model);
    const requestBase = `${this.baseUrl}/${queryModel}/requests/${taskId}`;

    const statusResp = await fetch(`${requestBase}/status`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!statusResp.ok) {
      throw new AIProviderRequestError(this.name, statusResp.status);
    }

    const statusData = (await statusResp.json()) as FalStatusResponse;
    const taskStatus = this.mapStatus(statusData.status);

    if (taskStatus !== AITaskStatus.SUCCESS) {
      return {
        taskId,
        taskStatus,
        taskInfo: { status: statusData.status, errorCode: "", errorMessage: "" },
        taskResult: statusData,
      };
    }

    const resultResp = await fetch(requestBase, {
      method: "GET",
      headers: this.headers(),
    });
    if (!resultResp.ok) {
      throw new AIProviderRequestError(this.name, resultResp.status);
    }

    const data = (await resultResp.json()) as FalResultResponse;
    const createTime = new Date();
    const { images, videos } = this.extractMedia({ data, mediaType, createTime });

    if (this.configs.customStorage) {
      if (images) {
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
      if (videos) {
        await persistMediaFiles({
          items: videos,
          getUrl: (item) => item.videoUrl,
          setUrl: (item, url) => {
            item.videoUrl = url;
          },
          saveFiles: this.configs.saveFiles,
          uuid: () => this.getUuid(),
          keyPrefix: this.name,
          contentType: "video/mp4",
          type: "video",
          ext: "mp4",
        });
      }
    }

    return {
      taskId,
      taskStatus,
      taskInfo: {
        images,
        videos,
        status: statusData.status,
        errorCode: "",
        errorMessage: "",
        createTime,
      },
      taskResult: data,
    };
  }

  private extractMedia(args: {
    data: FalResultResponse;
    mediaType?: AIMediaType;
    createTime: Date;
  }): { images?: AIImage[]; videos?: AIVideo[] } {
    const { data, mediaType, createTime } = args;

    if (mediaType === AIMediaType.VIDEO) {
      if (data.video?.url) {
        return { videos: [{ id: "", createTime, videoUrl: data.video.url }] };
      }
      if (Array.isArray(data.videos)) {
        return {
          videos: data.videos.map((video) => ({
            id: "",
            createTime,
            videoUrl: video.url,
          })),
        };
      }
      return {};
    }

    if (Array.isArray(data.images)) {
      return {
        images: data.images.map((image) => ({
          id: "",
          createTime,
          imageUrl: image.url,
        })),
      };
    }
    return {};
  }

  private mapStatus(status: string): AITaskStatus {
    switch (status) {
      case "IN_QUEUE":
        return AITaskStatus.PENDING;
      case "IN_PROGRESS":
        return AITaskStatus.PROCESSING;
      case "COMPLETED":
        return AITaskStatus.SUCCESS;
      case "FAILED":
        return AITaskStatus.FAILED;
      default:
        throw new Error(`unknown status: ${status}`);
    }
  }

  private getQueryModel(model?: string): string {
    if (!model) {
      return "";
    }
    const parts = model.split("/");
    if (parts.length <= 2) {
      return model;
    }
    return `${parts[0]}/${parts[1]}`;
  }

  private formatInput(args: {
    model: string;
    prompt: string;
    options?: Record<string, unknown>;
  }): Record<string, unknown> {
    const { model, prompt, options } = args;
    if (!options) {
      return { prompt };
    }

    let input: Record<string, unknown> = { ...options, prompt };

    const imageInput = options.image_input;
    if (Array.isArray(imageInput)) {
      input = KLING_EDIT_MODELS.includes(model)
        ? { ...omitKeys(input, ["image_input"]), input_images: imageInput }
        : { ...omitKeys(input, ["image_input"]), image_url: imageInput[0] };
    }

    const videoInput = options.video_input;
    if (Array.isArray(videoInput)) {
      input = { ...omitKeys(input, ["video_input"]), video_url: videoInput[0] };
    }

    return input;
  }
}
