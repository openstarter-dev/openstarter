// gen-package 单测：parseSpec / renderFiles 为纯函数，scaffold 用临时目录验证副作用。
// 覆盖：单包与嵌套变体的命名/标签推断、非法输入拒绝、生成文件内容、已存在目录与重名保护。

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { findExistingNames, parseSpec, renderFiles, scaffold } from "./gen-package.mjs";

const tmpDirs: string[] = [];

function makeTmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "gen-package-test-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    rmSync(tmpDirs.pop() as string, { recursive: true, force: true });
  }
});

describe("parseSpec", () => {
  it("单段名称：packages/<name>，@openstarter/<name>，tag 默认 core", () => {
    const spec = parseSpec("storage");
    expect(spec.dir).toBe("packages/storage");
    expect(spec.pkgName).toBe("@openstarter/storage");
    expect(spec.vitestName).toBe("storage");
    expect(spec.tag).toBe("core");
    expect(spec.tsconfigExt).toBe("../../tsconfig.base.json");
  });

  it("嵌套变体：packages/<parent>/<variant>，名称拼接，tag 按变体名推断", () => {
    const spec = parseSpec("analytics/web");
    expect(spec.dir).toBe("packages/analytics/web");
    expect(spec.pkgName).toBe("@openstarter/analytics-web");
    expect(spec.vitestName).toBe("analytics-web");
    expect(spec.tag).toBe("platform:web");
    expect(spec.tsconfigExt).toBe("../../../tsconfig.base.json");
  });

  it("mobile 变体推断为 platform:mobile", () => {
    expect(parseSpec("analytics/mobile").tag).toBe("platform:mobile");
  });

  it("--tag 显式覆盖自动推断", () => {
    expect(parseSpec("analytics/web", { tag: "core" }).tag).toBe("core");
  });

  it("非法名称（大写/下划线/开头数字/连字符边界）被拒绝", () => {
    for (const bad of ["MyPkg", "my_pkg", "1pkg", "-pkg", "pkg-", "pkg--x"]) {
      expect(() => parseSpec(bad)).toThrow();
    }
  });

  it("非法 tag 被拒绝（含 app——app 标签仅用于 apps/）", () => {
    expect(() => parseSpec("storage", { tag: "app" })).toThrow(/tag/i);
    expect(() => parseSpec("storage", { tag: "whatever" })).toThrow(/tag/i);
  });

  it("拒绝路径穿越与超过两层的嵌套", () => {
    expect(() => parseSpec("../evil")).toThrow();
    expect(() => parseSpec("a/b/c")).toThrow();
  });
});

describe("renderFiles", () => {
  it("package.json：JIT exports + test/check-types 脚本 + catalog typescript", () => {
    const spec = parseSpec("storage");
    const pkgJson = JSON.parse(
      renderFiles(spec).find((f) => f.relPath === "package.json")?.content ?? "",
    );
    expect(pkgJson.name).toBe("@openstarter/storage");
    expect(pkgJson.type).toBe("module");
    expect(pkgJson.exports["."]).toEqual({ default: "./src/index.ts" });
    expect(pkgJson.exports["./*"]).toEqual({ default: "./src/*.ts" });
    expect(pkgJson.scripts.test).toBe("vitest --run");
    expect(pkgJson.scripts["check-types"]).toBe("tsc --noEmit");
    expect(pkgJson.devDependencies.typescript).toBe("catalog:");
  });

  it("turbo.json：extends 根配置并携带 boundaries 标签", () => {
    const spec = parseSpec("analytics/mobile");
    const turbo = renderFiles(spec).find((f) => f.relPath === "turbo.json")?.content ?? "";
    expect(JSON.parse(turbo)).toEqual({ extends: ["//"], tags: ["platform:mobile"] });
  });

  it("vitest.config.ts：node 环境，项目名与包对应", () => {
    const spec = parseSpec("analytics/web");
    const vitest = renderFiles(spec).find((f) => f.relPath === "vitest.config.ts")?.content ?? "";
    expect(vitest).toContain('name: "analytics-web"');
    expect(vitest).toContain('environment: "node"');
  });

  it("src/index.ts 占位入口为合法模块", () => {
    const spec = parseSpec("storage");
    const index = renderFiles(spec).find((f) => f.relPath === join("src", "index.ts"))?.content;
    expect(index).toContain("@openstarter/storage");
    expect(index).toContain("export {}");
  });
});

describe("findExistingNames", () => {
  it("收集单层与嵌套 workspace 包名", () => {
    const root = makeTmp();
    mkdirSync(join(root, "packages/shared/src"), { recursive: true });
    writeFileSync(
      join(root, "packages/shared/package.json"),
      JSON.stringify({ name: "@openstarter/shared" }),
    );
    mkdirSync(join(root, "packages/ui/web"), { recursive: true });
    writeFileSync(
      join(root, "packages/ui/web/package.json"),
      JSON.stringify({ name: "@openstarter/ui-web" }),
    );
    expect(findExistingNames(root)).toEqual(
      new Set(["@openstarter/shared", "@openstarter/ui-web"]),
    );
  });
});

describe("scaffold", () => {
  it("写入全部模板文件且不覆盖既有目录", () => {
    const root = makeTmp();
    const spec = parseSpec("storage");
    const { written } = scaffold(spec, { rootDir: root });
    expect(written).toEqual([
      "package.json",
      "tsconfig.json",
      "turbo.json",
      "vitest.config.ts",
      join("src", "index.ts"),
    ]);
    for (const rel of written) {
      expect(existsSync(join(root, "packages/storage", rel))).toBe(true);
    }
  });

  it("dryRun 只报告不落盘", () => {
    const root = makeTmp();
    const spec = parseSpec("storage");
    const { written } = scaffold(spec, { rootDir: root, dryRun: true });
    expect(written.length).toBe(5);
    expect(existsSync(join(root, "packages/storage"))).toBe(false);
  });

  it("目标目录已存在时拒绝", () => {
    const root = makeTmp();
    mkdirSync(join(root, "packages/shared"), { recursive: true });
    expect(() => scaffold(parseSpec("shared"), { rootDir: root })).toThrow(/已存在/);
  });

  it("workspace 内重名时拒绝", () => {
    const root = makeTmp();
    mkdirSync(join(root, "packages/other/src"), { recursive: true });
    writeFileSync(
      join(root, "packages/other/package.json"),
      JSON.stringify({ name: "@openstarter/shared" }),
    );
    expect(() => scaffold(parseSpec("shared"), { rootDir: root })).toThrow(/重名|已占用/);
  });

  it("readFileSync 读取生成的 package.json 内容可被 require 解析", () => {
    const root = makeTmp();
    scaffold(parseSpec("storage"), { rootDir: root });
    const raw = readFileSync(join(root, "packages/storage/package.json"), "utf8");
    expect(JSON.parse(raw).name).toBe("@openstarter/storage");
  });
});
