import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { defineConfig } from "wxt";

// 加载根 .env，把跨端共享的 OPENSTARTER_API_URL 派生为 VITE_APP_URL。
// host_permissions 与 API base URL 都由 VITE_APP_URL 派生，二者不会漂移
// （见 docs/superpowers/specs/2026-08-01-browser-extension-app-design.md §5）。
// manifest 支持函数形式（(env) => manifest），故可在构建期读取 process.env。
//
// 优先级（高 → 低）：显式 process.env.VITE_APP_URL（CI/shell 覆盖）>
// 根 .env 的 OPENSTARTER_API_URL（与 web/cli/desktop/mobile 同源）>
// localhost 兜底。Wxt 只在 Node 构建期读本文件，不向上遍历 monorepo，故需手动加载根 .env。
const extensionDir = resolve(fileURLToPath(import.meta.url), "..");
const monorepoRoot = resolve(extensionDir, "..", "..");
const require = createRequire(import.meta.url);
const dotenvPath = require.resolve("dotenv", { paths: [extensionDir] });
const { config: loadDotenv } = await import(dotenvPath);
loadDotenv({ path: resolve(monorepoRoot, ".env"), quiet: true });

const APP_URL_FALLBACK = "http://localhost:3000";

// Paraglide compiles the shared en/zh message catalog (defined in
// packages/i18n) into the locale runtime consumed here in the extension. The
// inlang project + messages live in packages/i18n; the compiled runtime lands
// in src/paraglide (git-ignored, regenerated on every dev/build).
const inlangProject = fileURLToPath(new URL("../../packages/i18n/project.inlang", import.meta.url));

function resolveAppUrl(): string {
  if (process.env.VITE_APP_URL) {
    return process.env.VITE_APP_URL;
  }
  if (process.env.OPENSTARTER_API_URL) {
    return process.env.OPENSTARTER_API_URL;
  }
  return APP_URL_FALLBACK;
}

export default defineConfig({
  manifest: () => {
    const appUrl = resolveAppUrl();
    const { origin } = new URL(appUrl);
    return {
      host_permissions: [`${origin}/*`],
      name: "OpenStarter Account",
      permissions: ["cookies"],
    };
  },
  modules: ["@wxt-dev/module-react"],
  srcDir: "src",
  vite: () => ({
    plugins: [
      // Paraglide: locale-aware message compilation for the extension popup.
      // Unlike apps/web there is no URL strategy — the popup has no routable
      // path — so we read the preference from the cookie (set via setLocale()
      // against the same origin the API lives on) and fall back to the base
      // locale (en). No urlPatterns needed for the same reason.
      paraglideVitePlugin({
        project: inlangProject,
        outdir: "./src/paraglide",
        outputStructure: "message-modules",
        cookieName: "PARAGLIDE_LOCALE",
        strategy: ["cookie", "baseLocale"],
      }),
    ],
  }),
});
