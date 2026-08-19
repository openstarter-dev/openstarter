import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const EMAIL_LABEL_PATTERN = /Type your email/u;
const authMocks = vi.hoisted(() => ({
  deleteUser: vi.fn(),
  linkSocial: vi.fn(),
  listAccounts: vi.fn(),
  listSessions: vi.fn(),
  revokeOtherSessions: vi.fn(),
  revokeSession: vi.fn(),
  unlinkAccount: vi.fn(),
}));
const navigateMock = vi.hoisted(() => vi.fn());
const sessionResult = vi.hoisted(() => ({
  current: {
    data: {
      session: { token: "current-token" },
      user: { email: "user@example.com" },
    },
    isPending: false,
  } as {
    data: null | {
      session: { token: string };
      user: { email: string };
    };
    isPending: boolean;
  },
}));
const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    ...authMocks,
    useSession: () => sessionResult.current,
  },
}));

vi.mock("sonner", () => ({ toast: toastMocks }));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const router = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...router, useNavigate: () => navigateMock };
});

import { Route as AccountsRoute } from "./accounts";
import { Route as DangerRoute } from "./danger";
import { Route as SessionsRoute } from "./sessions";

const renderWithQuery = (node: ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
};

const AccountsPage = AccountsRoute.options.component as ComponentType;
const DangerPage = DangerRoute.options.component as ComponentType;
const SessionsPage = SessionsRoute.options.component as ComponentType;

const account = (overrides: { id: string; providerId: string }) => ({
  accountId:
    overrides.providerId === "credential" ? "user@example.com" : `${overrides.providerId}-account`,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  userId: "user-1",
  ...overrides,
});

const sessions = [
  {
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    expiresAt: new Date("2026-02-02T00:00:00.000Z"),
    id: "current-id",
    ipAddress: "127.0.0.1",
    token: "current-token",
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    userAgent: "Current/1.0",
    userId: "user-1",
  },
  {
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: new Date("2026-02-01T00:00:00.000Z"),
    id: "other-id",
    ipAddress: "127.0.0.2",
    token: "other-token",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    userAgent: "Other/1.0",
    userId: "user-1",
  },
];

beforeEach(() => {
  for (const mock of Object.values(authMocks)) {
    mock.mockReset();
  }
  navigateMock.mockReset();
  toastMocks.error.mockReset();
  toastMocks.success.mockReset();
  sessionResult.current = {
    data: {
      session: { token: "current-token" },
      user: { email: "user@example.com" },
    },
    isPending: false,
  };
});

describe("Settings account data", () => {
  it("loads and unlinks accounts with providerId and accountId", async () => {
    authMocks.listAccounts.mockResolvedValue({
      data: [
        account({ id: "account-row", providerId: "google" }),
        account({ id: "credential-row", providerId: "credential" }),
      ],
      error: null,
    });
    authMocks.unlinkAccount.mockResolvedValue({ data: true, error: null });

    renderWithQuery(<AccountsPage />);

    expect(await screen.findByText("Google")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Unlink" }).at(0) as HTMLButtonElement);

    await waitFor(() => {
      expect(authMocks.unlinkAccount).toHaveBeenCalledWith({
        accountId: "google-account",
        providerId: "google",
      });
    });
  });

  it("serializes unlink requests across every account", async () => {
    authMocks.listAccounts.mockResolvedValue({
      data: [
        account({ id: "google-row", providerId: "google" }),
        account({ id: "credential-row", providerId: "credential" }),
      ],
      error: null,
    });
    authMocks.unlinkAccount.mockResolvedValue({ data: true, error: null });

    renderWithQuery(<AccountsPage />);

    const unlinkButtons = await screen.findAllByRole("button", {
      name: "Unlink",
    });
    fireEvent.click(unlinkButtons.at(0) as HTMLButtonElement);
    fireEvent.click(unlinkButtons.at(1) as HTMLButtonElement);

    expect(authMocks.unlinkAccount).toHaveBeenCalledTimes(1);
  });

  it("never unlinks the final sign-in method", async () => {
    authMocks.listAccounts.mockResolvedValue({
      data: [account({ id: "account-row", providerId: "google" })],
      error: null,
    });

    renderWithQuery(<AccountsPage />);

    const unlink = await screen.findByRole("button", { name: "Unlink" });
    expect((unlink as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(unlink);
    expect(authMocks.unlinkAccount).not.toHaveBeenCalled();
  });
});

describe("Settings session data", () => {
  it("protects the current session and revokes another by token", async () => {
    authMocks.listSessions.mockResolvedValue({ data: sessions, error: null });
    authMocks.revokeSession.mockResolvedValue({ data: null, error: null });

    renderWithQuery(<SessionsPage />);

    const revokeButtons = await screen.findAllByRole("button", {
      name: "Revoke",
    });
    expect((revokeButtons.at(0) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(revokeButtons.at(-1) as HTMLButtonElement);

    await waitFor(() => {
      expect(authMocks.revokeSession).toHaveBeenCalledWith({
        token: "other-token",
      });
    });
  });

  it("disables every session revoke action while current session loads", async () => {
    sessionResult.current = { data: null, isPending: true };
    authMocks.listSessions.mockResolvedValue({ data: sessions, error: null });

    renderWithQuery(<SessionsPage />);

    const revokeButtons = await screen.findAllByRole("button", {
      name: "Revoke",
    });
    for (const button of revokeButtons) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(authMocks.revokeSession).not.toHaveBeenCalled();
  });

  it("revokes all sessions except the current one", async () => {
    authMocks.listSessions.mockResolvedValue({ data: sessions, error: null });
    authMocks.revokeOtherSessions.mockResolvedValue({
      data: null,
      error: null,
    });

    renderWithQuery(<SessionsPage />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Revoke all other sessions",
      }),
    );

    await waitFor(() => {
      expect(authMocks.revokeOtherSessions).toHaveBeenCalledTimes(1);
    });
  });
});

describe("Settings account deletion", () => {
  it("reports a verification email without claiming immediate deletion", async () => {
    authMocks.deleteUser.mockResolvedValue({
      data: { message: "Verification email sent", success: true },
      error: null,
    });

    renderWithQuery(<DangerPage />);
    fireEvent.change(screen.getByLabelText(EMAIL_LABEL_PATTERN), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    await waitFor(() => {
      expect(toastMocks.success).toHaveBeenCalledWith("Verification email sent");
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
