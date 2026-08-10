// packages/api/src/storage/service —— 上传编排与 base64 兜底（uploadImage，R18.2/R18.3/R18.4）。
//
// 编排流程（严格按序，校验先于任何持久化）：
//   1. 类型白名单校验：类型不允许 → 拒绝（{@link UploadLimitError}，R18.4）。
//   2. 大小校验：超过所配置上限 → 拒绝（{@link UploadLimitError}，R18.4）。
//   3. 取存储渠道：`getStorage()` 为 `null`（未配置任何渠道）→ 返回 `data:` base64 内联，
//      对该结果解码可还原原始字节（R18.3，Property 37）。
//   4. 有渠道 → 持久化并返回可访问 URL（R18.2）；渠道失败 → {@link StorageUploadError}。
//
// 对象键为内容寻址（`md5(body).<ext>`，对齐 ShipAny），相同内容天然去重、稳定可复现。

import { Buffer } from "node:buffer";
import { md5 } from "@openstarter/shared/hash";
import { StorageUploadError, UploadLimitError } from "./errors";
import { getStorage } from "./manager";

const BYTES_PER_KB = 1024;

/** 允许上传的图片 MIME 类型白名单（对齐 ShipAny 的扩展名映射）。 */
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

/** MIME → 扩展名（用于内容寻址对象键）。 */
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

/** uploadImage 入参：原始字节、内容类型与大小上限（KB，`<=0` 视为不限）。 */
export interface UploadImageParams {
  body: Uint8Array;
  contentType: string;
  maxKb: number;
}

/** uploadImage 结果：可访问 URL 与是否为 base64 内联兜底。 */
export interface UploadImageResult {
  url: string;
  inline: boolean;
}

/** 内容类型是否在允许上传的图片白名单内。 */
export function isAllowedImageType(contentType: string): boolean {
  return ALLOWED_IMAGE_TYPES.has(contentType.toLowerCase());
}

function extForContentType(contentType: string): string {
  return IMAGE_EXTENSIONS[contentType.toLowerCase()] ?? DEFAULT_EXTENSION;
}

/** 内容寻址对象键：`md5(body).<ext>`，相同内容去重。 */
function makeObjectKey(body: Uint8Array, contentType: string): string {
  return `${md5(body)}.${extForContentType(contentType)}`;
}

/** 将字节编码为 base64 字符串（用于 data: 内联兜底，解码可还原原始字节）。 */
function toBase64(body: Uint8Array): string {
  return Buffer.from(body).toString("base64");
}

/**
 * 上传图片编排。类型/大小校验先于任何持久化完成（R18.4）；无存储渠道时返回 `data:` base64
 * 内联兜底（R18.3）；有渠道时持久化并返回可访问 URL（R18.2）。
 */
export async function uploadImage(
  params: UploadImageParams
): Promise<UploadImageResult> {
  const { body, contentType, maxKb } = params;

  // R18.4：类型/大小校验必须在持久化前完成，违反即拒绝（不产生任何存储副作用）。
  if (!isAllowedImageType(contentType)) {
    throw new UploadLimitError(
      "type",
      `Image type '${contentType}' is not allowed`
    );
  }
  if (maxKb > 0 && body.length > maxKb * BYTES_PER_KB) {
    throw new UploadLimitError(
      "size",
      `Image size ${Math.ceil(body.length / BYTES_PER_KB)}KB exceeds the ${maxKb}KB limit`
    );
  }

  // R18.3：未配置任何存储渠道 → base64 内联兜底（对该结果解码可还原原始字节，Property 37）。
  const storage = await getStorage();
  if (!storage) {
    return { url: `data:${contentType};base64,${toBase64(body)}`, inline: true };
  }

  // R18.2：持久化并返回可访问 URL。
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
