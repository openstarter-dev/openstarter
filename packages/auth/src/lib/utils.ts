import { DEFAULT_APP_URL } from "@openstarter/shared/constants";

import type { VerificationType } from "../types";

export interface GetUrlParams {
  request?: Request;
  type?: VerificationType;
  url?: string;
}

const parseOrigin = (value: string): string | null => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export const getBaseUrl = (request?: Request): string => {
  if (request) {
    const origin = request.headers.get("origin");
    if (origin) {
      return origin;
    }
    const fromRequestUrl = parseOrigin(request.url);
    if (fromRequestUrl) {
      return fromRequestUrl;
    }
  }
  return (process.env.VITE_APP_URL?.trim() || DEFAULT_APP_URL).replace(/\/+$/, "");
};

export const getAppUrl = (): string =>
  (process.env.VITE_APP_URL?.trim() || DEFAULT_APP_URL).replace(/\/+$/, "");

export const isLoopbackAppUrl = (appUrl: string): boolean =>
  /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(appUrl);

export const parseOriginList = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }
  const origins = new Set<string>();
  for (const item of value.split(",")) {
    const trimmed = item.trim();
    if (trimmed) {
      origins.add(trimmed);
    }
  }
  return [...origins];
};

export const mobileSchemeOrigin = (scheme: string | undefined): string => {
  const normalized = scheme?.trim().toLowerCase() ?? "";
  return /^[a-z][a-z0-9+.-]*$/.test(normalized) ? `${normalized}://` : "openstarter://";
};

export const getUrl = ({ request, url, type }: GetUrlParams): URL => {
  if (url && type) {
    return new URL(url);
  }
  return new URL(getBaseUrl(request));
};
