import { fileURLToPath } from "node:url";

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

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
    alias: isCloudflareBuild
      ? {
          "@libsql/client": driverStub,
          "drizzle-orm/libsql": driverStub,
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
