// packages/api/src/ai/newapi —— New API 中转站供应商测试。
//
// 覆盖：
//   - 图片（OpenAI 兼容）：url / b64_json 两种响应、base URL 归一化、saveFiles 转存；
//   - 视频：创建任务（task_id）、查询 completed / failed、metadata 透传、saveFiles 转存；
//   - 非 2xx → AIProviderRequestError；image 任务不走 query。
// fetch 以 vi.stubGlobal mock，不触网。

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AIProviderRequestError } from "./errors";
import { NewAPIProvider, type NewAPIConfigs } from "./newapi";
import { AIMediaType, AITaskStatus, type AIGenerateParams } from "./types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeConfigs(overrides?: Partial<NewAPIConfigs>): NewAPIConfigs {
  return {
    apiKey: "sk-newapi",
    baseUrl: "https://newapi.example.com/v1",
    ...overrides,
  };
}

function makeParams(overrides?: Partial<AIGenerateParams>): AIGenerateParams {
  return {
    mediaType: AIMediaType.IMAGE,
    prompt: "a cat in space",
    model: "gpt-image-1",
    ...overrides,
  };
}

describe("NewAPIProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("图片：url 结果 + saveFiles 转存", async () => {
    const saveFiles = vi
      .fn()
      .mockResolvedValue([{ url: "https://cdn.example.com/newapi/image/1.png", index: 0 }]);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: [{ url: "https://upstream.example.com/1.png" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new NewAPIProvider(
      makeConfigs({ saveFiles, customStorage: true, uuid: () => "uuid-1" }),
    );
    const result = await provider.generate({ params: makeParams() });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://newapi.example.com/v1/images/generations");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-newapi");
    expect(JSON.parse(String(init.body))).toEqual({
      model: "gpt-image-1",
      prompt: "a cat in space",
      n: 1,
    });

    expect(saveFiles).toHaveBeenCalledTimes(1);
    const files = (saveFiles.mock.calls[0]?.[0] ?? []) as Array<{
      url: string;
      contentType: string;
    }>;
    expect(files[0]?.url).toBe("https://upstream.example.com/1.png");
    expect(files[0]?.contentType).toBe("image/png");

    expect(result.taskStatus).toBe(AITaskStatus.SUCCESS);
    expect(result.taskId).toBe("uuid-1");
    expect(result.taskInfo?.images?.[0]?.imageUrl).toBe(
      "https://cdn.example.com/newapi/image/1.png",
    );
  });

  it("图片：b64_json 转 data URL，未注入存储时原样返回", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ data: [{ b64_json: "AAAA" }] })),
    );

    const provider = new NewAPIProvider(makeConfigs({ uuid: () => "uuid-2" }));
    const result = await provider.generate({
      params: makeParams({ options: { size: "1024x1024" } }),
    });

    expect(result.taskStatus).toBe(AITaskStatus.SUCCESS);
    expect(result.taskInfo?.images?.[0]?.imageUrl).toBe("data:image/png;base64,AAAA");
  });

  it("base URL 只填域名时自动补 /v1；带 path 时保持原样", async () => {
    // 每次调用返回新的 Response（同一个 Response body 只能读取一次）。
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse({ data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await new NewAPIProvider(makeConfigs({ baseUrl: "https://newapi.example.com/" })).generate({
      params: makeParams(),
    });
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      "https://newapi.example.com/v1/images/generations",
    );

    await new NewAPIProvider(makeConfigs({ baseUrl: "https://gw.example.com/api/v1" })).generate({
      params: makeParams(),
    });
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe(
      "https://gw.example.com/api/v1/images/generations",
    );
  });

  it("视频：创建任务透传参数并返回 PENDING + task_id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ task_id: "task-1", status: "queued" }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new NewAPIProvider(makeConfigs());
    const result = await provider.generate({
      params: makeParams({
        mediaType: AIMediaType.VIDEO,
        model: "kling-v2",
        options: {
          image_input: ["https://example.com/ref.png"],
          duration: "5",
          width: 1280,
          height: 720,
          fps: 30,
          seed: 42,
          negative_prompt: "blur",
        },
      }),
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://newapi.example.com/v1/video/generations");
    expect(JSON.parse(String(init.body))).toEqual({
      model: "kling-v2",
      prompt: "a cat in space",
      image: "https://example.com/ref.png",
      duration: 5,
      width: 1280,
      height: 720,
      fps: 30,
      seed: 42,
      metadata: { negative_prompt: "blur" },
    });
    expect(result.taskStatus).toBe(AITaskStatus.PENDING);
    expect(result.taskId).toBe("task-1");
  });

  it("视频：查询 completed 时提取顶层 url 并转存", async () => {
    const saveFiles = vi
      .fn()
      .mockResolvedValue([{ url: "https://cdn.example.com/newapi/video/1.mp4", index: 0 }]);
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        task_id: "task-1",
        status: "completed",
        url: "https://upstream.example.com/v.mp4",
        format: "mp4",
        metadata: { duration: 5 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new NewAPIProvider(
      makeConfigs({ saveFiles, customStorage: true, uuid: () => "uuid-3" }),
    );
    const result = await provider.query({
      taskId: "task-1",
      mediaType: AIMediaType.VIDEO,
      model: "kling-v2",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://newapi.example.com/v1/video/generations/task-1");
    expect((init.method as string) ?? "GET").toBe("GET");

    const files = (saveFiles.mock.calls[0]?.[0] ?? []) as Array<{ contentType: string }>;
    expect(files[0]?.contentType).toBe("video/mp4");
    expect(result.taskStatus).toBe(AITaskStatus.SUCCESS);
    expect(result.taskInfo?.videos?.[0]?.videoUrl).toBe(
      "https://cdn.example.com/newapi/video/1.mp4",
    );
    expect(result.taskInfo?.videos?.[0]?.duration).toBe(5);
  });

  it("视频：查询 failed 时带出 error 信息，不产生 videos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          task_id: "task-2",
          status: "failed",
          error: { code: 1001, message: "content policy violation" },
        }),
      ),
    );

    const provider = new NewAPIProvider(makeConfigs());
    const result = await provider.query({ taskId: "task-2", mediaType: AIMediaType.VIDEO });

    expect(result.taskStatus).toBe(AITaskStatus.FAILED);
    expect(result.taskInfo?.videos).toBeUndefined();
    expect(result.taskInfo?.errorCode).toBe("1001");
    expect(result.taskInfo?.errorMessage).toBe("content policy violation");
  });

  it("非 2xx 抛 AIProviderRequestError（携带状态码）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 })),
    );

    const provider = new NewAPIProvider(makeConfigs());
    await expect(provider.generate({ params: makeParams() })).rejects.toMatchObject({
      name: "AIProviderRequestError",
      provider: "newapi",
      statusCode: 401,
    });
    await expect(provider.generate({ params: makeParams() })).rejects.toBeInstanceOf(
      AIProviderRequestError,
    );
  });

  it("不支持的 mediaType 直接抛错，不发请求", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const provider = new NewAPIProvider(makeConfigs());
    await expect(
      provider.generate({ params: makeParams({ mediaType: AIMediaType.MUSIC }) }),
    ).rejects.toThrow(/mediaType/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("图片任务不通过 query 轮询", async () => {
    const provider = new NewAPIProvider(makeConfigs());
    await expect(provider.query({ taskId: "img-1", mediaType: AIMediaType.IMAGE })).rejects.toThrow(
      /video tasks/,
    );
  });
});
