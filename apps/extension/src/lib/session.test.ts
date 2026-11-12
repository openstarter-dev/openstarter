import { describe, expect, it, vi } from "vitest";

import { readSessionToken } from "./session";

const ORIGIN = "http://localhost:3000";

describe("readSessionToken", () => {
  it("returns the value of the __Secure- prefixed cookie when present", async () => {
    const cookieReader = vi.fn((_origin: string, name: string) =>
      Promise.resolve(
        name === "__Secure-openstarter.session_token" ? { value: "secure-token-value" } : null,
      ),
    );

    const token = readSessionToken(ORIGIN, cookieReader);

    await expect(token).resolves.toBe("secure-token-value");
    expect(cookieReader).toHaveBeenCalledWith(ORIGIN, "__Secure-openstarter.session_token");
  });

  it("falls back to the unprefixed cookie when the secure variant is absent", async () => {
    const cookieReader = vi.fn((_origin: string, name: string) =>
      Promise.resolve(name === "openstarter.session_token" ? { value: "plain-token-value" } : null),
    );

    const token = readSessionToken(ORIGIN, cookieReader);

    await expect(token).resolves.toBe("plain-token-value");
  });

  it("prefers the __Secure- cookie when both are present", async () => {
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

    await expect(token).resolves.toBe("secure-token-value");
  });

  it("returns null when neither cookie is present", async () => {
    const cookieReader = vi.fn(() => Promise.resolve(null));

    const token = readSessionToken(ORIGIN, cookieReader);

    await expect(token).resolves.toBeNull();
  });
});
