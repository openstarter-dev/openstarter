// apps/desktop/scripts/build.mjs —— 用 esbuild 把 src/main/main.ts 和 src/preload.ts 编译成
// dist/{main,preload}.cjs。只把 electron 标记为 external，其余依赖（含 electron-updater）
// 全部打进产物：pnpm 的 symlink 式 node_modules 与 electron-builder 的依赖收集历来不兼容，
// 全部 bundle 后就不需要处理这个问题（见 docs/superpowers/specs/2026-08-01-desktop-app-design.md §6）。
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = resolve(desktopDir, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

async function runBuild() {
  await build({
    bundle: true,
    entryPoints: [
      resolve(desktopDir, "src/main/main.ts"),
      resolve(desktopDir, "src/preload.ts"),
    ],
    external: ["electron"],
    format: "cjs",
    outdir: resolve(desktopDir, "dist"),
    outExtension: { ".js": ".cjs" },
    platform: "node",
    target: "node20",
  });

  process.stdout.write(
    `[desktop] built dist/main.cjs and dist/preload.cjs for ${packageJson.name}@${packageJson.version}\n`
  );
}

runBuild().catch((error) => {
  process.stderr.write(
    `[desktop] build failed: ${error.stack ?? error.message}\n`
  );
  process.exitCode = 1;
});
