import type { SendEmailParams } from "@openstarter/email/server";
import { getTestInstance } from "better-auth/test";
import fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";

import { createAuthEmailCallbacks } from "./email-callbacks";

const TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789".split("");
const tokenArbitrary = fc
  .array(fc.constantFrom(...TOKEN_ALPHABET), { maxLength: 32, minLength: 12 })
  .map((characters) => characters.join(""));
const localPartArbitrary = fc
  .array(fc.constantFrom(...TOKEN_ALPHABET), { maxLength: 24, minLength: 1 })
  .map((characters) => characters.join(""));

interface StoredUser {
  email: string;
  id: string;
}

interface StoredAccount {
  password?: string | null;
  providerId: string;
  userId: string;
}

const byField = (field: string, value: string) => [{ field, value }];

const deliveries: SendEmailParams[] = [];

const captureEmail = (params: SendEmailParams): Promise<void> => {
  deliveries.push(params);
  return Promise.resolve();
};

const createPasswordResetTestInstance = () => {
  const callbacks = createAuthEmailCallbacks(captureEmail);
  return getTestInstance(
    {
      emailAndPassword: {
        enabled: true,
        sendResetPassword: callbacks.sendResetPassword,
      },
      logger: { disabled: true },
    },
    {
      port: 3000,
      testUser: { email: "registered@example.com" },
    },
  );
};

type AuthTestInstance = Awaited<ReturnType<typeof createPasswordResetTestInstance>>;

let instance: AuthTestInstance;

const requestPasswordReset = async (email: string) => {
  const response = await instance.customFetchImpl(
    "http://localhost:3000/api/auth/request-password-reset",
    {
      body: JSON.stringify({
        email,
        redirectTo: "http://localhost:3000/reset-password",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
  return {
    body: await response.json(),
    status: response.status,
  };
};

beforeAll(async () => {
  instance = await createPasswordResetTestInstance();
});

describe("password reset security properties", () => {
  it("Feature: shipany-feature-parity, Property 8: 无效或过期重置令牌被拒", async () => {
    const user = await instance.db.findOne<StoredUser>({
      model: "user",
      where: byField("email", instance.testUser.email),
    });
    if (!user) {
      throw new Error("Expected deterministic auth test user");
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({ expired: fc.boolean(), token: tokenArbitrary }),
        async ({ expired, token }) => {
          if (expired) {
            await instance.db.create({
              data: {
                expiresAt: new Date(0),
                identifier: `reset-password:${token}`,
                value: user.id,
              },
              model: "verification",
            });
          }
          const accountsBefore = await instance.db.findMany<StoredAccount>({
            model: "account",
            where: byField("userId", user.id),
          });
          const passwordBefore = accountsBefore.find(
            (account) => account.providerId === "credential",
          )?.password;

          const response = await instance.customFetchImpl(
            "http://localhost:3000/api/auth/reset-password",
            {
              body: JSON.stringify({
                newPassword: "Replacement-password-456",
                token,
              }),
              headers: { "content-type": "application/json" },
              method: "POST",
            },
          );
          const accountsAfter = await instance.db.findMany<StoredAccount>({
            model: "account",
            where: byField("userId", user.id),
          });
          const passwordAfter = accountsAfter.find(
            (account) => account.providerId === "credential",
          )?.password;

          expect(response.status).toBe(400);
          expect(passwordAfter).toBe(passwordBefore);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Feature: shipany-feature-parity, Property 9: 密码重置防账户枚举", async () => {
    await fc.assert(
      fc.asyncProperty(localPartArbitrary, async (localPart) => {
        const registered = await requestPasswordReset(instance.testUser.email);
        const missing = await requestPasswordReset(`missing-${localPart}@example.test`);

        expect(missing.status).toBe(registered.status);
        expect(missing.body).toEqual(registered.body);
      }),
      { numRuns: 100 },
    );

    expect(deliveries.length).toBeGreaterThan(0);
  });
});
