// resolveAppUrl 单测：优先级（VITE_APP_URL > APP_URL > BETTER_AUTH_URL > URL）、
// 空白值忽略、末尾斜杠归一化、全缺失时回落本地默认。注入 env 而非改 process.env。

import { describe, expect, it } from "vitest";

import { DEFAULT_APP_URL, resolveAppUrl } from "./app-url";

describe("resolveAppUrl", () => {
  it("VITE_APP_URL 优先于其余 alias", () => {
    expect(
      resolveAppUrl({
        APP_URL: "https://app-alias.example.com",
        BETTER_AUTH_URL: "https://auth.example.com",
        URL: "https://legacy.example.com",
        VITE_APP_URL: "https://app.example.com",
      }),
    ).toBe("https://app.example.com");
  });

  it("按 VITE_APP_URL → APP_URL → BETTER_AUTH_URL → URL 依次回落", () => {
    expect(
      resolveAppUrl({
        BETTER_AUTH_URL: "https://auth.example.com",
        URL: "https://legacy.example.com",
      }),
    ).toBe("https://auth.example.com");
    expect(resolveAppUrl({ URL: "https://legacy.example.com" })).toBe("https://legacy.example.com");
  });

  it("忽略空白值并去掉末尾斜杠", () => {
    expect(
      resolveAppUrl({
        BETTER_AUTH_URL: "  https://auth.example.com/  ",
        VITE_APP_URL: "   ",
      }),
    ).toBe("https://auth.example.com");
  });

  it("全部缺失时回落本地默认", () => {
    expect(resolveAppUrl({})).toBe(DEFAULT_APP_URL);
  });
});
