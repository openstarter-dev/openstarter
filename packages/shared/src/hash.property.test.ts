import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { md5, sha256 } from "./hash";

const printableStringArbitrary = fc.string({ maxLength: 256, minLength: 1 });
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;
const MD5_HEX_REGEX = /^[0-9a-f]{32}$/;

describe("hash determinism (Property 4 hash side)", () => {
  it("P4 sha256 is deterministic for any input string", () => {
    fc.assert(
      fc.property(printableStringArbitrary, (value) => {
        const first = sha256(value);
        const second = sha256(value);

        expect(first).toBe(second);
        expect(first).toMatch(SHA256_HEX_REGEX);
      }),
      { numRuns: 100 }
    );
  });

  it("P4 md5 is deterministic for any input string", () => {
    fc.assert(
      fc.property(printableStringArbitrary, (value) => {
        const first = md5(value);
        const second = md5(value);

        expect(first).toBe(second);
        expect(first).toMatch(MD5_HEX_REGEX);
      }),
      { numRuns: 100 }
    );
  });

  it("P4 different inputs do not hash to the same sha256 digest", () => {
    fc.assert(
      fc.property(
        printableStringArbitrary,
        printableStringArbitrary,
        (left, right) => {
          fc.pre(left !== right);

          expect(sha256(left)).not.toBe(sha256(right));
        }
      ),
      { numRuns: 100 }
    );
  });
});
