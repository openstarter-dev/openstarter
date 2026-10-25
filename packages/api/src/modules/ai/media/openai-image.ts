// packages/api/src/modules/ai/media/openai-image —— OpenAI 生图供应商（Task 11）。
//
// 与 replicate.ts 的差异：OpenAI Images API 为**同步型**（无远端任务句柄，不实现 query），
// 且 gpt-image-1 恒返回 base64（`data:[{ b64_json }]`）而非远程 URL。故本 provider：
//   - POST {baseUrl}/images/generations，body `{ model, prompt, n, size?, quality? }`
//     （`options.size`/`options.quality` 透传，`options.n` 限 1-4）；
//   - 把 b64_json 转为 `data:image/png;base64,...` data URL 交给 persistMediaFiles
//     （save-files 桥的 fetchAsBytes 原生支持 data URL）：注入 saveFiles 时转存对象存储并回写
//     URL，未注入时 data URL 原样返回（imageUrl 即 data URL）；
//   - 返回 `taskStatus: SUCCESS`，`taskId` 用注入 uuid（同步完成，无远端句柄）。
//
// 媒体渠道与 LLM 引擎独立取用凭证（共用 `openai_api_key`，见 manager.computeConfigHash）。

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

/** `options.n` 允许的上下限（OpenAI images API 约束）。 */
const MIN_N = 1;
const MAX_N = 4;

/**
 * OpenAI 生图配置。`apiKey` 为必填凭证（与 LLM 引擎共用 `openai_api_key`）；
 * `baseUrl` 可覆盖默认端点。`saveFiles`/`uuid`/`customStorage` 为可注入项
 * （见 {@link AIProviderInjection}）。
 * @docs https://platform.openai.com/docs/api-reference/images
 */
export interface OpenAIImageConfigs extends AIProviderInjection {
  apiKey: string;
  baseUrl?: string;
}

/** OpenAI images/generations 响应（仅提取本域关心的字段，其余保留在 taskResult 原样回传）。 */
interface OpenAIImageItem {
  b64_json?: string;
  url?: string;
}

interface OpenAIImageResponse {
  data?: OpenAIImageItem[];
}

/** 把 `options.n` 归一化并限制在 1-4（非法值忽略，返回 undefined 由 API 用默认值）。 */
function clampN(n: unknown): number | undefined {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return undefined;
  }
  return Math.min(MAX_N, Math.max(MIN_N, Math.trunc(n)));
}

/**
 * OpenAI 生图供应商。同步型：`generate` 一次调用即完成，无 `query`。
 * @docs https://platform.openai.com/docs/api-reference/images
 */
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

    // gpt-image-1 恒返回 b64_json（部分兼容网关可能直接给 url）——优先 b64，其次透传 url。
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
