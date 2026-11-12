// apps/mobile/scripts/env.mjs —— 预加载 apps/web/.env（全仓库唯一 env 事实源），
// 把 web 应用地址派生为 Expo 客户端可见的 EXPO_PUBLIC_API_URL，再 spawn 透传的子命令（expo 等）。
//
// 为什么需要这一层：Expo 只从项目根（apps/mobile/）加载 .env，【不向上遍历 monorepo】
// （见 @expo/env：parseProjectEnv 无 parent directory traversal）。
// 因此 apps/web/.env 里的 URL 不会被 Expo 自动读取——这里在 spawn 子进程前
// 先把它读进 child process 的 env，使 Expo 构建期内联进 bundle 的 EXPO_PUBLIC_API_URL
// 与 web/cli/desktop/extension 同源。
//
// 优先级（高 → 低）：
//   1. 进程已存在的 EXPO_PUBLIC_API_URL（CI 或 shell 显式覆盖）—— 不动；
//   2. apps/mobile/.env 里的 EXPO_PUBLIC_API_URL（真机局域网 IP 覆盖，见 .env.example）；
//   3. apps/web/.env 的 OPENSTARTER_API_URL（显式覆盖）或 VITE_APP_URL（应用地址）。
// 选中 3 时仅当 mobile 本地未覆盖；真机调试仍应在本机 apps/mobile/.env 填局域网 IP。

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mobileDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const monorepoRoot = resolve(mobileDir, "..", "..");

// 用根 hoist 的 dotenv（pnpm catalog: dotenv ^17）。从 mobile 起解析，
// 走 pnpm 的 .pnpm 链接能命中根的 dotenv，无需在 mobile package.json 显式声明依赖。
const require = createRequire(import.meta.url);
// 先取模块文件再动态 import，确保拿到的是同一份 dotenv 实现。
const dotenvModulePath = require.resolve("dotenv", { paths: [mobileDir] });
const { config: loadDotenv } = await import(dotenvModulePath);

// dotenv v17 的 config() 只在返回对象里给 parsed，不会把键展开到返回对象顶层，
// 但会把解析到的键写入 process.env（override 默认 false，不覆盖已存在的）。
// 这里统一从 parsed 取显式来源，避免依赖 process.env 的副作用顺序。
const mobileParsed = loadDotenv({ path: resolve(mobileDir, ".env"), quiet: true })?.parsed ?? {};
const webParsed =
  loadDotenv({ path: resolve(monorepoRoot, "apps", "web", ".env"), quiet: true })?.parsed ?? {};

// process.argv 形如 [nodeBin, /path/to/env.mjs, ...透传参数]，前两项不是用户传入的子命令，
// 必须 drop 两位。用 [, , ...args] 而非 [, ...args]——后者会误把 env.mjs 自身当子命令 spawn。
const [, , ...args] = process.argv;
if (args.length === 0) {
  console.error("[mobile/env.mjs] 需要透传子命令，例如：node scripts/env.mjs expo start");
  process.exitCode = 2;
}

// 选定 EXPO_PUBLIC_API_URL（高 → 低）：进程已有 > mobile .env > web .env 的应用地址。
// web 侧只认 OPENSTARTER_API_URL（显式覆盖）与 VITE_APP_URL（唯一基址键）。
const inherited = process.env.EXPO_PUBLIC_API_URL;
const fromMobile = mobileParsed.EXPO_PUBLIC_API_URL;
const fromWeb = webParsed.OPENSTARTER_API_URL ?? webParsed.VITE_APP_URL;

const resolved = inherited ?? fromMobile ?? fromWeb;
if (!resolved) {
  console.error(
    "[mobile/env.mjs] EXPO_PUBLIC_API_URL 仍为空：既未在 process.env，也未在 apps/mobile/.env 或 apps/web/.env 找到。",
  );
  process.exit(1);
}

const childEnv = { ...process.env, EXPO_PUBLIC_API_URL: resolved };

const child = spawn(args[0], args.slice(1), {
  env: childEnv,
  shell: process.platform === "win32",
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
