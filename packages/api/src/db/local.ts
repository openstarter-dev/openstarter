// Local D1 binding bootstrap for Node runtimes (vite dev SSR, self-hosted Node,
// seed scripts). Wraps wrangler.getPlatformProxy so these runtimes get a REAL
// local D1 binding — the same engine and API as production Workers.
// 本地 D1 binding 引导：Node 侧（vite dev SSR、自托管 Node、seed 脚本）在加载任何
// 业务代码前调用 initLocalD1()，通过 getPlatformProxy 拿到与生产一致的本地 D1
// binding，并写入 src/db/server 读取的 __CF_ENV__ 全局契约。

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const CONFIG_DIR = "apps/web";
const CONFIG_FILE = "wrangler.jsonc";
const EXAMPLE_CONFIG_FILE = "wrangler.example.jsonc";

type PlatformProxy = {
  env: Record<string, unknown>;
  dispose: () => Promise<void>;
};

type GetPlatformProxy = (options?: {
  configPath?: string;
  // wrangler ignores a plain string here (falls back to cwd-relative
  // .wrangler/state/v3); only the object form is honored.
  persist?: { path: string } | boolean;
}) => Promise<PlatformProxy>;

let initPromise: Promise<void> | null = null;
let proxyHandle: PlatformProxy | null = null;

function isWorkerRuntime(): boolean {
  const cloudflareGlobal = globalThis as {
    navigator?: { userAgent?: string };
    Cloudflare?: unknown;
  };
  return (
    cloudflareGlobal.navigator?.userAgent === "Cloudflare-Workers" ||
    "Cloudflare" in cloudflareGlobal
  );
}

// Find apps/web/wrangler(.example).jsonc upward from cwd: nitro dev, self-hosted
// Node and the seed script run with different cwds. Fresh clones fall back to the
// committed example config — local miniflare D1 doesn't validate database_id.
// 从 cwd 向上查找 apps/web 的 wrangler 配置；没有真实配置时回退到 example（本地
// miniflare D1 不校验 database_id，example 即可跑通）。
function resolveWebConfig(): string {
  let dir = process.cwd();
  for (;;) {
    const realConfig = resolve(dir, CONFIG_DIR, CONFIG_FILE);
    if (existsSync(realConfig)) {
      return realConfig;
    }
    const exampleConfig = resolve(dir, CONFIG_DIR, EXAMPLE_CONFIG_FILE);
    if (existsSync(exampleConfig)) {
      return exampleConfig;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error(
    "apps/web/wrangler.jsonc not found — copy apps/web/wrangler.example.jsonc (initLocalD1 needs a D1 binding named DB).",
  );
}

export function initLocalD1(): Promise<void> {
  if (isWorkerRuntime()) {
    return Promise.resolve();
  }

  initPromise ??= (async () => {
    const { getPlatformProxy } = (await import("wrangler")) as {
      getPlatformProxy: GetPlatformProxy;
    };

    const configPath = resolveWebConfig();
    // Pin the persist root next to the wrangler config (apps/web/.wrangler/state/v3):
    // getPlatformProxy's default resolves against cwd, which would fork a second
    // empty database for any entry point not running from apps/web. Note the root
    // INCLUDES the v3 segment (it maps to miniflare's defaultPersistRoot).
    // 固定 persist 根目录到 wrangler 配置旁边：默认相对 cwd，非 apps/web 启动的
    // 入口（如 seed 脚本）会另起一个空库。路径含 v3 段（对应 miniflare 的
    // defaultPersistRoot），与 `wrangler --persist-to .wrangler/state` 一致。
    const persistPath = resolve(dirname(configPath), ".wrangler", "state", "v3");
    proxyHandle = await getPlatformProxy({ configPath, persist: { path: persistPath } });

    const env = proxyHandle.env;
    if (!env.DB) {
      await proxyHandle.dispose();
      proxyHandle = null;
      throw new Error('No D1 binding "DB" in the wrangler config — add a d1_databases entry.');
    }

    (globalThis as unknown as { __CF_ENV__?: unknown }).__CF_ENV__ = env;
  })();

  return initPromise;
}
