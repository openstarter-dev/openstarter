import fc from "fast-check";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { createRequireAuth } from "./auth-core";

const headerCharacter = fc.constantFrom(
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 _-./",
);
const authorizationHeader = fc.option(
  fc.array(headerCharacter, { maxLength: 80 }).map((characters) => characters.join("")),
  { nil: undefined },
);

describe("authentication middleware properties", () => {
  it("Feature: shipany-feature-parity, Property 5: 受保护端点拒绝无效凭证", async () => {
    await fc.assert(
      fc.asyncProperty(authorizationHeader, async (authorization) => {
        const app = new Hono().get(
          "/protected",
          createRequireAuth({
            getSession: () => Promise.resolve(null),
            validateApiKey: () => Promise.resolve(null),
          }),
          (c) => c.json({ userId: c.get("userId") }),
        );
        const headers = new Headers();
        if (authorization !== undefined) {
          headers.set("authorization", authorization);
        }

        const response = await app.request("/protected", { headers });

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
          code: -1,
          message: "unauthorized",
        });
      }),
      { numRuns: 100 },
    );
  });

  it("rejects an anonymous session when anonymous auth is disabled", async () => {
    const app = new Hono().get(
      "/protected",
      createRequireAuth({
        getSession: async () => ({ user: { id: "anon-1", isAnonymous: true } }),
        isAnonymousAllowed: () => false,
        validateApiKey: () => Promise.resolve(null),
      }),
      (c) => c.json({ userId: c.get("userId") }),
    );

    const response = await app.request("/protected");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ code: -1, message: "unauthorized" });
  });

  it("allows an anonymous session when anonymous auth is enabled", async () => {
    const app = new Hono().get(
      "/protected",
      createRequireAuth({
        getSession: async () => ({ user: { id: "anon-1", isAnonymous: true } }),
        isAnonymousAllowed: () => true,
        validateApiKey: () => Promise.resolve(null),
      }),
      (c) => c.json({ userId: c.get("userId") }),
    );

    const response = await app.request("/protected");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ userId: "anon-1" });
  });
});
