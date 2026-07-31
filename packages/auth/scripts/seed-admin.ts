// packages/auth/scripts/seed-admin.ts
// 一键创建管理员账号 + 平台 RBAC（角色 / 权限 / 角色-权限 / 用户-角色）。
//
// 用法（在 monorepo 根目录执行）：
//   pnpm seed:admin                       # 使用默认账号 admin@openstarter.dev / Admin@123456
//   SEED_EMAIL=you@x.com SEED_PASSWORD=secret pnpm seed:admin
//   pnpm seed:admin -- --email you@x.com --password secret --name Alice
//
// 脚本幂等:重复执行会更新已有账号的密码与名称,并补齐 RBAC 关联。
// 前置条件:已执行 `pnpm db:push` 让 schema 落库,且 `apps/web/.env` 中
//   `DATABASE_URL` 指向目标数据库、`BETTER_AUTH_SECRET` 已配置。
//
// 本文件只是「环境预加载 + 引导」:必须先读取 apps/web/.env 注入 process.env,
// 再动态 import 实现模块——否则 ESM 静态 import 会在拓扑求值阶段先于本文件
// 顶层代码触发 @openstarter/auth/src/env.ts 的 envin 解析,因缺
// BETTER_AUTH_SECRET 而抛错。

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ENV_FILE = fileURLToPath(
  new URL("../../../apps/web/.env", import.meta.url)
);
if (!existsSync(ENV_FILE)) {
  console.error(`[seed-admin] 未找到环境文件:${ENV_FILE}`);
  console.error(
    "请先复制 apps/web/.env.example 为 apps/web/.env 并填写 BETTER_AUTH_SECRET / DATABASE_URL。"
  );
  process.exit(1);
}

const content = readFileSync(ENV_FILE, "utf8");
for (const line of content.split("\n")) {
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
  if (value === "") {
    continue;
  }
  if (!(key in process.env)) {
    process.env[key] = value;
  }
}

// 环境就位后再加载实现(envin 校验、drizzle 连接等均在此时安全执行)
await import("./seed-admin-impl");
