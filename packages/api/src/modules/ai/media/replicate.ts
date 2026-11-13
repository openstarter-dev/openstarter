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

const DEFAULT_BASE_URL = "https://api.replicate.com/v1";

const FLUX_MODELS: readonly string[] = ["black-forest-labs/flux-2-pro"];
const VEO_MODELS: readonly string[] = ["google/veo-3.1"];
const SORA_MODELS: readonly string[] = ["openai/sora-2"];

export interface ReplicateConfigs extends AIProviderInjection {
  apiToken: string;
  baseUrl?: string;
}

interface ReplicatePrediction {
  id: string;
  status: string;
  output?: unknown;
  error?: unknown;
  created_at?: string;
}

function extractUrls(output: unknown): string[] {
  if (Array.isArray(output)) {
    return output.filter((item): item is string => typeof item === "string");
  }
  if (typeof output === "string") {
    return [output];
  }
  return [];
}

export class ReplicateProvider implements AIProvider {
  readonly name = "replicate";
  private readonly configs: ReplicateConfigs;
  private readonly baseUrl: string;

  constructor(configs: ReplicateConfigs) {
    this.configs = configs;
    this.baseUrl = configs.baseUrl || DEFAULT_BASE_URL;
  }

  private getUuid(): string {
    return (this.configs.uuid || getUuid)();
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.configs.apiToken}`,
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
    const useWebhook = isValidCallbackUrl(callbackUrl);

    const resp = await fetch(`${this.baseUrl}/models/${model}/predictions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        input,
        webhook: useWebhook ? callbackUrl : undefined,
        webhook_events_filter: useWebhook ? ["completed"] : undefined,
      }),
    });

    if (!resp.ok) {
      throw new AIProviderRequestError(this.name, resp.status);
    }

    const data = (await resp.json()) as ReplicatePrediction;
    if (!data.id) {
      throw new Error("generate failed: no prediction id");
    }

    return {
      taskStatus: AITaskStatus.PENDING,
      taskId: data.id,
      taskInfo: {},
      taskResult: data,
    };
  }

  async query({
    taskId,
    mediaType,
  }: {
    taskId: string;
    mediaType?: AIMediaType;
  }): Promise<AITaskResult> {
    const resp = await fetch(`${this.baseUrl}/predictions/${taskId}`, {
      method: "GET",
      headers: this.headers(),
    });

    if (!resp.ok) {
      throw new AIProviderRequestError(this.name, resp.status);
    }

    const data = (await resp.json()) as ReplicatePrediction;
    const createTime = data.created_at ? new Date(data.created_at) : new Date();
    const urls = extractUrls(data.output);
    const isVideo = mediaType === AIMediaType.VIDEO;

    let images: AIImage[] | undefined;
    let videos: AIVideo[] | undefined;
    if (isVideo) {
      videos = urls.map((videoUrl) => ({ id: "", createTime, videoUrl }));
    } else {
      images = urls.map((imageUrl) => ({ id: "", createTime, imageUrl }));
    }

    const taskStatus = this.mapStatus(data.status);

    if (taskStatus === AITaskStatus.SUCCESS && this.configs.customStorage) {
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
        status: data.status,
        errorCode: "",
        errorMessage: typeof data.error === "string" ? data.error : "",
        createTime,
      },
      taskResult: data,
    };
  }

  private mapStatus(status: string): AITaskStatus {
    switch (status) {
      case "starting":
        return AITaskStatus.PENDING;
      case "processing":
        return AITaskStatus.PROCESSING;
      case "succeeded":
        return AITaskStatus.SUCCESS;
      case "failed":
        return AITaskStatus.FAILED;
      case "canceled":
        return AITaskStatus.CANCELED;
      default:
        throw new Error(`unknown status: ${status}`);
    }
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

    const withPrompt: Record<string, unknown> = { ...options, prompt };
    const remapped = this.remapImageInput({ model, input: withPrompt, options });
    return this.remapDuration({ model, input: remapped, options });
  }

  private remapImageInput(args: {
    model: string;
    input: Record<string, unknown>;
    options: Record<string, unknown>;
  }): Record<string, unknown> {
    const { model, input, options } = args;
    const imageInput = options.image_input;
    if (!Array.isArray(imageInput)) {
      return input;
    }

    if (FLUX_MODELS.includes(model)) {
      return { ...omitKeys(input, ["image_input"]), input_images: imageInput };
    }
    if (VEO_MODELS.includes(model)) {
      return {
        ...omitKeys(input, ["image_input"]),
        reference_images: imageInput,
      };
    }
    if (SORA_MODELS.includes(model)) {
      return {
        ...omitKeys(input, ["image_input"]),
        input_reference: imageInput[0],
      };
    }
    return input;
  }

  private remapDuration(args: {
    model: string;
    input: Record<string, unknown>;
    options: Record<string, unknown>;
  }): Record<string, unknown> {
    const { model, input, options } = args;
    if (options.duration !== undefined && SORA_MODELS.includes(model)) {
      return { ...omitKeys(input, ["duration"]), seconds: Number(options.duration) };
    }
    return input;
  }
}
