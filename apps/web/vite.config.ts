import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

import { createParaglidePlugin } from "@openstarter/i18n-web/paraglide";
import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const isCloudflareBuild = (process.env.NITRO_PRESET || "").includes("cloudflare");
const driverStub = fileURLToPath(new URL("./src/db-driver-stub.ts", import.meta.url));

const tslibEsm = "tslib/tslib.es6.js";

function workersDbProvider(): string {
  try {
    const raw = readFileSync(fileURLToPath(new URL("./wrangler.jsonc", import.meta.url)), "utf8");
    const cleaned = raw.replace(/\/\/.*$/gm, "");
    const match = cleaned.match(/"DATABASE_PROVIDER"\s*:\s*"([^"]+)"/);
    if (match) {
      return match[1];
    }
  } catch {
  }
  return process.env.DATABASE_PROVIDER || "d1";
}

const workersDb = isCloudflareBuild ? workersDbProvider() : "";
const keepPostgres = workersDb === "postgresql" || workersDb === "postgres";

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
    alias: isCloudflareBuild
      ? {
          mysql2: driverStub,
          "@libsql/client": driverStub,
          "drizzle-orm/libsql": driverStub,
          ...(keepPostgres ? {} : { postgres: driverStub }),
          tslib: tslibEsm,
        }
      : {
          tslib: tslibEsm,
        },
  },
  plugins: [
    { enforce: "pre", ...mdx({ providerImportSource: "@mdx-js/react" }) },
    tailwindcss(),
    createParaglidePlugin({
      outputStructure: "message-modules",
      cookieName: "PARAGLIDE_LOCALE",
      strategy: ["url", "cookie", "baseLocale"],
      urlPatterns: [
        {
          pattern: "/api/:path(.*)?",
          localized: [
            ["en", "/api/:path(.*)?"],
            ["zh", "/api/:path(.*)?"],
          ],
        },
        {
          pattern: "/",
          localized: [
            ["zh", "/zh"],
            ["en", "/"],
          ],
        },
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
    nitro(),
  ],
});
