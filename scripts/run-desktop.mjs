// scripts/run-desktop.mjs —— 编排 apps/desktop 的 dev 流程：
//   1. 先用 esbuild 编译一次 main/preload（否则 dist/main.cjs 不存在，Electron 无法启动）
//   2. 启动 renderer 的 Vite dev server（端口 5173）
//   3. 等 Vite 就绪后，spawn Electron 主进程加载 http://localhost:5173
//   4. Ctrl-C 时优雅地把子进程都杀掉
//
// 设计取舍：不引入 concurrently / wait-on 等依赖，直接用 Node 内置 API 做进程编排，
// 与仓库现有"零额外 dev 依赖"风格保持一致。
//
// 本文件位于 scripts/ 目录，ultracite 配置对 **/scripts 路径的 noConsole 规则本就是
// off（已核实：ultracite/config/biome/core/biome.jsonc 第 656-666 行的 overrides），
// 因此这里直接用 console，不需要走 apps/desktop/src/log.ts 的 logInfo/logWarn。
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const desktopDir = resolve(repoRoot, "apps/desktop");

const RENDERER_PORT = process.env.OPENSTARTER_RENDERER_PORT || "5173";
const RENDERER_URL = `http://localhost:${RENDERER_PORT}`;

// 递归杀掉子进程树（避免 vite/electron 留下孤儿进程）。
function killTree(proc) {
  if (!proc || proc.exitCode !== null) {
    return;
  }
  try {
    process.kill(proc.pid, "SIGTERM");
  } catch {
    // already dead
  }
}

function delay(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

// 等待 dev server 响应最多 attempts 次 HEAD 请求。
async function waitForDevServer(attempts = 80, intervalMs = 500) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: sequential polling against a single dev server is intentional.
      const res = await fetch(RENDERER_URL, { method: "HEAD" });
      if (res.ok || res.status === 404) {
        return true;
      }
    } catch {
      // not ready
    }
    await delay(intervalMs);
  }
  return false;
}

// 编译一次 main/preload；Electron 需要 dist/main.cjs 才能启动。
function runBuild() {
  return new Promise((resolvePromise, rejectPromise) => {
    const proc = spawn("pnpm", ["run", "build"], {
      cwd: desktopDir,
      stdio: ["ignore", "inherit", "inherit"],
    });
    proc.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`desktop build exited with code ${code}`));
      }
    });
  });
}

function spawnVite() {
  console.log("[desktop] starting renderer dev server (vite)...");
  const proc = spawn("pnpm", ["exec", "vite"], {
    cwd: desktopDir,
    stdio: ["ignore", "inherit", "inherit"],
    shell: true,
  });
  proc.on("exit", (code) => {
    console.log(`[desktop] renderer dev server exited (code=${code})`);
  });
  return proc;
}

function spawnElectron() {
  console.log(`[desktop] launching electron -> ${RENDERER_URL}`);
  const proc = spawn("pnpm", ["run", "dev:electron"], {
    cwd: desktopDir,
    env: {
      ...process.env,
      NODE_ENV: "development",
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
  proc.on("exit", (code) => {
    console.log(`[desktop] electron exited (code=${code})`);
  });
  return proc;
}

async function main() {
  console.log("[desktop] building main/preload...");
  await runBuild();

  const viteProc = spawnVite();

  const ready = await waitForDevServer();
  if (!ready) {
    console.warn(
      `[desktop] renderer dev server not ready at ${RENDERER_URL}; launching electron anyway.`,
    );
  }

  const electronProc = spawnElectron();

  // 任一进程退出 → 全部退出（dev 会话结束）。
  const exitAll = (code) => {
    killTree(viteProc);
    killTree(electronProc);
    process.exit(code ?? 0);
  };
  viteProc.on("exit", exitAll);
  electronProc.on("exit", exitAll);

  // Ctrl-C
  process.on("SIGINT", () => exitAll(0));
  process.on("SIGTERM", () => exitAll(0));
}

main().catch((err) => {
  console.error("[desktop] fatal:", err);
  process.exit(1);
});
