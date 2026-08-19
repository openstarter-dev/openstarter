// apps/desktop/scripts/build.mjs —— 更新版：vite build + esbuild 两步构建
// 1. vite build → dist/renderer/（HTML + JS + CSS 产物）
// 2. esbuild → dist/main.cjs + dist/preload.cjs
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
    const proc = spawn("pnpm", ["exec", "vite", "build"], {
      cwd: desktopDir,
      stdio: ["ignore", "inherit", "inherit"],
      shell: true,
    });
    proc.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`vite build exited with code ${code}`));
    });
  });
}

async function runEsbuild() {
  await build({
    bundle: true,
    entryPoints: [resolve(desktopDir, "src/main/main.ts"), resolve(desktopDir, "src/preload.ts")],
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
