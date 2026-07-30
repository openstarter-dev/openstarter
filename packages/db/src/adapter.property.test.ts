import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { getAuthAdapterProvider } from "./adapter";

const VALID_PROVIDERS = ["sqlite", "turso", "d1", "postgres", "mysql"] as const;
const PROVIDER_TO_ADAPTER = {
  d1: "sqlite",
  mysql: "mysql",
  postgres: "pg",
  sqlite: "sqlite",
  turso: "sqlite",
} as const;

const validProviderArbitrary = fc.constantFrom(...VALID_PROVIDERS);
const invalidProviderArbitrary = fc
  .string({ maxLength: 32, minLength: 1 })
  .filter((value) => !((value as string) in PROVIDER_TO_ADAPTER));
const UNSUPPORTED_PROVIDER_REGEX = /Unsupported DATABASE_PROVIDER/;

describe("auth adapter provider mapping (Property 54)", () => {
  it("P54 maps every supported DATABASE_PROVIDER to the accepted drizzleAdapter provider", () => {
    fc.assert(
      fc.property(validProviderArbitrary, (provider) => {
        const result = getAuthAdapterProvider(provider);

        expect(result).toBe(PROVIDER_TO_ADAPTER[provider]);
        expect(
          result === "pg" || result === "mysql" || result === "sqlite"
        ).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("P54/P1 throws immediately for any unsupported DATABASE_PROVIDER", () => {
    fc.assert(
      fc.property(invalidProviderArbitrary, (provider) => {
        expect(() => getAuthAdapterProvider(provider)).toThrow(
          UNSUPPORTED_PROVIDER_REGEX
        );
      }),
      { numRuns: 100 }
    );
  });
});
