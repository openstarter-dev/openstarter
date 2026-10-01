import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { buildMonotonePath, niceScale, type Point } from "./line-chart-utils";

/** 解析 buildMonotonePath 输出，把每段三次贝塞尔在 t∈(0,1] 上采样成点。 */
function samplePath(path: string): Point[] {
  const n = (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const first = n[0];
  const second = n[1];
  if (first === undefined || second === undefined) return [];
  const out: Point[] = [{ x: first, y: second }];
  for (let i = 2; i + 5 < n.length; i += 6) {
    const c1x = n[i + 0] ?? 0;
    const c1y = n[i + 1] ?? 0;
    const c2x = n[i + 2] ?? 0;
    const c2y = n[i + 3] ?? 0;
    const x = n[i + 4] ?? 0;
    const y = n[i + 5] ?? 0;
    const prev = out[out.length - 1] ?? { x: 0, y: 0 };
    for (let t = 0.02; t <= 1.001; t += 0.02) {
      const mt = 1 - t;
      out.push({
        x: mt ** 3 * prev.x + 3 * mt ** 2 * t * c1x + 3 * mt * t ** 2 * c2x + t ** 3 * x,
        y: mt ** 3 * prev.y + 3 * mt ** 2 * t * c1y + 3 * mt * t ** 2 * c2y + t ** 3 * y,
      });
    }
  }
  return out;
}

describe("niceScale", () => {
  it("把 0/负数/非有限值兜底成 { top: 1 }，不返回 NaN", () => {
    for (const max of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { step, ticks, top } = niceScale(max);
      expect(top).toBeGreaterThan(0);
      expect(step).toBeGreaterThan(0);
      expect(ticks).toEqual([0, top]);
    }
  });

  it("刻度从 0 起、等距、顶格 ≥ 最大值", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), (max) => {
        const { ticks, top } = niceScale(max);
        expect(ticks[0]).toBe(0);
        expect(ticks[ticks.length - 1]).toBe(top);
        expect(top).toBeGreaterThanOrEqual(max);
        const step = (ticks[1] ?? 0) - (ticks[0] ?? 0);
        expect(step).toBeGreaterThan(0);
        for (let i = 1; i < ticks.length; i += 1) {
          expect((ticks[i] ?? 0) - (ticks[i - 1] ?? 0)).toBeCloseTo(step, 10);
        }
      }),
    );
  });

  it("步长落在 1/2/2.5/5 × 10^k 上", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), (max) => {
        const { step } = niceScale(max);
        const magnitude = 10 ** Math.floor(Math.log10(step));
        const normalized = Number((step / magnitude).toFixed(10));
        expect([1, 2, 2.5, 5, 10]).toContain(normalized);
      }),
    );
  });
});

describe("buildMonotonePath", () => {
  it("空数组 → 空串；单点 → 只有 M", () => {
    expect(buildMonotonePath([])).toBe("");
    expect(buildMonotonePath([{ x: 5, y: 7 }])).toBe("M 5 7");
  });

  it("曲线段数 = 点数 - 1", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 2, maxLength: 30 }),
        (values) => {
          const points = values.map((y, x) => ({ x, y }));
          const segments = buildMonotonePath(points).split("C ").length - 1;
          expect(segments).toBe(values.length - 1);
        },
      ),
    );
  });

  // 这是选单调样条而非普通 Catmull-Rom 的理由：曲线下冲穿过 0 基线，
  // 等于把 0 画成负值。采样后每个 y 必须落在数据邻域内。
  it("非负数据的采样点不下冲到 0 以下", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 500 }), { minLength: 3, maxLength: 25 }),
        (values) => {
          const points = values.map((y, x) => ({ x, y }));
          const sampled = samplePath(buildMonotonePath(points));
          expect(sampled.length).toBeGreaterThan(0);
          for (const { y } of sampled) {
            expect(y).toBeGreaterThanOrEqual(-0.01);
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it("每个采样点落在该段两端值的区间内（单调性，含 SVG 倒 y 轴）", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 3, maxLength: 25 }),
        (values) => {
          // 用倒 y（y = 100 - v）模拟 SVG 坐标系，验证性质与方向无关。
          const points = values.map((v, x) => ({ x: x * 3, y: 100 - v }));
          const numbers = (buildMonotonePath(points).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
          let prevY = numbers[1] ?? 0;
          for (let i = 2; i + 5 < numbers.length; i += 6) {
            const c1y = numbers[i + 1] ?? 0;
            const c2y = numbers[i + 3] ?? 0;
            const y = numbers[i + 5] ?? 0;
            const lo = Math.min(prevY, y) - 0.01;
            const hi = Math.max(prevY, y) + 0.01;
            for (let t = 0; t <= 1.001; t += 0.02) {
              const mt = 1 - t;
              const sampled =
                mt ** 3 * prevY + 3 * mt ** 2 * t * c1y + 3 * mt * t ** 2 * c2y + t ** 3 * y;
              expect(sampled).toBeGreaterThanOrEqual(lo);
              expect(sampled).toBeLessThanOrEqual(hi);
            }
            prevY = y;
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it("严格单调的输入数据，采样 y 保持单调", () => {
    const ascending = Array.from({ length: 12 }, (_, x) => ({ x, y: x * 2 }));
    const sampled = samplePath(buildMonotonePath(ascending));
    for (let i = 1; i < sampled.length; i += 1) {
      expect(sampled[i]?.y).toBeGreaterThanOrEqual((sampled[i - 1]?.y ?? 0) - 0.01);
    }
  });

  it("等间距与不等间距输入都不抛错，且终点闭合到最后一个数据点", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 2, maxLength: 20 }),
        fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 2, maxLength: 20 }),
        (values, gaps) => {
          let x = 0;
          const points = values.map((y, index) => {
            const point = { x, y };
            x += gaps[index % gaps.length] ?? 1;
            return point;
          });
          const numbers = (buildMonotonePath(points).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
          const last = points[points.length - 1] ?? { x: 0, y: 0 };
          expect(numbers[numbers.length - 2]).toBeCloseTo(last.x, 2);
          expect(numbers[numbers.length - 1]).toBeCloseTo(last.y, 2);
        },
      ),
    );
  });
});
