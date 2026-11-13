export type StorageDisposition = "inline" | "attachment";

export interface StorageUploadOptions {
  body: Uint8Array;
  key: string;
  contentType?: string;
  bucket?: string;
  disposition?: StorageDisposition;
}

export interface StorageDownloadUploadOptions {
  url: string;
  key: string;
  bucket?: string;
  contentType?: string;
  disposition?: StorageDisposition;
}

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

export interface StorageProvider {
  readonly name: string;

  uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult>;

  downloadAndUpload(options: StorageDownloadUploadOptions): Promise<StorageUploadResult>;

  exists?(options: { key: string; bucket?: string }): Promise<boolean>;

  getPublicUrl?(options: { key: string; bucket?: string }): string;
}
