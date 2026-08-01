// Metro 的 monorepo 解析：apps/mobile 依赖的 @openstarter/* 均不经构建、直接暴露
// ./src/*.ts，因此必须让 Metro 监视仓库根、并能从根 node_modules 解析，
// 同时启用 package exports（@openstarter/* 的 exports map 依赖它）。
// 见 spec §8.2 与 §9（这是本方案最可能卡住的一环，兜底见 spec §9）。
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// Metro 配置约定为 CommonJS（require/module.exports），这里需要进程内联的项目根路径；
// biome 的 noGlobalDirnameFilename 规则针对 ESM，CJS 下 __dirname 是规范内全局，
// 故对此行显式豁免。
// biome-ignore lint/correctness/noGlobalDirnameFilename: CJS Metro config relies on the __dirname global.
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.unstable_enablePackageExports = true;

module.exports = withNativeWind(config, { input: "./global.css" });
