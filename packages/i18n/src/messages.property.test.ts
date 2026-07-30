import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const enJson = JSON.parse(
  readFileSync(join(here, "..", "messages", "en.json"), "utf8")
) as Record<string, unknown>;
const zhJson = JSON.parse(
  readFileSync(join(here, "..", "messages", "zh.json"), "utf8")
) as Record<string, unknown>;

const enKeys = new Set(Object.keys(enJson));
const zhKeys = new Set(Object.keys(zhJson));

const missingFromEn = [...zhKeys].filter((key) => !enKeys.has(key));
const missingFromZh = [...enKeys].filter((key) => !zhKeys.has(key));

describe("bilingual message key parity (Property 48)", () => {
  it("P48 en and zh message key sets are equal", () => {
    if (missingFromEn.length > 0 || missingFromZh.length > 0) {
      throw new Error(
        `Message key mismatch:\n  Missing from en (${missingFromEn.length}): ${missingFromEn.slice(0, 10).join(", ")}\n  Missing from zh (${missingFromZh.length}): ${missingFromZh.slice(0, 10).join(", ")}`
      );
    }
    expect(enKeys).toEqual(zhKeys);
  });

  it("P48 en values are all non-empty strings", () => {
    for (const value of Object.values(enJson)) {
      expect(typeof value).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
  });

  it("P48 zh values are all non-empty strings", () => {
    for (const value of Object.values(zhJson)) {
      expect(typeof value).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
  });

  it("P48 key sets contain a non-trivial count (> 5)", () => {
    expect(enKeys.size).toBeGreaterThan(5);
    expect(zhKeys.size).toBe(enKeys.size);
  });
});
