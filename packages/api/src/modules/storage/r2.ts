// packages/api/src/storage/r2 —— Cloudflare R2 存储 provider（对齐 ShipAny `core/storage/r2.ts`）。
//
// R2 为 S3 兼容端点：同样以 `aws4fetch` 的 `AwsClient`（region 固定 `auto`）做 SigV4 签名直传。
// 相较 S3，R2 在对象键前追加可配置的 `uploadPath` 前缀，端点默认取
// `https://<accountId>.r2.cloudflarestorage.com`（可被自定义 `endpoint` 覆盖）。

import { AwsClient } from "aws4fetch";
import type {
  StorageDownloadUploadOptions,
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
} from "./types";

/** Cloudflare R2 配置。`accountId` 或 `endpoint` 至少其一用于定位端点。 */
export interface R2Configs {
  accountId?: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  uploadPath?: string;
  region?: string;
  endpoint?: string;
  publicDomain?: string;
}

const DEFAULT_CONTENT_TYPE = "application/octet-stream";
const DEFAULT_DISPOSITION = "inline";
const DEFAULT_REGION = "auto";
const DEFAULT_UPLOAD_PATH = "uploads";
const LEADING_SLASHES = /^\/+/;
const TRAILING_SLASHES = /\/+$/;

/** Cloudflare R2 存储 provider 实现。 */
export class R2Provider implements StorageProvider {
  readonly name = "r2";
  private readonly configs: R2Configs;
  private readonly client: AwsClient;

  constructor(configs: R2Configs) {
    this.configs = configs;
    this.client = new AwsClient({
      accessKeyId: configs.accessKeyId,
      secretAccessKey: configs.secretAccessKey,
      region: configs.region || DEFAULT_REGION,
    });
  }

  private getUploadPath(): string {
    const raw = this.configs.uploadPath || DEFAULT_UPLOAD_PATH;
    return raw.replace(LEADING_SLASHES, "").replace(TRAILING_SLASHES, "");
  }

  private getEndpoint(): string {
    return this.configs.endpoint || `https://${this.configs.accountId}.r2.cloudflarestorage.com`;
  }

  getPublicUrl(options: { key: string; bucket?: string }): string {
    const bucket = options.bucket || this.configs.bucket;
    const uploadPath = this.getUploadPath();
    const endpointUrl = `${this.getEndpoint()}/${bucket}/${uploadPath}/${options.key}`;
    return this.configs.publicDomain
      ? `${this.configs.publicDomain}/${uploadPath}/${options.key}`
      : endpointUrl;
  }

  async exists(options: { key: string; bucket?: string }): Promise<boolean> {
    const bucket = options.bucket || this.configs.bucket;
    if (!bucket) {
      return false;
    }
    try {
      const uploadPath = this.getUploadPath();
      const url = `${this.getEndpoint()}/${bucket}/${uploadPath}/${options.key}`;
      const response = await this.client.fetch(url, { method: "HEAD" });
      return response.ok;
    } catch {
      return false;
    }
  }

  async uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult> {
    const bucket = options.bucket || this.configs.bucket;
    if (!bucket) {
      return { success: false, error: "Bucket is required", provider: this.name };
    }

    try {
      const uploadPath = this.getUploadPath();
      const url = `${this.getEndpoint()}/${bucket}/${uploadPath}/${options.key}`;
      const response = await this.client.fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": options.contentType || DEFAULT_CONTENT_TYPE,
          "Content-Disposition": options.disposition || DEFAULT_DISPOSITION,
          "Content-Length": options.body.length.toString(),
        },
        // aws4fetch 需按字节内容计算 SigV4 签名，故必须直传 ArrayBufferView（不可用 Blob）。
        // `Uint8Array` 在运行时即合法 body，此处仅消解 `ArrayBufferLike` 与 `BodyInit` 期望的
        // `ArrayBuffer` 泛型差异（零成本，非运行时转换）。
        body: options.body as BodyInit,
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Upload failed: ${response.statusText}`,
          provider: this.name,
        };
      }

      return {
        success: true,
        location: url,
        bucket,
        uploadPath,
        key: options.key,
        filename: options.key.split("/").pop(),
        url: this.getPublicUrl({ key: options.key, bucket }),
        provider: this.name,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        provider: this.name,
      };
    }
  }

  async downloadAndUpload(options: StorageDownloadUploadOptions): Promise<StorageUploadResult> {
    try {
      const response = await fetch(options.url);
      if (!response.ok) {
        return {
          success: false,
          error: `HTTP error! status: ${response.status}`,
          provider: this.name,
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      return await this.uploadFile({
        body: new Uint8Array(arrayBuffer),
        key: options.key,
        bucket: options.bucket,
        contentType: options.contentType,
        disposition: options.disposition,
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        provider: this.name,
      };
    }
  }
}

/** 用给定配置创建 R2 provider。 */
export function createR2Provider(configs: R2Configs): R2Provider {
  return new R2Provider(configs);
}
