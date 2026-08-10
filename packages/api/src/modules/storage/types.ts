// packages/api/src/storage/types —— 存储域抽象与归一化类型（对齐 ShipAny `core/storage`，R18.1）。
//
// 定义统一的存储渠道抽象 `StorageProvider` 与上传选项/结果结构。S3 兼容存储与 Cloudflare R2
// （R2 即 S3 兼容端点）均实现此接口；上传编排（`service.uploadImage`）与管理器只依赖此抽象，
// 不感知具体渠道差异。类型集中于此，使 provider（s3/r2）与 manager 互不成环（对应 ultracite
// 「prevent import cycles」）。

/** 文件展示方式：内联预览或作为附件下载。 */
export type StorageDisposition = "inline" | "attachment";

/** 上传选项：`body` 为原始字节，`key` 为对象键（相对路径，不含桶名）。 */
export interface StorageUploadOptions {
  body: Uint8Array;
  key: string;
  contentType?: string;
  bucket?: string;
  disposition?: StorageDisposition;
}

/** 远端下载再转存的选项（供后续域按 URL 转存复用）。 */
export interface StorageDownloadUploadOptions {
  url: string;
  key: string;
  bucket?: string;
  contentType?: string;
  disposition?: StorageDisposition;
}

/** 上传结果（归一化）。成功时 `url` 为可访问地址（R18.2）。 */
export interface StorageUploadResult {
  success: boolean;
  location?: string;
  bucket?: string;
  uploadPath?: string;
  key?: string;
  filename?: string;
  url?: string;
  error?: string;
  provider: string;
}

/**
 * 统一存储渠道抽象接口（R18.1）。S3 兼容存储与 Cloudflare R2 均实现此接口，
 * 业务侧只依赖此抽象、不感知渠道差异。
 * - `uploadFile`：上传字节并返回归一化 {@link StorageUploadResult}（含可访问 `url`）。
 * - `downloadAndUpload`：从远端 URL 拉取后转存。
 * - `exists` / `getPublicUrl`：可选能力（对象是否存在、公开 URL 推导）。
 */
export interface StorageProvider {
  readonly name: string;

  uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult>;

  downloadAndUpload(
    options: StorageDownloadUploadOptions
  ): Promise<StorageUploadResult>;

  exists?(options: { key: string; bucket?: string }): Promise<boolean>;

  getPublicUrl?(options: { key: string; bucket?: string }): string;
}
