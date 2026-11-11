// TTL 缓存槽 —— 把「配置读取」的缓存语义抽出来单独可测。
//
// 关键约定：**读取失败不写缓存**。早期实现把失败也当作空配置缓存 30s，
// 于是 DB 抖一下就让分析断送半分钟；这里只在拿到有效配置（含「确实未配置供应商」
// 的空值对象）时才写槽。失败返回空配置供本次渲染使用，下次请求会立即重试。

import type { AnalyticsConfig } from "./types";

/** 未配置任何供应商时的零值配置（合法状态，可以缓存）。 */
export const EMPTY_ANALYTICS_CONFIG: AnalyticsConfig = {
  googleAnalyticsId: "",
  plausibleDomain: "",
  plausibleSrc: "",
};

export interface AnalyticsConfigCache {
  /** 命中缓存则直返；否则调用 fetcher，成功才写槽。 */
  get(fetcher: () => Promise<AnalyticsConfig | undefined>): Promise<AnalyticsConfig>;
}

export interface ConfigCacheOptions {
  /** 缓存有效期（毫秒）。 */
  ttlMs: number;
  /** 时间源（测试注入假时钟）。 */
  now?: () => number;
}

export function createAnalyticsConfigCache(options: ConfigCacheOptions): AnalyticsConfigCache {
  const { ttlMs, now = () => Date.now() } = options;
  let slot: { at: number; value: AnalyticsConfig } | undefined;

  return {
    async get(fetcher) {
      const at = now();

      if (slot !== undefined && at - slot.at < ttlMs) {
        return slot.value;
      }

      const value = await fetcher();

      if (value === undefined) {
        // 读取失败：不写槽，本次按「未配置」处理，下次请求立即重试。
        return EMPTY_ANALYTICS_CONFIG;
      }

      slot = { at, value };
      return value;
    },
  };
}
