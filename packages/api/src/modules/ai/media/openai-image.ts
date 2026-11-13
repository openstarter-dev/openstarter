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
} from "./types";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

const MIN_N = 1;
const MAX_N = 4;

export interface OpenAIImageConfigs extends AIProviderInjection {
  apiKey: string;
  baseUrl?: string;
}

interface OpenAIImageItem {
  b64_json?: string;
  url?: string;
}

interface OpenAIImageResponse {
  data?: OpenAIImageItem[];
}

function clampN(n: unknown): number | undefined {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return undefined;
  }
  return Math.min(MAX_N, Math.max(MIN_N, Math.trunc(n)));
}

export class OpenAIImageProvider implements AIProvider {
  readonly name = "openai";
  private readonly configs: OpenAIImageConfigs;
  private readonly baseUrl: string;

  constructor(configs: OpenAIImageConfigs) {
    this.configs = configs;
    this.baseUrl = configs.baseUrl || DEFAULT_BASE_URL;
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
    const { mediaType, model, prompt, options } = params;

    if (mediaType !== AIMediaType.IMAGE) {
      throw new Error(`openai image provider only supports mediaType 'image', got: ${mediaType}`);
    }
    if (!model) {
      throw new Error("model is required");
    }
    if (!prompt) {
      throw new Error("prompt is required");
    }

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

    const resp = await fetch(`${this.baseUrl}/images/generations`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new AIProviderRequestError(this.name, resp.status);
    }

    const data = (await resp.json()) as OpenAIImageResponse;
    const createTime = new Date();
    const items = data.data ?? [];

    const images: AIImage[] = items.map((item) => ({
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
}
