declare const API_BASE_URL: string;

export function getApiBaseUrl(): string {
  return typeof API_BASE_URL !== "undefined" ? API_BASE_URL : "http://localhost:3000";
}
