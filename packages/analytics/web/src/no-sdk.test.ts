// 依赖守护：web 端**刻意**不引入任何分析 SDK。
//
// 采集脚本由供应商 CDN 在运行时加载（见 providers/*/scripts.ts），因此 posthog-js /
// mixpanel / @vercel/analytics 这类 SDK 一旦被 import，就会把上百 KB 的生产依赖打进主包，
// 直接抹掉本方案最大的优势。这里用测试守住这条约束：任何非测试源码出现这些导入即失败。

import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

/** 禁止出现在 web 端源码里的分析 SDK（前缀匹配）。 */
const FORBIDDEN_SPECIFIERS = [
  "posthog-js",
  "posthog-node",
  "mixpanel",
  "@openpanel/",
  "@vercel/analytics",
  "@vemetric/",
  "@react-native-firebase/",
];

/** 抽取 import / export-from / 动态 import 的模块说明符。 */
const IMPORT_PATTERN = /(?:from\s+|import\()\s*"([^"]+)"/gu;

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      return collectSourceFiles(full);
    }

    const isSource = [".ts", ".tsx"].includes(extname(entry.name));
    const isTest = /\.test\.tsx?$/u.test(entry.name);
    return isSource && !isTest ? [full] : [];
  });
}

describe("analytics-web dependency guard", () => {
  it("does not import any analytics SDK", () => {
    const violations: string[] = [];

    for (const file of collectSourceFiles(SRC_DIR)) {
      const content = readFileSync(file, "utf8");
      for (const match of content.matchAll(IMPORT_PATTERN)) {
        const specifier = match[1] ?? "";
        const forbidden = FORBIDDEN_SPECIFIERS.some((prefix) => specifier.startsWith(prefix));
        if (forbidden) {
          violations.push(`${file.replace(SRC_DIR, "<src>")} → ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
