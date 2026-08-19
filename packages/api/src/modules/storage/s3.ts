// packages/api/src/storage/s3 —— S3 兼容存储 provider（对齐 ShipAny `core/storage/s3.ts`）。
//
// 以 `aws4fetch` 的 `AwsClient` 做 SigV4 请求签名 + `fetch` 直传（避免引入重型 AWS SDK，
// 与参照实现一致）。适配任意 S3 兼容端点（AWS S3、MinIO 等）。上传/存在性检查失败时返回
// 结构化 {@link StorageUploadResult}（`success:false` + `error`），不抛未捕获异常。

import { AwsClient } from "aws4fetch";
import type {
  StorageDownloadUploadOptions,
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
} from "./types";

/** S3 兼容存储配置。`publicDomain` 存在时用于生成对外可访问 URL（CDN/自定义域）。 */
export interface S3Configs {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicDomain?: string;
}

const DEFAULT_CONTENT_TYPE = "application/octet-stream";
const DEFAULT_DISPOSITION = "inline";

/** S3 兼容存储 provider 实现。 */
export class S3Provider implements StorageProvider {
  readonly name = "s3";
  private readonly configs: S3Configs;
  private readonly client: AwsClient;

  constructor(configs: S3Configs) {
    this.configs = configs;
    this.client = new AwsClient({
      accessKeyId: configs.accessKeyId,
      secretAccessKey: configs.secretAccessKey,
      region: configs.region,
    });
  }

  getPublicUrl(options: { key: string; bucket?: string }): string {
    const bucket = options.bucket || this.configs.bucket;
    const endpointUrl = `${this.configs.endpoint}/${bucket}/${options.key}`;
    return this.configs.publicDomain ? `${this.configs.publicDomain}/${options.key}` : endpointUrl;
  }

  async exists(options: { key: string; bucket?: string }): Promise<boolean> {
    const bucket = options.bucket || this.configs.bucket;
    if (!bucket) {
      return false;
    }
    try {
      const url = `${this.configs.endpoint}/${bucket}/${options.key}`;
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
      const url = `${this.configs.endpoint}/${bucket}/${options.key}`;
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

/** 用给定配置创建 S3 provider。 */
export function createS3Provider(configs: S3Configs): S3Provider {
  return new S3Provider(configs);
}
