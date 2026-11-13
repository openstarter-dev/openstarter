type CloudflareGlobal = {
  navigator?: { userAgent?: string };
  Cloudflare?: unknown;
};

const cloudflareGlobal = globalThis as CloudflareGlobal;

export const isCloudflareWorker =
  cloudflareGlobal.navigator?.userAgent === "Cloudflare-Workers" || "Cloudflare" in globalThis;

export type CloudflareEnv = {
  DB?: unknown;
  HYPERDRIVE?: { connectionString?: string };
};

export function readCloudflareEnv(): CloudflareEnv | undefined {
  const scope = globalThis as {
    __CF_ENV__?: CloudflareEnv;
    __env__?: CloudflareEnv;
  };
  return scope.__CF_ENV__ ?? scope.__env__;
}
