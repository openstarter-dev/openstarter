import { parseSetCookieHeader } from "better-auth/cookies";
import { bearer } from "better-auth/plugins/bearer";
import { getTestInstance } from "better-auth/test";
import { beforeAll, describe, expect, it } from "vitest";

const createBearerTestInstance = () =>
  getTestInstance(
    {
      logger: { disabled: true },
      plugins: [bearer({ requireSignature: true })],
    },
    { port: 3100, testUser: { email: "bearer-test@example.com" } },
  );

type AuthTestInstance = Awaited<ReturnType<typeof createBearerTestInstance>>;

let instance: AuthTestInstance;

beforeAll(async () => {
  instance = await createBearerTestInstance();
});

describe("bearer plugin session bridging", () => {
  it("accepts the session cookie value as a Bearer token", async () => {
    const signInResponse = await instance.customFetchImpl(
      "http://localhost:3100/api/auth/sign-in/email",
      {
        body: JSON.stringify({
          email: instance.testUser.email,
          password: instance.testUser.password,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );
    const setCookie = signInResponse.headers.get("set-cookie") ?? "";
    const sessionToken = parseSetCookieHeader(setCookie).get("better-auth.session_token")?.value;
    if (!sessionToken) {
      throw new Error("Expected a session token cookie after sign-in");
    }

    const response = await instance.customFetchImpl("http://localhost:3100/api/auth/get-session", {
      headers: { authorization: `Bearer ${sessionToken}` },
      method: "GET",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body?.user?.email).toBe(instance.testUser.email);
  });

  it("rejects a request with no Authorization header and no cookie", async () => {
    const response = await instance.customFetchImpl("http://localhost:3100/api/auth/get-session", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toBeNull();
  });
});
