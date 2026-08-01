import { describe, expect, it, vi } from "vitest";

import { readSessionToken } from "./session";

const ORIGIN = "http://localhost:3000";

// vi.fn mocks returns Promise.resolve(...) rather than `async` fns —— 与仓库既有测试风格
// 一致（apps/mobile/src/lib/api-error.test.ts 等），同时避免 Ultracite 的 useAwait 规则
// 对"无 await 表达式的 async 函数"报错。
describe("readSessionToken", () => {
  it("returns the value of the __Secure- prefixed cookie when present", () => {
    const cookieReader = vi.fn((_origin: string, name: string) =>
      Promise.resolve(
        name === "__Secure-openstarter.session_token"
          ? { value: "secure-token-value" }
          : null
      )
    );

    const token = readSessionToken(ORIGIN, cookieReader);

    expect(token).resolves.toBe("secure-token-value");
    expect(cookieReader).toHaveBeenCalledWith(
      ORIGIN,
      "__Secure-openstarter.session_token"
    );
  });

  it("falls back to the unprefixed cookie when the secure variant is absent", () => {
    const cookieReader = vi.fn((_origin: string, name: string) =>
      Promise.resolve(
        name === "openstarter.session_token"
          ? { value: "plain-token-value" }
          : null
      )
    );

    const token = readSessionToken(ORIGIN, cookieReader);

    expect(token).resolves.toBe("plain-token-value");
  });

  it("prefers the __Secure- cookie when both are present", () => {
    // 用 if/return 分支替代嵌套三元（Ultracite noNestedTernary）。
    const cookieReader = vi.fn((_origin: string, name: string) => {
      if (name === "__Secure-openstarter.session_token") {
        return Promise.resolve({ value: "secure-token-value" });
      }
      if (name === "openstarter.session_token") {
        return Promise.resolve({ value: "plain-token-value" });
      }
      return Promise.resolve(null);
    });

    const token = readSessionToken(ORIGIN, cookieReader);

    expect(token).resolves.toBe("secure-token-value");
  });

  it("returns null when neither cookie is present", () => {
    const cookieReader = vi.fn(() => Promise.resolve(null));

    const token = readSessionToken(ORIGIN, cookieReader);

    expect(token).resolves.toBeNull();
  });
});
