import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { calculateCreditExpirationTime } from "./credits";

describe("calculateCreditExpirationTime (Property 26)", () => {
  it("P26 returns null when creditsValidDays is missing or non-positive", () => {
    fc.assert(
      fc.property(
        fc.integer({ max: 0, min: -100 }),
        fc.option(fc.date()),
        fc.date(),
        (days, currentPeriodEnd, now) => {
          expect(
            calculateCreditExpirationTime({
              creditsValidDays: days,
              currentPeriodEnd,
              now,
            }),
          ).toBe(null);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("P26 follows currentPeriodEnd when provided and creditsValidDays > 0", () => {
    fc.assert(
      fc.property(
        fc.integer({ max: 365, min: 1 }),
        fc.date({ max: new Date("2200-01-01"), min: new Date("2000-01-01") }),
        fc.date(),
        (days, currentPeriodEnd, now) => {
          const result = calculateCreditExpirationTime({
            creditsValidDays: days,
            currentPeriodEnd,
            now,
          });

          expect(result?.getTime()).toBe(currentPeriodEnd.getTime());
        },
      ),
      { numRuns: 100 },
    );
  });

  it("P26 equals now + creditsValidDays when no currentPeriodEnd is provided", () => {
    fc.assert(
      fc.property(
        fc.integer({ max: 365, min: 1 }),
        fc.date({ max: new Date("2100-01-01"), min: new Date("2000-01-01") }),
        (days, now) => {
          const result = calculateCreditExpirationTime({
            creditsValidDays: days,
            now,
          });

          const expected = new Date(now.getTime());
          expected.setDate(expected.getDate() + days);

          expect(result?.getTime()).toBe(expected.getTime());
        },
      ),
      { numRuns: 100 },
    );
  });

  it("P26 returns a fresh Date instance when copying currentPeriodEnd (no shared reference)", () => {
    const periodEnd = new Date("2026-12-31");
    const result = calculateCreditExpirationTime({
      creditsValidDays: 10,
      currentPeriodEnd: periodEnd,
    });

    expect(result).not.toBe(periodEnd);
    expect(result?.getTime()).toBe(periodEnd.getTime());
  });

  it("P26 always returns a Date or null, never undefined or other types", () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ max: 365, min: 1 })),
        fc.option(fc.date()),
        fc.option(fc.date()),
        (days, currentPeriodEnd, now) => {
          const result = calculateCreditExpirationTime({
            creditsValidDays: days ?? undefined,
            currentPeriodEnd: currentPeriodEnd ?? undefined,
            now: now ?? undefined,
          });

          expect(result === null || result instanceof Date).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
