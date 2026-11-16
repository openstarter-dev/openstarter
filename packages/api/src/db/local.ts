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
