// packages/api/src/storage/manager —— 存储渠道管理器与「按 Config 动态装配」
// （对齐 ShipAny `core/storage/index.ts` 的 StorageManager 与 `modules/storage/service.ts`
// 的 getStorage，R18.1）。
//
// - `StorageManager`：登记/取用已装配 provider 的容器；默认渠道取首个登记者。
// - `getStorage()`：读取 Config（`@openstarter/shared` 的 config 服务），按「渠道凭证齐备」
//   装配 S3 兼容 + Cloudflare R2 provider；**任一渠道都未配置时返回 `null`**——这是上传编排
//   走 base64 内联兜底（R18.3）的关键分支。相关 Config 未变时复用缓存实例（含 `null`），
//   变化时（hash 改变）重建（对齐 billing getPaymentManager）。
//
// 装配来源（均从 Config 读取，不硬编码凭证）：
//   - S3 兼容：`storage_endpoint` / `storage_region` / `storage_access_key` /
//     `storage_secret_key` / `storage_bucket` / `storage_public_domain`。
//   - Cloudflare R2：`r2_access_key` / `r2_secret_key` / `r2_bucket_name` /
//     `r2_account_id` / `r2_endpoint` / `r2_upload_path` / `r2_domain`。
// 两者同时配置时，S3（通用兼容端点）先登记并作为默认渠道，R2 次之。

import { getAllConfigs } from "@openstarter/shared/config";
import { createR2Provider } from "./r2";
import { createS3Provider } from "./s3";
import type {
  StorageDownloadUploadOptions,
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
} from "./types";

const DEFAULT_R2_REGION = "auto";

/**
 * 存储渠道管理器：持有一组已装配的 provider，默认渠道为首个登记者。
 * 上传编排经此统一入口 `uploadFile` 使用默认渠道，不感知具体渠道差异。
 */
export class StorageManager {
  private readonly providers: StorageProvider[] = [];
  private defaultProvider?: StorageProvider;

  /** 登记一个 provider；`isDefault` 为真时显式设为默认渠道。 */
  addProvider(provider: StorageProvider, isDefault = false): void {
    this.providers.push(provider);
    if (isDefault) {
      this.defaultProvider = provider;
    }
  }

  /** 按渠道名取 provider；不存在返回 `undefined`。 */
  getProvider(name: string): StorageProvider | undefined {
    return this.providers.find((p) => p.name === name);
  }

  /** 已装配的全部渠道名。 */
  getProviderNames(): string[] {
    return this.providers.map((p) => p.name);
  }

  /** 默认渠道：显式设定优先，否则取首个已装配渠道；无 provider 时抛错。 */
  private ensureDefaultProvider(): StorageProvider {
    if (!this.defaultProvider) {
      const [first] = this.providers;
      if (first) {
        this.defaultProvider = first;
      }
    }
    if (!this.defaultProvider) {
      throw new Error("No storage provider configured");
    }
    return this.defaultProvider;
  }

  /** 用默认渠道上传字节，返回归一化结果（含可访问 URL）。 */
  uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult> {
    return this.ensureDefaultProvider().uploadFile(options);
  }

  /** 用默认渠道从远端 URL 拉取后转存。 */
  downloadAndUpload(
    options: StorageDownloadUploadOptions
  ): Promise<StorageUploadResult> {
    return this.ensureDefaultProvider().downloadAndUpload(options);
  }

  /** 默认渠道是否存在指定对象（渠道不支持时返回 false）。 */
  exists(options: { key: string; bucket?: string }): Promise<boolean> {
    const provider = this.ensureDefaultProvider();
    return provider.exists ? provider.exists(options) : Promise.resolve(false);
  }

  /** 默认渠道的公开 URL（渠道不支持时返回 undefined）。 */
  getPublicUrl(options: { key: string; bucket?: string }): string | undefined {
    return this.ensureDefaultProvider().getPublicUrl?.(options);
  }
}

// ─── 按 Config 动态装配（含 hash 重建，R18.1） ───────────────────────────────

let cachedManager: StorageManager | null = null;
let cachedHash = "";
let hasCache = false;

/** S3 兼容渠道是否凭证齐备（端点 + 访问密钥 + 桶）。 */
function isS3Configured(configs: Record<string, string>): boolean {
  return Boolean(
    configs.storage_endpoint &&
      configs.storage_access_key &&
      configs.storage_secret_key &&
      configs.storage_bucket
  );
}

/** Cloudflare R2 渠道是否凭证齐备（访问密钥 + 桶，对齐 ShipAny 的判定）。 */
function isR2Configured(configs: Record<string, string>): boolean {
  return Boolean(
    configs.r2_access_key && configs.r2_secret_key && configs.r2_bucket_name
  );
}

function assembleS3(
  manager: StorageManager,
  configs: Record<string, string>
): void {
  if (!isS3Configured(configs)) {
    return;
  }
  manager.addProvider(
    createS3Provider({
      endpoint: configs.storage_endpoint || "",
      region: configs.storage_region || DEFAULT_R2_REGION,
      accessKeyId: configs.storage_access_key || "",
      secretAccessKey: configs.storage_secret_key || "",
      bucket: configs.storage_bucket || "",
      publicDomain: configs.storage_public_domain || undefined,
    })
  );
}

function assembleR2(
  manager: StorageManager,
  configs: Record<string, string>
): void {
  if (!isR2Configured(configs)) {
    return;
  }
  manager.addProvider(
    createR2Provider({
      accountId: configs.r2_account_id || undefined,
      accessKeyId: configs.r2_access_key || "",
      secretAccessKey: configs.r2_secret_key || "",
      bucket: configs.r2_bucket_name || "",
      uploadPath: configs.r2_upload_path || undefined,
      region: DEFAULT_R2_REGION,
      endpoint: configs.r2_endpoint || undefined,
      publicDomain: configs.r2_domain || undefined,
    })
  );
}

/** 存储相关 Config 指纹：任一相关键变化即触发管理器重建。 */
function computeConfigHash(configs: Record<string, string>): string {
  return JSON.stringify([
    configs.storage_endpoint || "",
    configs.storage_region || "",
    configs.storage_access_key || "",
    configs.storage_secret_key || "",
    configs.storage_bucket || "",
    configs.storage_public_domain || "",
    configs.r2_account_id || "",
    configs.r2_access_key || "",
    configs.r2_secret_key || "",
    configs.r2_bucket_name || "",
    configs.r2_upload_path || "",
    configs.r2_endpoint || "",
    configs.r2_domain || "",
  ]);
}

/**
 * 读取 Config 并装配已启用存储渠道；返回可用的 {@link StorageManager}，
 * **任一渠道都未配置时返回 `null`**（供上传编排走 base64 内联兜底，R18.3）。
 * 相关 Config 未变时复用缓存（含 `null`），变化时重建。
 */
export async function getStorage(): Promise<StorageManager | null> {
  const configs = await getAllConfigs();
  const hash = computeConfigHash(configs);

  if (hasCache && hash === cachedHash) {
    return cachedManager;
  }

  const manager = new StorageManager();
  assembleS3(manager, configs);
  assembleR2(manager, configs);
  const result = manager.getProviderNames().length > 0 ? manager : null;

  cachedManager = result;
  cachedHash = hash;
  hasCache = true;
  return result;
}

/** 是否已配置任一存储渠道（等价 `getStorage() !== null`，供调用方快速判断）。 */
export async function isStorageConfigured(): Promise<boolean> {
  return (await getStorage()) !== null;
}
