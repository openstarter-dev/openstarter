import { describe, expect, it } from "vitest";

import { runPurchaseConfirmation } from "./purchase-confirmation";

/** 手动推进的假时钟。 */
function createFakeClock() {
  let now = 0;
  return {
    advance(ms: number): void {
      now += ms;
    },
    now(): number {
      return now;
    },
  };
}

describe("runPurchaseConfirmation", () => {
  it("returns confirmed immediately when the plan reflects the purchase on first poll", async () => {
    const result = await runPurchaseConfirmation({
      clock: createFakeClock(),
      poll: async () => true,
    });

    expect(result.status).toBe("confirmed");
  });

  it("returns confirmed after several pending polls", async () => {
    let calls = 0;
    const result = await runPurchaseConfirmation({
      clock: createFakeClock(),
      poll: async () => {
        calls += 1;
        return calls >= 4;
      },
    });

    expect(result.status).toBe("confirmed");
  });

  it("returns timeout when the webhook never lands within the deadline", async () => {
    const result = await runPurchaseConfirmation({
      clock: createFakeClock(),
      poll: async () => false,
    });

    expect(result.status).toBe("timeout");
  });

  it("stops after the attempt budget even when the fake clock never advances", async () => {
    let calls = 0;
    const result = await runPurchaseConfirmation({
      clock: createFakeClock(),
      intervalMs: 100,
      maxWaitMs: 200,
      poll: async () => {
        calls += 1;
        return false;
      },
    });

    expect(result.status).toBe("timeout");
    expect(calls).toBe(3);
  });

  it("stops early when the clock crosses the deadline", async () => {
    const clock = createFakeClock();
    let calls = 0;
    const result = await runPurchaseConfirmation({
      clock,
      intervalMs: 100,
      maxWaitMs: 350,
      poll: async () => {
        calls += 1;
        clock.advance(200);
        return false;
      },
    });

    expect(result.status).toBe("timeout");
    expect(calls).toBe(2);
  });

  it("treats a throwing probe as a pending poll, not a crash", async () => {
    let calls = 0;
    const result = await runPurchaseConfirmation({
      clock: createFakeClock(),
      poll: async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error("network blip");
        }
        return true;
      },
    });

    expect(result.status).toBe("confirmed");
  });

  it("always awaits at least one poll before deciding", async () => {
    let calls = 0;
    await runPurchaseConfirmation({
      clock: createFakeClock(),
      maxWaitMs: 0,
      poll: async () => {
        calls += 1;
        return false;
      },
    });

    expect(calls).toBe(1);
  });
});
