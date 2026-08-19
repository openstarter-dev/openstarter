import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * config 秘密项的静态加密工具（AES-256-GCM），用于将后台设置中的敏感配置
 * 加密后落库，抵御「仅数据库泄露」（备份泄露、SQL 注入导出）。
 *
 * 加密值自描述为 `enc:v1:<base64(iv | authTag | ciphertext)>`；明文（无前缀）
 * 在 `decryptSecret` 中原样返回，兼容历史明文行。
 *
 * 密钥来源：环境变量 `CONFIG_ENCRYPTION_KEY`。与 ShipAny「缺省即禁用加密」不同，
 * 本实现按 R3.4 要求在密钥缺失时抛出明确错误，避免秘密以明文静默落库。
 */

const ENC_PREFIX = "enc:v1:";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * 读取加密密钥并派生 32 字节 AES-256 密钥。
 * 缺失 `CONFIG_ENCRYPTION_KEY` 时抛出明确错误（R3.4）。
 */
function deriveEncryptionKey(): Buffer {
  const secret = process.env.CONFIG_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      'Missing required environment variable "CONFIG_ENCRYPTION_KEY" for config secret encryption',
    );
  }
  return createHash("sha256").update(secret).digest();
}

/**
 * 判断值是否为本模块加密后的密文（携带 `enc:v1:` 前缀）。
 */
export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}

/**
 * 加密秘密以便落库。空字符串或已加密值原样返回；
 * 需要加密但 `CONFIG_ENCRYPTION_KEY` 缺失时抛出明确错误（R3.4）。
 */
export function encryptSecret(plain: string): string {
  if (!plain || isEncryptedSecret(plain)) {
    return plain;
  }
  const key = deriveEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, ciphertext]);
  return `${ENC_PREFIX}${packed.toString("base64")}`;
}

/**
 * 解密落库的秘密。明文（无前缀）原样返回；密文但 `CONFIG_ENCRYPTION_KEY`
 * 缺失时抛出明确错误（R3.4）；密文结构非法时抛出错误。
 */
export function decryptSecret(value: string): string {
  if (!isEncryptedSecret(value)) {
    return value;
  }
  const key = deriveEncryptionKey();
  const packed = Buffer.from(value.slice(ENC_PREFIX.length), "base64");
  if (packed.length <= IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid encrypted secret: payload too short");
  }
  const iv = packed.subarray(0, IV_LENGTH);
  const tag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
