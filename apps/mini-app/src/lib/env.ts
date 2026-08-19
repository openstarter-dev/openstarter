// apps/mini-app/src/lib/env.ts
// 环境变量 getter，供 auth-client 和 services/client 共用。
// API_BASE_URL 由 Taro 构建期 defineConstants 注入（见 config/index.ts）。

declare const API_BASE_URL: string;

export function getApiBaseUrl(): string {
  return typeof API_BASE_URL !== "undefined" ? API_BASE_URL : "http://localhost:3000";
}
