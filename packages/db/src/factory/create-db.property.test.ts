import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createDb } from "./create-db";
import type { DbConfig } from "../types";

const VALID_PROVIDERS = ["postgres", "d1"] as const;
const validProviderArbitrary = fc.constantFrom(...VALID_PROVIDERS);
const invalidProviderArbitrary = fc
  .string({ maxLength: 32, minLength: 1 })
  .filter((value) => !(VALID_PROVIDERS as readonly string[]).includes(value));

const buildConfig = (provider: string): DbConfig => ({
  provider,
  url: provider === "d1" ? ":memory:" : "postgres://localhost:65535/null",
});

const UNSUPPORTED_PROVIDER_REGEX = /Unsupported DATABASE_PROVIDER/;

describe("createDb dialect guard (Property 1)", () => {
  it("P1 throws immediately for any unsupported DATABASE_PROVIDER", () => {
    fc.assert(
      fc.property(invalidProviderArbitrary, (provider) => {
        expect(() => createDb(buildConfig(provider))).toThrow(UNSUPPORTED_PROVIDER_REGEX);
      }),
      { numRuns: 100 },
    );
  });

  it("does not throw the dialect-guard error for any supported provider literal", () => {
    fc.assert(
      fc.property(validProviderArbitrary, (provider) => {
        const config = buildConfig(provider);

        try {
          createDb(config);
        } catch (error) {
          const message = String((error as Error).message);
          expect(message.includes("Unsupported DATABASE_PROVIDER")).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});
