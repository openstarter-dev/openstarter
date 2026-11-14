import { readEnv } from "../../lib/env";
import { createR2Provider } from "./r2";
import { createS3Provider } from "./s3";
import type {
  StorageDownloadUploadOptions,
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
} from "./types";

const DEFAULT_R2_REGION = "auto";

export class StorageManager {
  private readonly providers: StorageProvider[] = [];
  private defaultProvider?: StorageProvider;

  addProvider(provider: StorageProvider, isDefault = false): void {
    this.providers.push(provider);
    if (isDefault) {
      this.defaultProvider = provider;
    }
  }

  getProvider(name: string): StorageProvider | undefined {
    return this.providers.find((p) => p.name === name);
  }

  getProviderNames(): string[] {
    return this.providers.map((p) => p.name);
  }

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

  uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult> {
    return this.ensureDefaultProvider().uploadFile(options);
  }

  downloadAndUpload(options: StorageDownloadUploadOptions): Promise<StorageUploadResult> {
    return this.ensureDefaultProvider().downloadAndUpload(options);
  }

  exists(options: { key: string; bucket?: string }): Promise<boolean> {
    const provider = this.ensureDefaultProvider();
    return provider.exists ? provider.exists(options) : Promise.resolve(false);
  }

  getPublicUrl(options: { key: string; bucket?: string }): string | undefined {
    return this.ensureDefaultProvider().getPublicUrl?.(options);
  }
}

let cachedManager: StorageManager | null = null;
let cachedHash = "";
let hasCache = false;

const STORAGE_ENV_KEYS = [
  "STORAGE_ENDPOINT",
  "STORAGE_REGION",
  "STORAGE_ACCESS_KEY",
  "STORAGE_SECRET_KEY",
  "STORAGE_BUCKET",
  "STORAGE_PUBLIC_DOMAIN",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY",
  "R2_SECRET_KEY",
  "R2_BUCKET_NAME",
  "R2_UPLOAD_PATH",
  "R2_ENDPOINT",
  "R2_DOMAIN",
] as const;

type StorageAssembler = () => StorageProvider | null;

// Declarative storage provider registry; builds S3/R2 only when required credentials are present.
// 存储渠道注册表；仅当必需凭证环境变量齐备时装配 S3/R2 实例。
const STORAGE_ASSEMBLERS: readonly StorageAssembler[] = [
  () => {
    const endpoint = readEnv("STORAGE_ENDPOINT");
    const accessKeyId = readEnv("STORAGE_ACCESS_KEY");
    const secretAccessKey = readEnv("STORAGE_SECRET_KEY");
    const bucket = readEnv("STORAGE_BUCKET");
    if (!(endpoint && accessKeyId && secretAccessKey && bucket)) {
      return null;
    }
    return createS3Provider({
      endpoint,
      region: readEnv("STORAGE_REGION") || DEFAULT_R2_REGION,
      accessKeyId,
      secretAccessKey,
      bucket,
      publicDomain: readEnv("STORAGE_PUBLIC_DOMAIN") || undefined,
    });
  },
  () => {
    const accessKeyId = readEnv("R2_ACCESS_KEY");
    const secretAccessKey = readEnv("R2_SECRET_KEY");
    const bucket = readEnv("R2_BUCKET_NAME");
    if (!(accessKeyId && secretAccessKey && bucket)) {
      return null;
    }
    return createR2Provider({
      accountId: readEnv("R2_ACCOUNT_ID") || undefined,
      accessKeyId,
      secretAccessKey,
      bucket,
      uploadPath: readEnv("R2_UPLOAD_PATH") || undefined,
      region: DEFAULT_R2_REGION,
      endpoint: readEnv("R2_ENDPOINT") || undefined,
      publicDomain: readEnv("R2_DOMAIN") || undefined,
    });
  },
];

function computeEnvHash(): string {
  return JSON.stringify(STORAGE_ENV_KEYS.map((key) => readEnv(key)));
}

/**
 * Assemble configured storage providers from runtime environment variables with fingerprint cache.
 * 从运行时环境变量装配存储渠道，并按配置指纹缓存管理器实例。
 */
export async function getStorage(): Promise<StorageManager | null> {
  const hash = computeEnvHash();

  if (hasCache && hash === cachedHash) {
    return cachedManager;
  }

  const manager = new StorageManager();
  for (const build of STORAGE_ASSEMBLERS) {
    const provider = build();
    if (provider) {
      manager.addProvider(provider);
    }
  }
  const result = manager.getProviderNames().length > 0 ? manager : null;

  cachedManager = result;
  cachedHash = hash;
  hasCache = true;
  return result;
}

export async function isStorageConfigured(): Promise<boolean> {
  return (await getStorage()) !== null;
}
