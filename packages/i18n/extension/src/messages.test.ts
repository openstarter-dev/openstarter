// @openstarter/i18n-extension 消息目录测试。
// 平价断言仿 packages/i18n/web/src/messages.property.test.ts(Property 48):
// en/zh_CN 键集相等、值均为非空字符串;另覆盖 flatten 与 {name} 占位符替换的正确性。
import { describe, expect, it } from "vitest";

import {
  EXTENSION_DEFAULT_LOCALE,
  EXTENSION_LOCALES,
  EXTENSION_MESSAGES,
  flattenCatalog,
  translateMessage,
} from "./messages";

describe("extension message catalog", () => {
  it("en and zh_CN key sets are equal", () => {
    expect(Object.keys(EXTENSION_MESSAGES.en).sort()).toEqual(
      Object.keys(EXTENSION_MESSAGES.zh_CN).sort(),
    );
  });

  it("all values are non-empty strings", () => {
    for (const messages of [EXTENSION_MESSAGES.en, EXTENSION_MESSAGES.zh_CN]) {
      for (const value of Object.values(messages)) {
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it("covers a non-trivial key count", () => {
    expect(Object.keys(EXTENSION_MESSAGES.en).length).toBeGreaterThan(5);
  });

  it("flattenCatalog joins nested keys with dot paths", () => {
    const flattened = flattenCatalog({
      account: { nested: { deep: "Deep" }, plan: "Plan" },
    });

    expect(flattened).toEqual({ "account.nested.deep": "Deep", "account.plan": "Plan" });
  });

  it("resolves keys in both locales", () => {
    expect(EXTENSION_LOCALES).toContain(EXTENSION_DEFAULT_LOCALE);
    expect(translateMessage("en", "account.plan")).toBe("Plan");
    expect(translateMessage("zh_CN", "account.plan")).toBe("套餐");
    expect(translateMessage("zh", "account.plan")).toBe("套餐");
    expect(translateMessage("zh-CN", "account.plan")).toBe("套餐");
  });

  it("substitutes {name} placeholders", () => {
    expect(translateMessage("en", "app.misconfigured", { reason: "VITE_APP_URL is not set" })).toBe(
      "Extension is misconfigured: VITE_APP_URL is not set",
    );
  });

  it("falls back to the key itself when missing", () => {
    expect(translateMessage("en", "nonexistent.key")).toBe("nonexistent.key");
  });
});
