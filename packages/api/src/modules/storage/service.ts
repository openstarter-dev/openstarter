import { Buffer } from "node:buffer";
import { getAllConfigs } from "@openstarter/shared/config";
import { md5 } from "@openstarter/shared/hash";
import { StorageUploadError, UploadLimitError } from "./errors";
import { getStorage } from "./manager";

const BYTES_PER_KB = 1024;

const DEFAULT_MAX_KB = 2048;

const ALLOWED_IMAGE_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
  "image/heic",
  "image/heif",
]);

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
};

const DEFAULT_EXTENSION = "bin";

export interface UploadImageParams {
  body: Uint8Array;
  contentType: string;
  maxKb: number;
}

export interface UploadImageResult {
  url: string;
  inline: boolean;
}

export function isAllowedImageType(contentType: string): boolean {
  return ALLOWED_IMAGE_TYPES.has(contentType.toLowerCase());
}

function extForContentType(contentType: string): string {
  return IMAGE_EXTENSIONS[contentType.toLowerCase()] ?? DEFAULT_EXTENSION;
}

function makeObjectKey(body: Uint8Array, contentType: string): string {
  return `${md5(body)}.${extForContentType(contentType)}`;
}

function toBase64(body: Uint8Array): string {
  return Buffer.from(body).toString("base64");
}

export async function uploadImage(params: UploadImageParams): Promise<UploadImageResult> {
  const { body, contentType, maxKb } = params;

  if (!isAllowedImageType(contentType)) {
    throw new UploadLimitError("type", `Image type '${contentType}' is not allowed`);
  }
  if (maxKb > 0 && body.length > maxKb * BYTES_PER_KB) {
    throw new UploadLimitError(
      "size",
      `Image size ${Math.ceil(body.length / BYTES_PER_KB)}KB exceeds the ${maxKb}KB limit`,
    );
  }

  const storage = await getStorage();
  if (!storage) {
    return { url: `data:${contentType};base64,${toBase64(body)}`, inline: true };
  }

  const result = await storage.uploadFile({
    body,
    key: makeObjectKey(body, contentType),
    contentType,
    disposition: "inline",
  });
  if (!(result.success && result.url)) {
    throw new StorageUploadError(result.error ?? "upload failed", result.provider);
  }
  return { url: result.url, inline: false };
}

export interface UploadInput {
  body: Uint8Array;
  contentType: string;
  filename?: string;
}

export interface UploadBatchResult {
  results: Array<{ filename?: string; inline: boolean; url: string }>;
  urls: string[];
}

export async function resolveUploadLimitKb(): Promise<number> {
  const configs = await getAllConfigs();
  const raw = Number(configs.inline_image_max_kb);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_KB;
}

export async function uploadImages(inputs: UploadInput[]): Promise<UploadBatchResult> {
  const maxKb = await resolveUploadLimitKb();
  const uploaded = await Promise.all(
    inputs.map((input) => uploadImage({ body: input.body, contentType: input.contentType, maxKb })),
  );

  return {
    results: uploaded.map((result, index) => ({
      filename: inputs[index]?.filename,
      inline: result.inline,
      url: result.url,
    })),
    urls: uploaded.map((result) => result.url),
  };
}
