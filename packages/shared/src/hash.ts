import { createHash } from "node:crypto";

/**
 * 计算输入的 SHA-256 十六进制摘要，主要用于 API Key 的存储与校验。
 */
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * 计算输入的 MD5 十六进制摘要（对齐 ShipAny `lib/hash.ts`）。
 */
export function md5(input: string | Uint8Array): string {
  return createHash("md5").update(input).digest("hex");
}
