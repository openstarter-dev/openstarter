import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ENV_FILE = fileURLToPath(new URL("../../../apps/web/.env", import.meta.url));
if (!existsSync(ENV_FILE)) {
  console.error(`[seed-admin] 未找到环境文件:${ENV_FILE}`);
  console.error(
    "请先复制 apps/web/.env.example 为 apps/web/.env 并填写 BETTER_AUTH_SECRET / DATABASE_URL。",
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

await import("./seed-admin-impl");
