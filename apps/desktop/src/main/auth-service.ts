import { ApiRequest, ApiResponse } from "./api-proxy";
import { TokenStore } from "./token-store";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

export interface AuthResult {
  user: AuthUser;
}

export interface AuthService {
  signInWithEmail(email: string, password: string): Promise<AuthResult>;
  getSession(): Promise<AuthResult | null>;
  signOut(): Promise<void>;
}

export interface AuthServiceOptions {
  baseUrl: string;
  tokenStore: TokenStore;
  apiRequest: (req: ApiRequest) => Promise<ApiResponse>;
  fetchFn?: typeof fetch;
}

export function createAuthService(options: AuthServiceOptions): AuthService {
  const { baseUrl, tokenStore, apiRequest, fetchFn = fetch } = options;

  return {
    async signInWithEmail(email: string, password: string): Promise<AuthResult> {
      const response = await fetchFn(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        let message = `Sign-in failed (${response.status})`;
        try {
          const rawBody: unknown = await response.json();
          const body = rawBody as { message?: string; error?: { message?: string } };
          message = body.message || body.error?.message || message;
        } catch {
          /* use default message */
        }
        throw new Error(message);
      }

      // Extract session token from Set-Cookie header
      const cookies: string[] = [];
      if (typeof response.headers.getSetCookie === "function") {
        cookies.push(...response.headers.getSetCookie());
      } else {
        const setCookie = response.headers.get("set-cookie");
        if (setCookie) cookies.push(setCookie);
      }

      const sessionCookie = cookies.find((c) =>
        c.startsWith("openstarter.session_token=")
      );
      if (!sessionCookie) {
        throw new Error("No session token in response");
      }

      const token = sessionCookie.split(";")[0]!.split("=").slice(1).join("=");

      // Parse body before storing token — if body parse fails, no orphaned token
      const rawBody: unknown = await response.json();
      const body = rawBody as {
        user?: AuthUser;
        data?: { user?: AuthUser };
      };
      const user = body.user || body.data?.user;
      if (!user) {
        throw new Error("No user in response");
      }

      tokenStore.set(token);
      return { user };
    },

    async getSession(): Promise<AuthResult | null> {
      const token = tokenStore.get();
      if (!token) return null;

      const result = await apiRequest({ method: "GET", path: "/api/auth/get-session" });
      if (result.code !== 200) return null;

      const user = (result.data as { user?: AuthUser })?.user;
      if (!user) return null;

      return { user };
    },

    async signOut(): Promise<void> {
      try {
        await apiRequest({ method: "POST", path: "/api/auth/sign-out" });
      } finally {
        // Always clear the local token, even if the API call fails
        tokenStore.clear();
      }
    },
  };
}