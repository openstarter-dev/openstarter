import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createDb } from "./create-db";
import type { DbConfig } from "./types";

const VALID_NON_D1_PROVIDERS = ["sqlite", "turso", "postgres", "mysql"] as const;
const validProviderArbitrary = fc.constantFrom(...VALID_NON_D1_PROVIDERS);
const invalidProviderArbitrary = fc
  .string({ maxLength: 32, minLength: 1 })
  .filter(
    (value) => !((VALID_NON_D1_PROVIDERS as readonly string[]).includes(value))
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

describe("createDb dialect guard (Property 1)", () => {
  it("P1 throws immediately for any unsupported DATABASE_PROVIDER", () => {
    fc.assert(
      fc.property(invalidProviderArbitrary, (provider) => {
        expect(() => createDb(buildConfig(provider))).toThrow(
          /Unsupported DATABASE_PROVIDER/
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
