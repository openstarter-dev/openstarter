import { SnowflakeIdv1 } from "simple-flakeid";
import { v4 as uuidv4 } from "uuid";

/**
 * 生成 UUID v4 字符串。
 */
export function getUuid(): string {
  return uuidv4();
}

/**
 * 生成雪花号（snowflake id）并追加 2 位随机后缀，降低同一毫秒内的碰撞概率。
 * 对齐 ShipAny `lib/hash.ts` 的 `getSnowId` 行为。
 */
export function getSnowId(): string {
  const workerId = Math.floor(Math.random() * 1024);
  const generator = new SnowflakeIdv1({ workerId });
  const snowId = generator.NextId();
  const suffix = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, "0");
  return `${snowId}${suffix}`;
}

/**
 * 生成唯一序列（如订单号）：`prefix + 随机片段 + 时间戳(base36)`。
 * 对齐 ShipAny `lib/hash.ts` 的 `getUniSeq` 行为。
 */
export function getUniSeq(prefix = ""): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}${randomPart}${timestamp}`;
}
