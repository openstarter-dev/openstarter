import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDb } from "./create-db";
import type { DbConfig } from "../types";

// Supported providers whose createDb elaborates a real network driver that then
// attempts a TCP connect to a deliberately non-functional URL. mysql2 / pg emit
// the resulting socket error asynchronously after createDb returns, surfacing
// as an uncaughtException during the suite. Install a transient handler that
// swallows the expected connection errors so the suite stays green in
// environments without a live MySQL/PostgreSQL server (Property P1 only asserts
// the dialect-guard contract, not connection success).
const SWALLOWED_SOCKET_CODES = new Set([
  "ECONNREFUSED",
  "PROTOCOL_CONNECTION_LOST",
  "ETIMEDOUT",
  "EHOSTUNREACH",
]);
let swallowHandler: ((err: Error) => void) | undefined;

beforeAll(() => {
  swallowHandler = (err) => {
    const { code } = err as NodeJS.ErrnoException;
    if (code && SWALLOWED_SOCKET_CODES.has(code)) {
      return;
    }
    throw err;
  };
  process.on("uncaughtException", swallowHandler);
});

afterAll(() => {
  if (swallowHandler) {
    process.off("uncaughtException", swallowHandler);
  }
});

const VALID_NON_D1_PROVIDERS = [
  "sqlite",
  "turso",
  "postgres",
  "mysql",
] as const;
const validProviderArbitrary = fc.constantFrom(...VALID_NON_D1_PROVIDERS);
const invalidProviderArbitrary = fc
  .string({ maxLength: 32, minLength: 1 })
  .filter(
    (value) => !(VALID_NON_D1_PROVIDERS as readonly string[]).includes(value)
  )
  .filter((value) => value !== "d1");

const buildConfig = (provider: string): DbConfig => ({
  authToken: provider === "turso" ? "test-token" : undefined,
  provider,
  // sqlite/turso use in-memory DB; postgres/mysql elaborate a real driver
  // constructor on the bench (then throw online). Keeping all providers out of
  // the file system avoids leaving stray files from the property runs.
  url: provider === "sqlite" ? ":memory:" : "postgres://localhost:65535/null",
});

const UNSUPPORTED_PROVIDER_REGEX = /Unsupported DATABASE_PROVIDER/;

describe("createDb dialect guard (Property 1)", () => {
  it("P1 throws immediately for any unsupported DATABASE_PROVIDER", () => {
    fc.assert(
      fc.property(invalidProviderArbitrary, (provider) => {
        expect(() => createDb(buildConfig(provider))).toThrow(
          UNSUPPORTED_PROVIDER_REGEX
        );
      }),
      { numRuns: 100 }
    );
  });

  it("does not throw the dialect-guard error for any supported provider literal", () => {
    fc.assert(
      fc.property(validProviderArbitrary, (provider) => {
        const config = buildConfig(provider);

        // sqlite/turso/postgres/mysql each reach their driver constructor and
        // throw on connect (we pass a non-functional URL). The contract is that
        // the dialect guard never fires for a supported literal — whatever
        // runtime error emerges must NOT be the unsupported-dialect error.
        try {
          createDb(config);
        } catch (error) {
          const message = String((error as Error).message);
          expect(message.includes("Unsupported DATABASE_PROVIDER")).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });
});
