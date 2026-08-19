import { EmailTemplate } from "@openstarter/email";
import type { SendEmailParams } from "@openstarter/email/server";
import { getTestInstance } from "better-auth/test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createAuthEmailCallbacks, createChangeEmailOptions } from "./email-callbacks";

interface StoredUser {
  email: string;
  id: string;
}

const byField = (field: string, value: string) => [{ field, value }];
const deliveries: SendEmailParams[] = [];

const captureEmail = (params: SendEmailParams): Promise<void> => {
  deliveries.push(params);
  return Promise.resolve();
};

const createConfirmationTestInstance = () => {
  const callbacks = createAuthEmailCallbacks(captureEmail);
  return getTestInstance(
    {
      emailAndPassword: { enabled: true },
      emailVerification: {
        sendVerificationEmail: callbacks.sendVerificationEmail,
      },
      logger: { disabled: true },
      user: {
        changeEmail: createChangeEmailOptions(callbacks.sendChangeEmailConfirmation),
        deleteUser: {
          enabled: true,
          sendDeleteAccountVerification: callbacks.sendDeleteAccountVerification,
        },
      },
    },
    {
      port: 3010,
      testUser: { email: "confirmation@example.com" },
    },
  );
};

type AuthTestInstance = Awaited<ReturnType<typeof createConfirmationTestInstance>>;

let instance: AuthTestInstance;

const findUserByEmail = (email: string) =>
  instance.db.findOne<StoredUser>({
    model: "user",
    where: byField("email", email),
  });
const findUserById = (id: string) =>
  instance.db.findOne<StoredUser>({
    model: "user",
    where: byField("id", id),
  });

const callbackUrlFromDelivery = (delivery: SendEmailParams): URL => {
  const deliveryUrl = delivery.variables.url;
  if (typeof deliveryUrl !== "string") {
    throw new Error("Expected confirmation delivery URL");
  }
  return new URL(deliveryUrl);
};

const requiredDelivery = (index: number): SendEmailParams => {
  const delivery = deliveries.at(index);
  if (!delivery) {
    throw new Error(`Expected email delivery at index ${index}`);
  }
  return delivery;
};

beforeAll(async () => {
  instance = await createConfirmationTestInstance();
});

beforeEach(() => {
  deliveries.length = 0;
});

describe("account confirmation email flows", () => {
  it("sends CHANGE_EMAIL and keeps an unverified user's old email until confirmation", async () => {
    const email = "unverified-change@example.com";
    const newEmail = "unverified-changed@example.com";
    const password = "Unverified-password-123";
    const signUp = await instance.client.signUp.email({
      email,
      name: "Unverified change target",
      password,
    });
    if (!signUp.data?.user) {
      throw new Error("Expected deterministic unverified change target");
    }
    const signedIn = await instance.signInWithUser(email, password);

    await instance.auth.api.changeEmail({
      body: { newEmail },
      headers: signedIn.headers,
    });

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({
      template: EmailTemplate.CHANGE_EMAIL,
      to: newEmail,
      variables: { newEmail },
    });
    expect(await findUserByEmail(email)).not.toBeNull();
    expect(await findUserByEmail(newEmail)).toBeNull();

    const callbackUrl = callbackUrlFromDelivery(requiredDelivery(0));
    const response = await instance.auth.handler(
      new Request(callbackUrl, { headers: signedIn.headers }),
    );

    expect(response.status).toBe(302);
    expect(await findUserByEmail(email)).toBeNull();
    expect(await findUserByEmail(newEmail)).not.toBeNull();
  });

  it("sends CHANGE_EMAIL and changes the email only after confirmation", async () => {
    const initialSignIn = await instance.signInWithTestUser();
    await instance.db.update({
      model: "user",
      update: { emailVerified: true },
      where: byField("id", initialSignIn.user.id),
    });
    const signedIn = await instance.signInWithUser(
      instance.testUser.email,
      instance.testUser.password,
    );
    const newEmail = "changed@example.com";

    await instance.auth.api.changeEmail({
      body: { newEmail },
      headers: signedIn.headers,
    });

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({
      template: EmailTemplate.CHANGE_EMAIL,
      to: instance.testUser.email,
      variables: { newEmail },
    });
    expect(await findUserByEmail(newEmail)).toBeNull();

    const oldEmailCallback = callbackUrlFromDelivery(requiredDelivery(0));
    const oldEmailResponse = await instance.auth.handler(
      new Request(oldEmailCallback, { headers: signedIn.headers }),
    );

    expect(oldEmailResponse.status).toBe(302);
    expect(await findUserByEmail(newEmail)).toBeNull();
    expect(deliveries).toHaveLength(2);
    expect(deliveries[1]).toMatchObject({
      template: EmailTemplate.CONFIRM_EMAIL,
      to: newEmail,
    });

    const newEmailCallback = callbackUrlFromDelivery(requiredDelivery(1));
    const newEmailResponse = await instance.auth.handler(
      new Request(newEmailCallback, { headers: signedIn.headers }),
    );

    expect(newEmailResponse.status).toBe(302);
    expect(await findUserByEmail(newEmail)).not.toBeNull();
  });

  it("sends DELETE_ACCOUNT and deletes the account only after confirmation", async () => {
    const email = "delete-target@example.com";
    const password = "Delete-password-123";
    const signUp = await instance.client.signUp.email({
      email,
      name: "Delete target",
      password,
    });
    if (!signUp.data?.user) {
      throw new Error("Expected deterministic delete target");
    }
    const signedIn = await instance.signInWithUser(email, password);
    const currentUser = await findUserByEmail(email);
    if (!currentUser) {
      throw new Error("Expected deterministic delete target in storage");
    }

    await instance.auth.api.deleteUser({
      body: { callbackURL: "http://localhost:3010/goodbye" },
      headers: signedIn.headers,
    });

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({
      template: EmailTemplate.DELETE_ACCOUNT,
      to: email,
    });
    expect(await findUserById(currentUser.id)).not.toBeNull();

    const callbackUrl = callbackUrlFromDelivery(requiredDelivery(0));
    const response = await instance.auth.handler(
      new Request(callbackUrl, { headers: signedIn.headers }),
    );

    expect(response.status).toBe(302);
    expect(await findUserById(currentUser.id)).toBeNull();
  });
});
