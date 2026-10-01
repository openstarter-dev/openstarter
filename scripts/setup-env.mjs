// scripts/setup-env.mjs —— 一键初始化环境变量文件（新用户快速启动第一步）。
//
// 用法：
//   pnpm setup             # 扫描根目录与 apps/* 下的 .env.example，缺失则复制为 .env
//   pnpm setup --force     # 覆盖已存在的 .env（默认跳过，绝不覆盖用户已有配置）
//
// 行为：
//   - 根 .env.example   → .env   （跨端共享变量唯一事实源）
//   - apps/*/.env.example → apps/*/.env（app 级变量，如 BETTER_AUTH_SECRET）
//   - 复制 apps/web/.env 时自动生成随机 BETTER_AUTH_SECRET，替换文件中的占位符
//   - 已存在的 .env 默认跳过并提示，保证重复执行是幂等安全的
//   - 结束后打印后续步骤（db:migrate / dev）
//
// 零额外依赖：参数解析用 node:util parseArgs，随机密钥用 node:crypto。

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** apps/web/.env.example 中的密钥占位符（见该文件 `BETTER_AUTH_SECRET` 分段注释）。 */
const SECRET_PLACEHOLDER = "replace-with-a-strong-secret-at-least-32-chars";

/**
 * 生成 Better-Auth 密钥（base64，48 字节 ≈ 64 字符，满足 ≥32 字符要求）。
 * 独立导出以便测试。
 */
export function renderSecret() {
  return randomBytes(48).toString("base64");
}

/**
 * 从模板内容物化出最终 .env 内容：占位密钥替换为随机生成的真实密钥，其余原样保留。
 * 纯函数，便于单测。
 * @param {string} content .env.example 的原始内容
 * @param {{ secret?: string }} [opts] 测试注入固定密钥
 */
export function materializeContent(content, opts = {}) {
  const secret = opts.secret ?? renderSecret();
  return content.split(SECRET_PLACEHOLDER).join(secret);
}

/**
 * 扫描根目录与 apps/* 下所有 .env.example，返回 { example, target, rel } 列表。
 * @param {string} rootDir 仓库根目录
 */
export function discoverExamples(rootDir) {
  const entries = [];
  const rootExample = join(rootDir, ".env.example");
  if (existsSync(rootExample)) {
    entries.push({ example: rootExample, target: join(rootDir, ".env"), rel: ".env" });
  }

  const appsDir = join(rootDir, "apps");
  if (existsSync(appsDir)) {
    for (const name of readdirSync(appsDir, { withFileTypes: true })) {
      if (!name.isDirectory()) continue;
      const example = join(appsDir, name.name, ".env.example");
      if (!existsSync(example)) continue;
      entries.push({
        example,
        target: join(appsDir, name.name, ".env"),
        rel: join("apps", name.name, ".env"),
      });
    }
  }
  return entries;
}

/**
 * 执行复制：已存在且未指定 force 时跳过。返回结果摘要，log 可注入便于测试。
 * @param {string} rootDir 仓库根目录
 * @param {{ force?: boolean, log?: (msg: string) => void }} [opts]
 * @returns {{ created: string[], skipped: string[] }}
 */
export function copyEnvFiles(rootDir, opts = {}) {
  const { force = false, log = (msg) => process.stdout.write(`${msg}\n`) } = opts;
  const created = [];
  const skipped = [];

  for (const { example, target, rel } of discoverExamples(rootDir)) {
    if (existsSync(target) && !force) {
      skipped.push(rel);
      log(`  ↷ 跳过 ${rel}（已存在；如需覆盖请加 --force）`);
      continue;
    }
    const content = materializeContent(readFileSync(example, "utf8"));
    writeFileSync(target, content);
    created.push(rel);
    log(
      `  ✓ 创建 ${rel}${content.includes("BETTER_AUTH_SECRET") ? "（已自动生成 BETTER_AUTH_SECRET）" : ""}`,
    );
  }

  return { created, skipped };
}

/**
 * 打印后续步骤提示。
 * @param {{ created: string[], skipped: string[] }} result
 */
export function renderNextSteps(result) {
  const lines = [
    "",
    "后续步骤：",
    "  1. pnpm install",
    '  2. 按需编辑各 .env 填写密钥（留空的功能以"不启用"姿态运行）',
  ];
  if (result.created.some((p) => p === ".env")) {
    lines.push("  3. pnpm db:migrate    # 将迁移应用到本地 SQLite（file:local.db）");
    lines.push("  4. pnpm dev           # 启动开发服务");
  } else {
    lines.push("  3. pnpm dev");
  }
  lines.push("");
  return lines.join("\n");
}

const main = () => {
  const { values } = parseArgs({
    options: { force: { type: "boolean", default: false } },
  });

  process.stdout.write("[setup-env] 初始化环境变量文件…\n");
  const result = copyEnvFiles(ROOT_DIR, { force: values.force });
  process.stdout.write(renderNextSteps(result));
};

// 作为脚本直接执行时才运行 main（被单测 import 时不产生副作用）。
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectRun) {
  main();
}
