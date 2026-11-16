// scripts/gen-package.mjs —— 一键创建 workspace 包（packages/ 单层或 <parent>/<variant> 嵌套）。
//
// 用法：
//   pnpm gen:package storage                 # packages/storage          → @openstarter/storage
//   pnpm gen:package analytics/web           # packages/analytics/web    → @openstarter/analytics-web
//   pnpm gen:package storage --tag core      # 显式指定 boundaries 标签
//   pnpm gen:package storage --dry           # 只打印将生成的文件，不落盘
//
// 生成的包遵循仓库既有约定（JIT 包，对齐 packages/shared、packages/analytics/mobile）：
//   - exports 以 TS 源码直出（"./*" 通配），由消费方 bundler 编译
//   - scripts 仅 test / test:coverage / check-types
//   - devDependencies: typescript（catalog:）
//   - turbo.json extends 根配置并携带 boundaries 标签
//   - vitest 项目接入根 vitest.config.ts 的 packages/* 与 packages/*/* 通配，无需改动
//
// 零额外依赖：参数解析用 node:util parseArgs，模板渲染用手工字符串拼接。

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEGMENT_PATTERN = /^[a-z][a-z0-9]*$/;

/** boundaries 标签全集（与根 turbo.json 的 boundaries.tags 对齐；app 仅用于 apps/）。 */
const TAGS = new Set(["core", "platform:web", "platform:mobile", "platform:extension"]);
const VARIANT_TAGS = {
  web: "platform:web",
  mobile: "platform:mobile",
  extension: "platform:extension",
};

/**
 * 解析 <name>[/<variant>] 并推断目录、包名与标签。
 * @param {string} raw 命令行位置参数
 * @param {{ tag?: string }} [opts]
 */
export function parseSpec(raw, opts = {}) {
  const segments = String(raw).split("/").filter(Boolean);
  if (segments.length === 0 || segments.length > 2) {
    throw new UsageError(`名称须为 <name> 或 <parent>/<variant>（两层），收到: "${raw}"`);
  }
  if (segments.some((s) => !SEGMENT_PATTERN.test(s))) {
    throw new UsageError(`名称段须为小写字母/数字（首字符为字母）: "${raw}"`);
  }

  const isNested = segments.length === 2;
  const dir = isNested ? `packages/${segments[0]}/${segments[1]}` : `packages/${segments[0]}`;
  const pkgName = isNested
    ? `@openstarter/${segments[0]}-${segments[1]}`
    : `@openstarter/${segments[0]}`;

  const tag = opts.tag ?? (isNested ? (VARIANT_TAGS[segments[1]] ?? "core") : "core");
  if (!TAGS.has(tag)) {
    throw new UsageError(`无效 tag "${tag}"，可选: ${[...TAGS].join(", ")}`);
  }

  return {
    dir,
    pkgName,
    vitestName: pkgName.replace("@openstarter/", ""),
    tag,
    tsconfigExt: isNested ? "../../../tsconfig.base.json" : "../../tsconfig.base.json",
  };
}

/**
 * 渲染包的模板文件（纯函数，便于单测）。
 * @returns {{ relPath: string, content: string }[]}
 */
export function renderFiles(spec) {
  const pkgJson = {
    name: spec.pkgName,
    version: "0.0.0",
    private: true,
    type: "module",
    exports: {
      ".": { default: "./src/index.ts" },
      "./*": { default: "./src/*.ts" },
    },
    scripts: {
      test: "vitest --run",
      "test:coverage": "vitest --run --coverage",
      "check-types": "tsc --noEmit",
    },
    devDependencies: {
      typescript: "catalog:",
    },
  };

  return [
    { relPath: "package.json", content: `${JSON.stringify(pkgJson, null, 2)}\n` },
    {
      relPath: "tsconfig.json",
      content: `${JSON.stringify(
        { extends: spec.tsconfigExt, compilerOptions: { noEmit: true } },
        null,
        2,
      )}\n`,
    },
    {
      relPath: "turbo.json",
      content: `${JSON.stringify({ extends: ["//"], tags: [spec.tag] }, null, 2)}\n`,
    },
    {
      relPath: "vitest.config.ts",
      content: `import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    name: "${spec.vitestName}",
    // 新包尚未有测试时保持 vitest 通过；首个测试落地后此开关不再生效。
    passWithNoTests: true,
  },
});
`,
    },
    {
      relPath: "src/index.ts",
      content: `// ${spec.pkgName} 包入口。
// TODO: 在此聚合本包的公共 API。
export {};
`,
    },
  ];
}

