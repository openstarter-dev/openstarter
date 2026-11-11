// 属性裁剪 —— 供应商对自定义属性都有限制，超出部分会被静默丢弃或截断：
//   - Plausible：单事件 props 上限约 30 个；
//   - GA4 / Firebase：参数值有长度限制，嵌套对象不被支持；
//   - OpenPanel：接受嵌套但会对超大对象做截断。
// 与其让各家 SDK 各自静默处理，不如在进入 provider 前统一裁剪：限制键数量、字符串长度、
// 嵌套深度，并丢弃无法序列化的值（function / symbol / undefined）。这样跨端事件的形状
// 一致，也顺手降低了把 PII 大对象整体透传的风险。

import type { EventProperties } from "../types";

/** 单事件最多保留的属性个数（对齐最严格的 Plausible）。 */
const MAX_KEYS = 30;
/** 字符串值最大长度。 */
const MAX_STRING_LENGTH = 256;
/** 允许的最大嵌套深度（0 = 只保留标量）。 */
const MAX_DEPTH = 2;

function sanitizeValue(value: unknown, depth: number): unknown {
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) : value;
  }

  if (typeof value === "number") {
    // NaN / Infinity 不是合法 JSON，供应商会拒绝整条事件
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) {
      return undefined;
    }
    const items = value
      .map((item) => sanitizeValue(item, depth + 1))
      .filter((item) => item !== undefined);
    return items.length > 0 ? items : undefined;
  }

  if (typeof value === "object" && value !== null) {
    if (depth >= MAX_DEPTH) {
      return undefined;
    }
    const nested = sanitizePropertiesInternal(value as EventProperties, depth + 1);
    return nested;
  }

  // function / symbol / bigint / undefined 一律丢弃
  return undefined;
}

function sanitizePropertiesInternal(
  properties: EventProperties,
  depth: number,
): EventProperties | undefined {
  const result: EventProperties = {};
  let count = 0;

  for (const [key, value] of Object.entries(properties)) {
    if (count >= MAX_KEYS) {
      break;
    }
    const sanitized = sanitizeValue(value, depth);
    if (sanitized !== undefined) {
      result[key] = sanitized;
      count += 1;
    }
  }

  return count > 0 ? result : undefined;
}

/**
 * 裁剪事件属性：返回新对象（不修改入参）；无有效属性时返回 undefined。
 * 契约要求永不抛错——任何意外输入都退化为 undefined 而不是异常。
 */
export function sanitizeProperties(properties?: EventProperties): EventProperties | undefined {
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return undefined;
  }

  try {
    return sanitizePropertiesInternal(properties, 0);
  } catch {
    // 循环引用等异常输入：放弃属性而不是让整条事件失败
    return undefined;
  }
}
