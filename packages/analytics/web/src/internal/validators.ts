// @openstarter/analytics-web/internal —— 供应商标识校验（XSS 边界，R25.1 / R25.2）。
//
// 这些校验是「脚本注入」的安全前提：标识一旦被插值进内联脚本，就必须保证它无法断开引号
// 或注入 `</script>`。因此校验采用**严格白名单**（不是黑名单过滤），任一不合规即跳过该
// 供应商——宁可不采数据，也不能把配置字符串原样当可执行代码注入。
//
// 放在 internal/ 而非 src 根：这是脚本模板与供应商判定共用的实现细节，公开出口是
// ../scripts.ts（对外暴露 isValidMeasurementId 等函数）。

// 度量 ID 允许字符集：字母/数字/连字符/下划线（覆盖 GA 的 `G-XXXX`/`UA-XXXX-Y`/`AW-XXX` 等）。
const MEASUREMENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_MEASUREMENT_ID_LENGTH = 64;

// Plausible 域名允许字符集：字母/数字/点/连字符/下划线，多域以逗号分隔。
const PLAUSIBLE_DOMAIN_PATTERN = /^[A-Za-z0-9.,_-]+$/;
const MAX_DOMAIN_LENGTH = 253;

// Plausible 官方云端默认脚本地址（未配置或自托管地址不合规时回退）。
const DEFAULT_PLAUSIBLE_SRC = "https://plausible.io/js/script.js";

/** 校验度量 ID：非空、长度受限、且仅含允许字符集。 */
export function isValidMeasurementId(id: string): boolean {
  return id.length > 0 && id.length <= MAX_MEASUREMENT_ID_LENGTH && MEASUREMENT_ID_PATTERN.test(id);
}

/** 校验 Plausible 域名：非空、长度受限、且仅含允许字符集。 */
export function isValidPlausibleDomain(domain: string): boolean {
  return (
    domain.length > 0 && domain.length <= MAX_DOMAIN_LENGTH && PLAUSIBLE_DOMAIN_PATTERN.test(domain)
  );
}

/** 归一 Plausible 脚本 URL：仅接受合法 https 绝对 URL，否则回退官方默认。 */
export function resolvePlausibleSrc(src: string): string {
  if (src === "") {
    return DEFAULT_PLAUSIBLE_SRC;
  }
  try {
    const url = new URL(src);
    if (url.protocol === "https:") {
      return url.href;
    }
  } catch {
    return DEFAULT_PLAUSIBLE_SRC;
  }
  return DEFAULT_PLAUSIBLE_SRC;
}
