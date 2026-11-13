export type UploadLimitReason = "type" | "size";

export class UploadLimitError extends Error {
  readonly reason: UploadLimitReason;

  constructor(reason: UploadLimitReason, message: string) {
    super(message);
    this.name = "UploadLimitError";
    this.reason = reason;
  }
}

export class StorageUploadError extends Error {
  readonly provider?: string;

  constructor(message: string, provider?: string) {
    super(message);
    this.name = "StorageUploadError";
    this.provider = provider;
  }
}
