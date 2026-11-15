import { cloudflare } from "@cloudflare/vite-plugin";
import { createParaglidePlugin } from "@openstarter/i18n-web/paraglide";
import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const tslibEsm = "tslib/tslib.es6.js";

// `cloudflare:*` are workerd platform builtins: neither vite's
// `environments.ssr.resolve.builtins` (set by the cloudflare plugin) nor
// rolldownOptions overrides reach the resolver during `vite build`, so force
// external via a resolveId hook scoped to the ssr environment. The import stays
// in the bundle and workerd resolves it natively at runtime.
// cloudflare:* 是 workerd 平台内建模块：vite build 时（cloudflare 插件设置的）
// environments.ssr.resolve.builtins 与 rolldownOptions 覆盖都到不了解析器，
// 用限定 ssr 环境的 resolveId 钩子强制 external——import 原样保留，运行时由
// workerd 原生解析。
const externalizeCloudflareBuiltins = () => ({
  name: "externalize-cloudflare-builtins",
  resolveId(this: { environment?: { name?: string } }, id: string) {
    if (this.environment?.name === "ssr" && id.startsWith("cloudflare:")) {
      return { id, external: true } as const;
    }
    return null;
  },
});

export default defineConfig({
  server: {
    port: 3000,
  },
  environments: {
    client: {
      resolve: {
        // The client bundle must never reach server-only modules; keep the
        // platform builtin unresolvable instead of erroring at build time.
        // client 包绝不触碰服务端模块；平台内建模块保持不可解析而非构建报错。
        external: ["cloudflare:workers"],
      },
    },
    ssr: {
      build: {
        rolldownOptions: {
          // `cloudflare:*` are workerd platform builtins: neither vite's
          // `resolve.builtins` mapping nor rolldownOptions.external reaches the
          // resolver here, so force it with a resolveId plugin. The import stays
          // in the bundle and workerd resolves it natively at runtime.
          // cloudflare:* 是 workerd 平台内建模块：vite 的 resolve.builtins 与
          // rolldownOptions.external 都到不了这个解析器，用 resolveId 插件强制
          // external——import 原样保留，运行时由 workerd 原生解析。
          plugins: [
            {
              name: "externalize-cloudflare-builtins",
              resolveId(id) {
                if (id.startsWith("cloudflare:")) return { id, external: true };
                return null;
              },
            },
          ],
        },
      },
    },
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      tslib: tslibEsm,
    },
  },
  plugins: [
    { enforce: "pre", ...mdx({ providerImportSource: "@mdx-js/react" }) },
    externalizeCloudflareBuiltins(),
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
    // AFTER tanstackStart: Vite merges plugin `environments` config shallowly,
    // so the last plugin wins — cloudflare must come last for its ssr
    // `resolve.builtins` (cloudflare:* modules) to survive the merge.
    // 必须放在 tanstackStart 之后：Vite 对插件 environments 配置是浅合并、后
    // 者胜出——cloudflare 的 ssr resolve.builtins（cloudflare:* 模块）需要它
    // 最后合并才能保留。
    cloudflare({ viteEnvironment: { name: "ssr" } }),
  ],
});
