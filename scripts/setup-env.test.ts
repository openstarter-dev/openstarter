// setup-env 单测：discoverExamples / materializeContent / copyEnvFiles 为可注入纯逻辑，
// 用临时目录验证副作用。覆盖：发现规则、占位密钥替换、已存在跳过与 --force 覆盖、幂等性。

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { copyEnvFiles, discoverExamples, materializeContent, renderSecret } from "./setup-env.mjs";

const tmpDirs: string[] = [];

function makeTmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "setup-env-test-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    rmSync(tmpDirs.pop() as string, { recursive: true, force: true });
  }
});

describe("renderSecret", () => {
  it("长度 ≥ 32 且两次生成互不相同", () => {
    const a = renderSecret();
    const b = renderSecret();
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).not.toBe(b);
  });
});

describe("materializeContent", () => {
  it("替换占位密钥为注入值，其余内容原样保留", () => {
    const content = "A=1\nBETTER_AUTH_SECRET=replace-with-a-strong-secret-at-least-32-chars\nC=3\n";
    const out = materializeContent(content, { secret: "s".repeat(48) });
    expect(out).toBe(`A=1\nBETTER_AUTH_SECRET=${"s".repeat(48)}\nC=3\n`);
  });

  it("无占位符时原样返回", () => {
    const content = "OPENSTARTER_API_URL=http://localhost:3000\n";
    expect(materializeContent(content, { secret: "x" })).toBe(content);
  });

  it("未注入密钥时替换值满足 ≥32 字符", () => {
    const out = materializeContent(
      `BETTER_AUTH_SECRET=replace-with-a-strong-secret-at-least-32-chars`,
    );
    expect(out.startsWith("BETTER_AUTH_SECRET=")).toBe(true);
    expect(out.slice("BETTER_AUTH_SECRET=".length).length).toBeGreaterThanOrEqual(32);
  });
});

describe("discoverExamples", () => {
  it("收集根目录与 apps/*/ 的样例，忽略无样例目录与文件", () => {
    const dir = makeTmp();
    writeFileSync(join(dir, ".env.example"), "ROOT=1\n");
    mkdirSync(join(dir, "apps", "web"), { recursive: true });
    writeFileSync(join(dir, "apps", "web", ".env.example"), "WEB=1\n");
    mkdirSync(join(dir, "apps", "empty")); // 无 .env.example，应被忽略
    writeFileSync(join(dir, "apps", "stray.txt"), "not a dir\n");

    const entries = discoverExamples(dir);
    expect(entries.map((e) => e.rel)).toEqual([".env", join("apps", "web", ".env")]);
  });
});

describe("copyEnvFiles", () => {
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  it("缺失时创建并返回 created；再次执行幂等跳过", () => {
    const dir = makeTmp();
    writeFileSync(join(dir, ".env.example"), "ROOT=1\n");

    const first = copyEnvFiles(dir, { log });
    expect(first.created).toEqual([".env"]);
    expect(readFileSync(join(dir, ".env"), "utf8")).toBe("ROOT=1\n");

    const second = copyEnvFiles(dir, { log });
    expect(second.created).toEqual([]);
    expect(second.skipped).toEqual([".env"]);
  });

  it("--force 覆盖已有文件", () => {
    const dir = makeTmp();
    writeFileSync(join(dir, ".env.example"), "ROOT=1\n");
    writeFileSync(join(dir, ".env"), "USER=edited\n");

    const result = copyEnvFiles(dir, { force: true, log });
    expect(result.created).toEqual([".env"]);
    expect(readFileSync(join(dir, ".env"), "utf8")).toBe("ROOT=1\n");
  });

  it("复制含占位密钥的模板时自动生成真实密钥", () => {
    const dir = makeTmp();
    mkdirSync(join(dir, "apps", "web"), { recursive: true });
    writeFileSync(
      join(dir, "apps", "web", ".env.example"),
      "BETTER_AUTH_SECRET=replace-with-a-strong-secret-at-least-32-chars\n",
    );

    copyEnvFiles(dir, { log });
    const out = readFileSync(join(dir, "apps", "web", ".env"), "utf8");
    expect(out.startsWith("BETTER_AUTH_SECRET=")).toBe(true);
    expect(out).not.toContain("replace-with-a-strong-secret");
    expect(out.slice("BETTER_AUTH_SECRET=".length).trim().length).toBeGreaterThanOrEqual(32);
  });
});
