/**
 * Cloudflare Workers (workerd) runtime detection and binding access.
 *
 * workerd sets `navigator.userAgent` to "Cloudflare-Workers" (the documented
 * runtime detection) and also exposes a `Cloudflare` global. TCP-backed
 * drivers (postgres/mysql) must not reuse sockets across requests there, so
 * the `db()` singleton avoids caching them on Workers (see `server.ts`).
 *
 * `navigator` is read through `globalThis` so this module does not depend on
 * DOM/Workers ambient types (the package's `types` is limited to `node`).
 */

type CloudflareGlobal = {
  navigator?: { userAgent?: string };
  Cloudflare?: unknown;
};

const cloudflareGlobal = globalThis as CloudflareGlobal;

export const isCloudflareWorker =
  cloudflareGlobal.navigator?.userAgent === "Cloudflare-Workers" || "Cloudflare" in globalThis;

/**
 * Bindings the server entry stashes on `globalThis` under Cloudflare Workers:
 * the D1 database binding (`DB`) and an optional Hyperdrive binding used to
 * pool TCP connections at the edge.
 */
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
