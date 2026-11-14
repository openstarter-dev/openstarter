import { randomInt } from "node:crypto";
import { SnowflakeIdv1 } from "simple-flakeid";
import { v4 as uuidv4 } from "uuid";

// Module-level singleton generator to preserve sequence state within the same millisecond
// 模块级雪花算法单例生成器，保留同一毫秒内的序列号递增状态以避免碰撞
const snowflakeGenerator = new SnowflakeIdv1({ workerId: randomInt(0, 1024) });

// Upper bound for 6 base-36 characters (36^6)
// 6 位 36 进制随机字符的数值上限（36^6）
const UNI_SEQ_RANDOM_MAX = 36 ** 6;

/**
 * Generate a UUID v4 string.
 * 生成 UUID v4 字符串。
 */
export function getUuid(): string {
  return uuidv4();
}

/**
 * Generate a snowflake ID with a 2-digit CSPRNG suffix to further reduce collision probability.
 * 生成雪花号（snowflake id）并追加 2 位加密安全随机后缀，降低同一毫秒内的碰撞概率。
 */
export function getSnowId(): string {
  const snowId = snowflakeGenerator.NextId();
  const suffix = randomInt(0, 100).toString().padStart(2, "0");
  return `${snowId}${suffix}`;
}

/**
 * Generate a unique sequence (e.g. order number): `prefix + 6-char random base36 + timestamp(base36)`.
 * 生成唯一序列（如订单号）：`prefix + 6位随机片段(base36) + 时间戳(base36)`。
 */
export function getUniSeq(prefix = ""): string {
  const timestamp = Date.now().toString(36);
  const randomPart = randomInt(0, UNI_SEQ_RANDOM_MAX).toString(36).padStart(6, "0");
  return `${prefix}${randomPart}${timestamp}`;
}
