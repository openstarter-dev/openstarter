import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { getSnowId, getUniSeq, getUuid } from "./id";

const NON_EMPTY_BATCHES = [1, 2, 10, 50, 200];
const fixedPrefixArbitrary = fc.stringMatching(/^[a-z][a-z0-9_-]{0,7}$/);
const SNOWFLAKE_ID_REGEX = /^\d{17,22}$/;

describe("identifier uniqueness and format (Property 4)", () => {
  it.each(
    NON_EMPTY_BATCHES
  )("P4 UUIDs generated in a batch of size %d are pairwise distinct", (size) => {
    const ids = new Set<string>();
    for (let index = 0; index < size; index += 1) {
      ids.add(getUuid());
    }
    expect(ids.size).toBe(size);
  });

  it.each(
    NON_EMPTY_BATCHES
  )("P4 unique sequences generated in a batch of size %d are pairwise distinct", (size) => {
    const ids = new Set<string>();
    for (let index = 0; index < size; index += 1) {
      ids.add(getUniSeq("tst"));
    }
    expect(ids.size).toBe(size);
  });

  it("P4 snowflake ids have the expected numeric format", () => {
    const id = getSnowId();
    expect(id).toMatch(SNOWFLAKE_ID_REGEX);
  });

  it("P4 snowflake collisions across a small batch are dominated by random suffix so vanish to near-zero", () => {
    const ids: string[] = [];
    for (let index = 0; index < 50; index += 1) {
      ids.push(getSnowId());
    }
    expect(new Set(ids).size).toBeGreaterThan(40);
  });

  it("P4 unique sequences always start with the provided prefix", () => {
    const ids = new Set<string>();
    fc.assert(
      fc.property(fixedPrefixArbitrary, (prefix) => {
        const sequence = getUniSeq(prefix);

        expect(sequence.startsWith(prefix)).toBe(true);
        expect(sequence.length).toBeGreaterThan(prefix.length);
        ids.add(sequence);
      }),
      { numRuns: 100 }
    );
    expect(ids.size).toBe(100);
  });
});
