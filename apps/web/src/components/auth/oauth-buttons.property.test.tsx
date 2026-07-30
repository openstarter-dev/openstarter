import { render, within } from "@testing-library/react";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  social: vi.fn(),
  useSession: vi.fn(() => ({ isPending: false })),
}));
const navigateMock = vi.hoisted(() => vi.fn());
const publicConfigResult = vi.hoisted(() => ({
  current: {} as Record<string, string>,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: authMocks.signInEmail,
      social: authMocks.social,
    },
    signUp: {
      email: authMocks.signUpEmail,
    },
    useSession: authMocks.useSession,
  },
}));

vi.mock("@/lib/use-public-config", () => ({
  usePublicConfig: () => ({ data: publicConfigResult.current }),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const router =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...router, useNavigate: () => navigateMock };
});

import { OAuthButtons } from "./oauth-buttons";
import { getEnabledOAuthProviders } from "./oauth-provider-selection";
import SignInForm from "./sign-in-form";
import SignUpForm from "./sign-up-form";

const CONTINUE_WITH_PATTERN = /^Continue with/u;
const providerConfigArbitrary = fc.record({
  github: fc.boolean(),
  google: fc.boolean(),
});

describe("OAuth provider visibility", () => {
  it("Feature: shipany-feature-parity, Property 7: OAuth 登录入口与启用集合一致", () => {
    fc.assert(
      fc.property(providerConfigArbitrary, ({ google, github }) => {
        const enabledProviders = getEnabledOAuthProviders({
          github_auth_enabled: String(github),
          google_auth_enabled: String(google),
        });
        const view = render(
          <OAuthButtons
            githubEnabled={enabledProviders.includes("github")}
            googleEnabled={enabledProviders.includes("google")}
          />
        );
        const renderedProviders = within(view.container)
          .queryAllByRole("button")
          .map((button) =>
            button.textContent?.includes("Google") ? "google" : "github"
          );

        expect(new Set(renderedProviders)).toEqual(new Set(enabledProviders));
        view.unmount();
      }),
      { numRuns: 100 }
    );
  });

  it("P7 SignInForm and SignUpForm map public config to an exact provider list", () => {
    fc.assert(
      fc.property(providerConfigArbitrary, ({ google, github }) => {
        publicConfigResult.current = {
          apple_auth_enabled: "true",
          github_auth_enabled: String(github),
          github_auth_enabled_duplicate: "true",
          google_auth_enabled: String(google),
          google_auth_enabled_duplicate: "true",
          oauth_providers: "google,google,github,unknown",
        };
        const expectedProviders = [
          ...(google ? ["google"] : []),
          ...(github ? ["github"] : []),
        ];
        const expectedButtonNames = expectedProviders.map(
          (provider) =>
            `Continue with ${provider === "google" ? "Google" : "GitHub"}`
        );

        expect(getEnabledOAuthProviders(publicConfigResult.current)).toEqual(
          expectedProviders
        );

        const signInView = render(
          <SignInForm onSwitchToSignUp={() => undefined} />
        );
        const signInButtons = within(signInView.container);
        expect(
          signInButtons.queryAllByRole("button", {
            name: CONTINUE_WITH_PATTERN,
          })
        ).toHaveLength(expectedButtonNames.length);
        for (const buttonName of expectedButtonNames) {
          expect(
            signInButtons.queryAllByRole("button", { name: buttonName })
          ).toHaveLength(1);
        }
        signInView.unmount();

        const signUpView = render(
          <SignUpForm onSwitchToSignIn={() => undefined} />
        );
        const signUpButtons = within(signUpView.container);
        expect(
          signUpButtons.queryAllByRole("button", {
            name: CONTINUE_WITH_PATTERN,
          })
        ).toHaveLength(expectedButtonNames.length);
        for (const buttonName of expectedButtonNames) {
          expect(
            signUpButtons.queryAllByRole("button", { name: buttonName })
          ).toHaveLength(1);
        }
        signUpView.unmount();
      }),
      { numRuns: 100 }
    );
  });
});
