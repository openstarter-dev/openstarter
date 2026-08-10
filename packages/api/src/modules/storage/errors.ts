// packages/api/src/storage/errors —— 存储域可识别错误（R18.4）。
//
// 上传超限（类型不在白名单或大小超过所配置上限）以专用 {@link UploadLimitError} 抛出，
// 使路由层能识别并转为结构化 400 响应（对齐 content 域 SlugConflictError / billing
// PaymentProviderUnavailableError 的写法，避免裸抛字符串）。持久化阶段的渠道失败以
// {@link StorageUploadError} 表达，交由 app.onError 统一处理。

/** 上传被拒的原因：类型不允许或大小超限。 */
export type UploadLimitReason = "type" | "size";

/**
 * 上传违反限制错误（R18.4）：类型不在白名单或大小超过所配置上限时抛出，
 * 在任何持久化之前完成校验，故拒绝不产生任何存储副作用。
 */
export class UploadLimitError extends Error {
  readonly reason: UploadLimitReason;

  constructor(reason: UploadLimitReason, message: string) {
    super(message);
    this.name = "UploadLimitError";
    this.reason = reason;
  }
}

/**
 * 存储渠道上传失败错误：provider 返回 `success:false` 或未给出可访问 URL 时抛出，
 * 携带渠道名便于诊断。
 */
export class StorageUploadError extends Error {
  readonly provider?: string;

  constructor(message: string, provider?: string) {
    super(message);
    this.name = "StorageUploadError";
    this.provider = provider;
  }
}
