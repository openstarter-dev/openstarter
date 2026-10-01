// 积分动态图组件测试：SVG 渲染（两条序列路径 + 图例 + sr-only 表视图）、
// 指针/键盘读数、pending 骨架。ResizeObserver 以固定宽度打桩，使绘图层在 jsdom 下可测。

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { CreditActivityChart } from "./credit-activity-chart";
import type { DashboardStats } from "./stats-view";

const CHART_WIDTH = 640;

beforeAll(() => {
  // jsdom 无 ResizeObserver：observe 时立即以固定 contentRect 回放一次。
  class ResizeObserverStub {
    private readonly observerCallback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.observerCallback = callback;
    }
    observe(target: Element) {
      const entry = { contentRect: { width: CHART_WIDTH } } as unknown as ResizeObserverEntry;
      this.observerCallback([entry], this as unknown as ResizeObserver);
      void target;
    }
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function statsFixture(days: number): DashboardStats {
  return {
    activeApiKeys: 2,
    balance: 100,
    creditsConsumed30d: 42,
    creditsGranted30d: 84,
    ordersCount: 1,
    paidOrdersCount: 1,
    spendTotal: null,
    trend: Array.from({ length: days }, (_, index) => ({
      consumed: 3 + ((index * 7) % 23),
      date: `2026-08-${String(index + 1).padStart(2, "0")}`,
      granted: 5 + ((index * 13) % 41),
    })),
  };
}

const stats = statsFixture(30);

function renderChart() {
  return render(<CreditActivityChart isPending={false} stats={stats} />);
}

describe("CreditActivityChart", () => {
  it("pending 时只渲染骨架，不出图表", () => {
    const { container } = render(<CreditActivityChart isPending stats={undefined} />);
    expect(container.querySelector('[data-slot="line-chart"]')).toBeNull();
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("渲染两条序列路径、图例与表视图孪生", () => {
    renderChart();
    const chart = document.querySelector('[data-slot="line-chart"]');
    expect(chart).not.toBeNull();
    const paths = Array.from(chart?.querySelectorAll("svg path") ?? []);
    expect(paths).toHaveLength(2);
    for (const path of paths) {
      const d = path.getAttribute("d") ?? "";
      expect(d.startsWith("M ")).toBe(true);
      // 29 段三次曲线（30 个点）。
      expect((d.match(/C /g) ?? []).length).toBe(29);
    }
    // 图例 + 表头都会出现序列名，取图例行校验。
    expect(screen.getAllByText("Granted").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Used").length).toBeGreaterThan(0);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(31); // 表头 + 30 天
  });

  it("空趋势数据不抛错，控件仍在", () => {
    render(<CreditActivityChart isPending={false} stats={statsFixture(0)} />);
    expect(document.querySelector('[data-slot="line-chart"]')).not.toBeNull();
    expect(screen.getByRole("slider")).toBeTruthy();
  });

  it("键盘导航经 slider aria 读出日期与两序列值", () => {
    renderChart();
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider.getAttribute("aria-valuenow")).toBe("1");
    const first = stats.trend[0];
    expect(slider.getAttribute("aria-valuetext")).toBe(
      `${first.date}: Granted ${first.granted}, Used ${first.consumed}`,
    );
    fireEvent.keyDown(slider, { key: "End" });
    expect(slider.getAttribute("aria-valuenow")).toBe("30");
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(slider.getAttribute("aria-valuenow")).toBe("29");
    fireEvent.keyDown(slider, { key: "Escape" });
    expect(slider.getAttribute("aria-valuenow")).toBeNull();
  });

  it("鼠标按 x 吸附最近数据点，离开即收起读数", () => {
    renderChart();
    const slider = screen.getByRole("slider");
    // jsdom 的 getBoundingClientRect 全 0：localX = clientX；左内边距 48，末点 x = 48+576。
    fireEvent.mouseMove(slider, { clientX: 48 });
    expect(slider.getAttribute("aria-valuenow")).toBe("1");
    expect(slider.getAttribute("aria-valuetext")).toContain(stats.trend[0].date);
    fireEvent.mouseMove(slider, { clientX: 624 });
    expect(slider.getAttribute("aria-valuenow")).toBe("30");
    expect(slider.getAttribute("aria-valuetext")).toContain(stats.trend[29].date);
    fireEvent.mouseLeave(slider);
    expect(slider.getAttribute("aria-valuenow")).toBeNull();
  });
});
