import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi, beforeAll } from "vitest";

const routerState = vi.hoisted(() => ({ pathname: "/dashboard" }));
const sessionResult = vi.hoisted(() => ({
  current: {
    data: {
      session: { token: "current-token" },
      user: { email: "user@example.com", name: "Test User" },
    },
    isPending: false,
  } as {
    data: null | {
      session: { token: string };
      user: { email: string; name: string };
    };
    isPending: boolean;
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => sessionResult.current,
  },
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: vi.fn(), theme: "system" }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: (props: { children?: ReactNode; to: string }) => (
    <a href={props.to} {...props}>
      {props.children}
    </a>
  ),
  Outlet: () => <div data-testid="outlet" />,
  useMatchRoute:
    () =>
    (opts: { fuzzy?: boolean; to: string }): boolean => {
      const { pathname } = routerState;
      return pathname === opts.to || (opts.fuzzy === true && pathname.startsWith(`${opts.to}/`));
    },
  useRouteContext: () => ({ session: null }),
  useNavigate: () => vi.fn(() => Promise.resolve()),
  useRouter: () => ({ invalidate: vi.fn(() => Promise.resolve()) }),
  useRouterState: (opts?: { select?: (s: unknown) => unknown }) => {
    const state = { location: { pathname: routerState.pathname } };
    return opts?.select ? opts.select(state) : state;
  },
}));

import { AppShell } from "./app-shell";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }),
    writable: true,
  });
});

beforeEach(() => {
  routerState.pathname = "/dashboard";
  sessionResult.current = {
    data: {
      session: { token: "current-token" },
      user: { email: "user@example.com", name: "Test User" },
    },
    isPending: false,
  };
  document.cookie = "sidebar_state=; path=/; max-age=0";
});

const renderShell = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AppShell />
    </QueryClientProvider>,
  );

const getSidebar = () =>
  document.querySelector<HTMLElement>('[data-slot="sidebar"]:not([data-mobile])');

describe("AppShell", () => {
  it("renders brand, primary navigation and the user menu", () => {
    renderShell();

    expect(screen.getAllByText("openstarter").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Test User/ })).toBeTruthy();
    expect(screen.getByTestId("outlet")).toBeTruthy();
  });

  it("toggles between expanded and icon-collapsed states", () => {
    renderShell();
    const sidebar = getSidebar();
    expect(sidebar?.dataset.state).toBe("expanded");

    fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));

    expect(sidebar?.dataset.state).toBe("collapsed");
    expect(sidebar?.dataset.collapsible).toBe("icon");
  });

  it("persists the toggled state in the sidebar cookie", () => {
    renderShell();

    fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));

    expect(document.cookie).toContain("sidebar_state=false");
  });

  it("marks the nav item matching the current pathname as active", () => {
    routerState.pathname = "/settings/profile";
    renderShell();

    const active = document.querySelector<HTMLElement>(
      'a[data-sidebar="menu-button"][data-active="true"]',
    );
    expect(active?.textContent).toContain("Settings");
  });
});

describe("AppHeader", () => {
  it("renders the sidebar trigger and the current section title", () => {
    routerState.pathname = "/settings/profile";
    renderShell();

    expect(screen.getByRole("button", { name: /toggle sidebar/i })).toBeTruthy();
    const header = document.querySelector("header");
    expect(header?.textContent).toContain("Settings");
  });

  it("omits the section title on unmatched paths", () => {
    routerState.pathname = "/device";
    renderShell();

    const header = document.querySelector("header");
    expect(header?.textContent).not.toContain("Dashboard");
    expect(header?.textContent).not.toContain("Settings");
  });
});
