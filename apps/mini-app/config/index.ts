import { existsSync, readFileSync } from "node:fs";
import path from "path";
import type { IProjectConfig } from "@tarojs/taro/types/compile";

// apps/web/.env 是全仓库唯一 env 事实源。Taro 配置在 Node 构建期执行，
// 因此这里直接读取 web 应用地址作为 API base，不再依赖根目录 .env。
// 优先级（高 → 低）：进程环境（CI / shell 注入）> apps/web/.env 的
// OPENSTARTER_API_URL > VITE_APP_URL > URL > BETTER_AUTH_URL > localhost 兜底
// （后三者与 @openstarter/shared/app-url 的 resolveAppUrl 保持一致）。
const WEB_ENV_FILE = path.resolve(__dirname, "../../../apps/web/.env");

function parseWebEnv(): Record<string, string> {
  if (!existsSync(WEB_ENV_FILE)) {
    return {};
  }

  const entries: Record<string, string> = {};
  for (const line of readFileSync(WEB_ENV_FILE, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value) {
      entries[key] = value;
    }
  }
  return entries;
}

function resolveApiBaseUrl(): string {
  const fileEnv = parseWebEnv();
  return (
    process.env.OPENSTARTER_API_URL ||
    process.env.VITE_APP_URL ||
    process.env.URL ||
    fileEnv.OPENSTARTER_API_URL ||
    fileEnv.VITE_APP_URL ||
    fileEnv.URL ||
    fileEnv.BETTER_AUTH_URL ||
    "http://localhost:3000"
  );
}

const config: IProjectConfig = {
  framework: "react",
  projectName: "openstarter",
  date: "2026-8-4",
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
    375: 2 / 1,
  },
  sourceRoot: "src",
  outputRoot: "dist",
  plugins: ["@tarojs/plugin-platform-weapp", "@tarojs/plugin-framework-react"],
  defineConstants: {
    API_BASE_URL: JSON.stringify(resolveApiBaseUrl()),
  },
  mini: {
    miniCssExtractPluginOption: {
      ignoreOrder: true,
    },
    webpackChain: (chain) => {
      chain.resolve.alias.set("@", path.resolve(__dirname, "..", "src"));
    },
    postcss: {
      autoprefixer: { enable: true },
      pxtransform: { enable: true, config: {} },
      url: { enable: true, config: { limit: 1024 } },
      cssModules: {
        enable: false,
        config: { namingPattern: "module", generateScopedName: "module_[name]__[local]" },
      },
    },
  },
  h5: {
    // h5 端不会用到，但 Taro 需要编译配置存在
    publicPath: "/",
    staticDirectory: "static",
  },
};

export default config;
