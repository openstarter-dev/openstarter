// packages/api/src/ai/types —— AI 供应商域抽象与归一化类型（对齐 ShipAny `core/ai/types.ts`，R19.1/R19.2）。
//
// 定义统一的供应商抽象 `AIProvider` 与生成入参 / 任务结果等归一化结构。Replicate（主）与其他
// 受配置启用的供应商（如 Fal）均实现此接口；管理器（manager）与路由分派（service）只依赖此抽象，
// 不感知具体供应商差异。类型集中于此，使各 provider 与 manager 互不成环（对应 ultracite
// 「prevent import cycles」）。
//
// 与参照实现的差异：
//   - 枚举一律以 `as const` 对象 + 同名联合类型表达（遵循 ultracite：禁用 enum）。
//   - 去除 `any`：不透明结果用 `unknown`，选项/输入用 `Record<string, unknown>`。
//   - `AIProvider` 接口仅暴露 `name`/`generate`/`query`（对齐 design.md），不外泄各 provider
//     的凭证 `configs`；凭证由具体 provider 私有持有。

// ─── 媒体类型（as const + 联合类型，禁用 enum） ──────────────────────────────

/** AI 生成的媒体类型。 */
export const AIMediaType = {
  MUSIC: "music",
  IMAGE: "image",
  VIDEO: "video",
  TEXT: "text",
  SPEECH: "speech",
} as const;

export type AIMediaType = (typeof AIMediaType)[keyof typeof AIMediaType];

/** 任务状态（归一化）：等待 / 处理中 / 成功 / 失败 / 取消。 */
export const AITaskStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  SUCCESS: "success",
  FAILED: "failed",
  CANCELED: "canceled",
} as const;

export type AITaskStatus = (typeof AITaskStatus)[keyof typeof AITaskStatus];

// ─── 生成结果值对象（Result value objects） ──────────────────────────────────

/** 生成的歌曲（音乐类）。 */
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

/** 生成的图片。 */
export interface AIImage {
  id?: string;
  createTime?: Date;
  imageType?: string;
  imageUrl?: string;
}

/** 生成的视频。 */
export interface AIVideo {
  id?: string;
  createTime?: Date;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
}

// ─── 生成入参 / 任务结果（Params / Task result） ─────────────────────────────

/**
 * 生成请求参数（归一化，跨供应商通用）。
 * `options` 为供应商/模型特定的自由参数（如 `image_input`、`aspect_ratio`、`duration` 等），
 * 由各 provider 的 `formatInput` 翻译为渠道原生入参。
 */
export interface AIGenerateParams {
  mediaType: AIMediaType;
  prompt: string;
  model?: string;
  options?: Record<string, unknown>;
  callbackUrl?: string;
  stream?: boolean;
  async?: boolean;
}

/** 任务信息（归一化）：按媒体类型承载结果，并含状态与可读错误。 */
export interface AITaskInfo {
  songs?: AISong[];
  images?: AIImage[];
  videos?: AIVideo[];
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  createTime?: Date;
}

/**
 * 任务结果（归一化，`generate`/`query` 的返回）。
 * 字段与 `ai_task` 表（taskId / taskInfo / taskResult / status）对应，便于任务与积分联动
 * （任务 27）直接消费：`taskStatus` 决定任务状态流转，`taskId` 为供应商侧任务句柄，
 * `taskResult` 为渠道原始响应（不透明，`unknown`）。
 */
export interface AITaskResult {
  taskStatus: AITaskStatus;
  taskId: string;
  taskInfo?: AITaskInfo;
  taskResult?: unknown;
}

// ─── 存储注入（Injected storage capability） ─────────────────────────────────

/**
 * 待落库的生成文件描述：`url` 为供应商侧临时地址，`key` 为目标对象键，
 * `index` 供回写到对应结果项（图片/视频）。
 */
export interface AIFile {
  url: string;
  contentType: string;
  key: string;
  index?: number;
  type?: string;
}

/**
 * 保存文件回调（可注入）：把供应商产出的临时文件转存到对象存储，返回带可访问 URL 的结果。
 * 由调用方（api 层）用 `packages/api/storage` 的上传能力提供；AI 模块只持有并调用此回调，
 * 不直接依赖具体存储实现，保持内聚与可测（R19.1 setSaveFiles 注入）。
 */
export type SaveFilesFunction = (
  files: AIFile[]
) => Promise<AIFile[] | undefined>;

/** UUID 生成器（可注入，默认用 `@openstarter/shared/id` 的 getUuid）。 */
export type UuidFunction = () => string;

/**
 * 各 provider 均可接收的注入项：存储回调、UUID 生成器、以及是否启用自定义存储
 * （`customStorage` 为真且提供了 `saveFiles` 时，成功结果的文件会被转存到对象存储）。
 */
export interface AIProviderInjection {
  saveFiles?: SaveFilesFunction;
  uuid?: UuidFunction;
  customStorage?: boolean;
}

// ─── 供应商抽象接口（Provider abstraction，R19.1/R19.2） ──────────────────────

/**
 * 统一 AI 供应商抽象接口。Replicate（主）与其他受配置启用的供应商均实现此接口，
 * 业务侧（管理器、路由分派）只依赖此抽象、不感知渠道差异（R19.1）。
 * - `generate`：依 `params` 发起生成，返回归一化 {@link AITaskResult}（异步供应商返回任务句柄）。
 * - `query`：按任务句柄查询状态与结果（同步型供应商可不实现）。
 */
export interface AIProvider {
  readonly name: string;

  generate(args: { params: AIGenerateParams }): Promise<AITaskResult>;

  query?(args: {
    taskId: string;
    mediaType?: AIMediaType;
    model?: string;
  }): Promise<AITaskResult>;
}
