import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";

import { paraglideVitePlugin } from "@inlang/paraglide-js";
import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { config as loadDotenv } from "dotenv";

// Direct web dev also loads shared root settings; existing shell values win.
loadDotenv({
  path: ["../../.env.local", "../../.env"].map((path) =>
    fileURLToPath(new URL(path, import.meta.url)),
  ),
  override: false,
  quiet: true,
});

// Paraglide compiles the shared en/zh message catalog (defined in
// packages/i18n/web) into the locale runtime consumed here in apps/web. The
// inlang project + messages live in packages/i18n/web; the compiled runtime
// lands in src/paraglide (git-ignored, regenerated on every dev/build).
const inlangProject = fileURLToPath(
  new URL("../../packages/i18n/web/project.inlang", import.meta.url),
);

// Cloudflare Workers build (`pnpm cf:build`, NITRO_PRESET=cloudflare_module):
// stub out DB drivers that don't match the runtime database. mysql2 crashes
// workerd at module evaluation (node:net / node:process requires) even under
// nodejs_compat, so it must be aliased away when the bundle pulls it in via
// drizzle-orm's lazy driver graph. postgres.js runs under nodejs_compat but is
// dead weight when the backend is D1, so it's stubbed unless the worker is
// configured for Postgres via Hyperdrive.
//
// Which driver the bundle keeps follows wrangler.jsonc `vars.DATABASE_PROVIDER`
// (the runtime truth on workerd) — d1 stubs both, postgresql keeps postgres.js
// for the Hyperdrive binding. Node builds (`pnpm dev`/`pnpm build`) keep every
// driver and skip this stubbing entirely. Mirrors ShipAny's vite.config.ts.
const isCloudflareBuild = (process.env.NITRO_PRESET || "").includes("cloudflare");
const driverStub = fileURLToPath(new URL("./src/db-driver-stub.ts", import.meta.url));

// tslib's UMD/CJS entry breaks under workerd's interop when bundled by nitro
// (pulled in by @peculiar/x509 via @simplewebauthn/server ← @better-auth/passkey):
// "Cannot destructure property '__extends'". Force the ESM build everywhere.
const tslibEsm = "tslib/tslib.es6.js";
// Optional 3D preview must never prevent the independent 2D canvas from loading.
const modelViewer = fileURLToPath(
  new URL(
    existsSync(fileURLToPath(new URL("./node_modules/three/package.json", import.meta.url)))
      ? "./src/components/model-3d/model-viewer.tsx"
      : "./src/components/model-3d/model-viewer-unavailable.tsx",
    import.meta.url,
  ),
);

// Prefer wrangler.jsonc over the build-time env, which can be polluted by
// .env.local (e.g. DATABASE_PROVIDER=sqlite for local dev).
function workersDbProvider(): string {
  try {
    const raw = readFileSync(fileURLToPath(new URL("./wrangler.jsonc", import.meta.url)), "utf8");
    // Strip JSONC line comments before regexing — wrangler.jsonc may carry
    // commented-out Hyperdrive / KV / R2 blocks.
    const cleaned = raw.replace(/\/\/.*$/gm, "");
    const match = cleaned.match(/"DATABASE_PROVIDER"\s*:\s*"([^"]+)"/);
    if (match) {
      return match[1];
    }
  } catch {
    // no wrangler.jsonc yet (fresh clone) — fall through to env default
  }
  return process.env.DATABASE_PROVIDER || "d1";
}

const workersDb = isCloudflareBuild ? workersDbProvider() : "";
const keepPostgres = workersDb === "postgresql" || workersDb === "postgres";

export default defineConfig({
  server: {
    port: 3000,
    proxy: { "/canvas-sync": { target: "http://127.0.0.1:3102", ws: true } },
  },
  resolve: {
    tsconfigPaths: true,
    alias: isCloudflareBuild
      ? {
          mysql2: driverStub,
          ...(keepPostgres ? {} : { postgres: driverStub }),
          tslib: tslibEsm,
          "virtual:greenplan-model-viewer": modelViewer,
        }
      : {
          tslib: tslibEsm,
          "virtual:greenplan-model-viewer": modelViewer,
        },
  },
  plugins: [
    // MDX must run before the React plugin so JSX emitted by compiled MDX is
    // transformed. `providerImportSource` lets the (pages) layout inject shared
    // element styling via MDXProvider.
    { enforce: "pre", ...mdx({ providerImportSource: "@mdx-js/react" }) },
    tailwindcss(),
    // Paraglide sits after tailwind and before tanstackStart: it owns the
    // locale-aware URL rewrite (localizeUrl / deLocalizeUrl) and message
    // compilation, leaving the tanstackStart -> viteReact order untouched.
    paraglideVitePlugin({
      project: inlangProject,
      outdir: "./src/paraglide",
      outputStructure: "message-modules",
      cookieName: "PARAGLIDE_LOCALE",
      // url: locale from the path prefix (/zh/...); cookie: user preference set
      // via setLocale(); baseLocale: fall back to en when neither is present.
      strategy: ["url", "cookie", "baseLocale"],
      urlPatterns: [
        // API endpoints are never locale-prefixed.
        {
          pattern: "/api/:path(.*)?",
          localized: [
            ["en", "/api/:path(.*)?"],
            ["zh", "/api/:path(.*)?"],
          ],
        },
        // Bare locale homes match without a trailing-slash redirect.
        {
          pattern: "/",
          localized: [
            ["zh", "/zh"],
            ["en", "/"],
          ],
        },
        // "as-needed" prefix: zh under /zh, en (default) unprefixed.
        {
          pattern: "/:path(.*)?",
          localized: [
            ["zh", "/zh/:path(.*)?"],
            ["en", "/:path(.*)?"],
          ],
        },
      ],
    }),
    tanstackStart(),
    viteReact(),
    // nitro produces the deployable server output. When NITRO_PRESET is a
    // cloudflare preset (set by `pnpm cf:build`), nitro emits a Workers entry
    // + wrangler.json instead of the Node `.output/server/index.mjs`. Reads
    // NITRO_PRESET from the environment so the same config ships both targets.
    nitro(),
  ],
});
