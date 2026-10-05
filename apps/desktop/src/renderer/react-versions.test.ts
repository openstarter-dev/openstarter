// apps/desktop/src/renderer/react-versions.test.ts —— 回归测试。
//
// dev 曾出现 react@19.2.3 + react-dom@19.2.7 混装，Vite 预构建后渲染进程直接抛
// "Incompatible React versions" 白屏（黑窗口）。根因是 desktop 没走 catalog 的钉死版本。
// 此测试保证两者解析到完全相同的版本，失败即提示检查 catalog/pnpm-lock。
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

describe("react versions", () => {
  it("react and react-dom resolve to the exact same version", () => {
    const reactVersion = (require("react/package.json") as { version: string }).version;
    const reactDomVersion = (require("react-dom/package.json") as { version: string }).version;

    expect(reactDomVersion).toBe(reactVersion);
  });
});