/**
 * 收集 workspace 中已占用的包名（单层 + 嵌套）。
 * @returns {Set<string>}
 */
export function findExistingNames(rootDir = ROOT_DIR) {
  const names = new Set();
  const packagesDir = join(rootDir, "packages");
  for (const entry of listDirs(packagesDir)) {
    const entryDir = join(packagesDir, entry);
    const topName = readNameFromPkgJson(entryDir);
    if (topName) {
      names.add(topName);
    }
    for (const nested of listDirs(entryDir)) {
      const name = readNameFromPkgJson(join(entryDir, nested));
      if (name) {
        names.add(name);
      }
    }
  }
  return names;
}

function listDirs(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "node_modules")
    .map((d) => d.name);
}

function readNameFromPkgJson(pkgDir) {
  const pkgJsonPath = join(pkgDir, "package.json");
  if (!existsSync(pkgJsonPath)) {
    return undefined;
  }
  try {
    const name = JSON.parse(readFileSync(pkgJsonPath, "utf8")).name;
    return typeof name === "string" ? name : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 生成包目录并写入模板文件。
 * @param {ReturnType<typeof parseSpec>} spec
 * @param {{ rootDir?: string, dryRun?: boolean }} [opts]
 * @returns {{ written: string[] }}
 */
export function scaffold(spec, opts = {}) {
  const rootDir = opts.rootDir ?? ROOT_DIR;
  const targetDir = join(rootDir, spec.dir);

  if (existsSync(targetDir)) {
    throw new UsageError(`目标目录已存在: ${spec.dir}`);
  }
  if (findExistingNames(rootDir).has(spec.pkgName)) {
    throw new UsageError(`包名在 workspace 中重名或已占用: ${spec.pkgName}`);
  }

  const files = renderFiles(spec);
  if (opts.dryRun) {
    return { written: files.map((f) => f.relPath) };
  }

  const written = [];
  for (const file of files) {
    const abs = join(targetDir, file.relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, file.content, "utf8");
    written.push(file.relPath);
  }
  return { written };
}

class UsageError extends Error {}

function printUsage() {
  console.log(`用法: pnpm gen:package <name>[/<variant>] [--tag <tag>] [--dry]

示例:
  pnpm gen:package storage            # packages/storage        → @openstarter/storage (core)
  pnpm gen:package analytics/web      # packages/analytics/web  → @openstarter/analytics-web (platform:web)
  pnpm gen:package analytics/mobile    # packages/analytics/mobile → @openstarter/analytics-mobile (platform:mobile)
  pnpm gen:package storage --tag core # 显式指定 boundaries 标签
  pnpm gen:package storage --dry      # 预览将生成的文件，不落盘

生成的包为 JIT 型（TS 源码直出），含 package.json / tsconfig.json / turbo.json / vitest.config.ts / src/index.ts。
后续步骤: 在消费方 package.json 加 "workspace:*" 依赖后执行 pnpm install。`);
}

function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      tag: { type: "string" },
      dry: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help || positionals.length === 0) {
    printUsage();
    process.exitCode = values.help ? 0 : 1;
    return;
  }

  const spec = parseSpec(positionals[0], { tag: values.tag });
  const { written } = scaffold(spec, { dryRun: values.dry });

  const preview = values.dry ? "（dry run，未落盘）将生成" : "已生成";
  console.log(`✓ ${preview} ${spec.dir}/`);
  for (const rel of written) {
    console.log(`  ${spec.dir}/${rel}`);
  }
  if (!values.dry) {
    console.log(`
后续步骤:
  1. 在消费方 package.json 的 dependencies 中加 "${spec.pkgName}": "workspace:*"
  2. 执行 pnpm install 更新 lockfile`);
  }
}

// 作为脚本直接执行时才运行 main（被单测 import 时不产生副作用）。
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectRun) {
  try {
    main();
  } catch (err) {
    console.error(`gen-package: ${err.message}`);
    if (err instanceof UsageError) {
      console.error("\n运行 pnpm gen:package --help 查看用法。");
    }
    process.exit(1);
  }
}
