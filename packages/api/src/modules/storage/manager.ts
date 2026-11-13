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

function isS3Configured(configs: Record<string, string>): boolean {
  return Boolean(
    configs.storage_endpoint &&
    configs.storage_access_key &&
    configs.storage_secret_key &&
    configs.storage_bucket,
  );
}

function isR2Configured(configs: Record<string, string>): boolean {
  return Boolean(configs.r2_access_key && configs.r2_secret_key && configs.r2_bucket_name);
}

function assembleS3(manager: StorageManager, configs: Record<string, string>): void {
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
    }),
  );
}

function assembleR2(manager: StorageManager, configs: Record<string, string>): void {
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
    }),
  );
}

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

export async function isStorageConfigured(): Promise<boolean> {
  return (await getStorage()) !== null;
}
