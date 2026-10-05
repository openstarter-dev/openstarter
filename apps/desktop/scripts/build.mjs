// apps/desktop/scripts/build.mjs —— 更新版：vite build + esbuild 两步构建
// 1. vite build → dist/renderer/（HTML + JS + CSS 产物）
// 2. esbuild → dist/main/main.cjs + dist/preload.cjs（嵌套布局，与 package.json main
//    的 dist/main/main.cjs、window.ts 里 __dirname=dist/main 的路径假设保持一致）
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = resolve(desktopDir, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

async function runViteBuild() {
  return new Promise((resolvePromise, rejectPromise) => {
    const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
    const proc = spawn(pnpmCommand, ["exec", "vite", "build"], {
      cwd: desktopDir,
      stdio: ["ignore", "inherit", "inherit"],
    });
    proc.on("error", rejectPromise);
    proc.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`vite build exited with code ${code}`));
    });
  });
}

async function runEsbuild() {
  // main 与 preload 分开编译：main 进 dist/main/（package.json main 指向
  // dist/main/main.cjs，window.ts 按 __dirname=dist/main 解析 preload 与 offline 页），
  // preload 保持在 dist/ 根下。合在一起用同一个 outdir 会产出扁平布局导致加载错位。
  await build({
    bundle: true,
    entryPoints: [resolve(desktopDir, "src/main/main.ts")],
    external: ["electron"],
    format: "cjs",
    outdir: resolve(desktopDir, "dist/main"),
    outExtension: { ".js": ".cjs" },
    platform: "node",
    target: "node20",
  });
  await build({
    bundle: true,
    entryPoints: [resolve(desktopDir, "src/preload.ts")],
    external: ["electron"],
    format: "cjs",
    outdir: resolve(desktopDir, "dist"),
    outExtension: { ".js": ".cjs" },
    platform: "node",
    target: "node20",
  });
}

async function runBuild() {
  process.stdout.write("[desktop] building renderer (vite)...\n");
  await runViteBuild();

  process.stdout.write("[desktop] building main/preload (esbuild)...\n");
  await runEsbuild();

  process.stdout.write(`[desktop] built ${packageJson.name}@${packageJson.version}\n`);
}

runBuild().catch((error) => {
  process.stderr.write(`[desktop] build failed: ${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
