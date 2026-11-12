import { existsSync, readFileSync } from "node:fs";
import path from "path";
import type { IProjectConfig } from "@tarojs/taro/types/compile";

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
    fileEnv.OPENSTARTER_API_URL ||
    fileEnv.VITE_APP_URL ||
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
    publicPath: "/",
    staticDirectory: "static",
  },
};

export default config;
