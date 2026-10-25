// packages/api/src/modules/ai/media/openai-image —— OpenAI 生图供应商测试（Task 11）。
//
// 同步型供应商（无 query）：POST {baseUrl}/images/generations，响应 data:[{b64_json}]
// → data URL → persistMediaFiles（注入 saveFiles 时转存回写，未注入时原样返回 data URL）。
// fetch 以 vi.stubGlobal mock，覆盖：成功转存、非 2xx 抛 AIProviderRequestError、
// mediaType 非 image 抛错、options.n 限 1-4。

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AIProviderRequestError } from "./errors";
import { AIMediaType, AITaskStatus, type AIGenerateParams } from "./types";
import { OpenAIImageProvider, type OpenAIImageConfigs } from "./openai-image";

/** 构造 OpenAI images/generations 成功响应（n 张 b64_json）。 */
function generationsResponse(b64List: readonly string[]): Response {
  return new Response(JSON.stringify({ data: b64List.map((b64_json) => ({ b64_json })) }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function makeConfigs(overrides?: Partial<OpenAIImageConfigs>): OpenAIImageConfigs {
  return { apiKey: "sk-test", ...overrides };
}

function makeParams(overrides?: Partial<AIGenerateParams>): AIGenerateParams {
  return {
    mediaType: AIMediaType.IMAGE,
    prompt: "a cat in space",
    model: "gpt-image-1",
    ...overrides,
  };
}

describe("OpenAIImageProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps b64_json items to images and persists via injected saveFiles", async () => {
    const saveFiles = vi.fn().mockResolvedValue([
      { url: "https://cdn.example.com/openai/image/1.png", index: 0 },
      { url: "https://cdn.example.com/openai/image/2.png", index: 1 },
    ]);
    const fetchMock = vi.fn().mockResolvedValue(generationsResponse(["AAAA", "BBBB"]));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIImageProvider(
      makeConfigs({ saveFiles, customStorage: true, uuid: () => "uuid-1" }),
    );
    const result = await provider.generate({ params: makeParams({ options: { n: 2 } }) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/images/generations");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(String(init.body)) as {
      model: string;
      prompt: string;
      n: number;
    };
    expect(body).toEqual({ model: "gpt-image-1", prompt: "a cat in space", n: 2 });

    expect(saveFiles).toHaveBeenCalledTimes(1);
    const savedFiles = (saveFiles.mock.calls[0]?.[0] ?? []) as Array<{ url: string; key: string }>;
    expect(savedFiles).toHaveLength(2);
    // 待转存 URL 为 data URL（b64_json → data:image/png;base64,...）。
    expect(savedFiles[0]?.url).toBe("data:image/png;base64,AAAA");
    expect(savedFiles[1]?.url).toBe("data:image/png;base64,BBBB");

    expect(result.taskStatus).toBe(AITaskStatus.SUCCESS);
    expect(result.taskId).toBe("uuid-1");
    expect(result.taskInfo?.images?.map((img) => img.imageUrl)).toEqual([
      "https://cdn.example.com/openai/image/1.png",
      "https://cdn.example.com/openai/image/2.png",
    ]);
  });

  it("returns data URLs as-is when saveFiles is not injected", async () => {
    const fetchMock = vi.fn().mockResolvedValue(generationsResponse(["CCCC"]));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIImageProvider(makeConfigs({ uuid: () => "uuid-2" }));
    const result = await provider.generate({ params: makeParams() });

    expect(result.taskStatus).toBe(AITaskStatus.SUCCESS);
    expect(result.taskId).toBe("uuid-2");
    expect(result.taskInfo?.images?.[0]?.imageUrl).toBe("data:image/png;base64,CCCC");
  });

  it("throws AIProviderRequestError with statusCode on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("quota exceeded", { status: 429 })),
    );

    const provider = new OpenAIImageProvider(makeConfigs());
    await expect(provider.generate({ params: makeParams() })).rejects.toThrowError(
      AIProviderRequestError,
    );
    await expect(provider.generate({ params: makeParams() })).rejects.toMatchObject({
      name: "AIProviderRequestError",
      provider: "openai",
      statusCode: 429,
    });
  });

  it("throws when mediaType is not image", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIImageProvider(makeConfigs());
    await expect(
      provider.generate({ params: makeParams({ mediaType: AIMediaType.VIDEO }) }),
    ).rejects.toThrow(/mediaType/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clamps options.n to the 1-4 range", async () => {
    const fetchMock = vi.fn().mockResolvedValue(generationsResponse(["DDDD"]));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIImageProvider(makeConfigs());
    await provider.generate({ params: makeParams({ options: { n: 99 } }) });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)) as {
      n: number;
    };
    expect(body.n).toBe(4);
  });
});
