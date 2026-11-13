import { PlatformRole } from "@openstarter/auth";
import { account, user } from "@openstarter/db/schema";

import { db } from "@openstarter/db/server";
import { DEFAULT_APP_URL } from "@openstarter/shared/constants";
import { getUuid } from "@openstarter/shared/id";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";


interface SeedOptions {
  email: string;
  name: string;
  password: string;
}

function parseArgs(argv: string[]): Partial<SeedOptions> {
  const options: Partial<SeedOptions> = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i] ?? "";
    switch (arg) {
      case "--email":
      case "-e": {
        i += 1;
        options.email = argv[i];
        break;
      }
      case "--password":
      case "-p": {
        i += 1;
        options.password = argv[i];
        break;
      }
      case "--name":
      case "-n": {
        i += 1;
        options.name = argv[i];
        break;
      }
      default: {
        if (arg.startsWith("--email=")) {
          options.email = arg.slice("--email=".length);
        } else if (arg.startsWith("--password=")) {
          options.password = arg.slice("--password=".length);
        } else if (arg.startsWith("--name=")) {
          options.name = arg.slice("--name=".length);
        }
        break;
      }
    }
    i += 1;
  }
  return options;
}

const overrides = parseArgs(process.argv.slice(2));

const ADMIN_EMAIL = overrides.email ?? process.env.SEED_EMAIL ?? "admin@openstarter.dev";
const ADMIN_PASSWORD = overrides.password ?? process.env.SEED_PASSWORD ?? "Admin@123456";
const ADMIN_NAME = overrides.name ?? "Admin";

if (!ADMIN_EMAIL.includes("@") || ADMIN_PASSWORD.length < 8) {
  console.error("[seed-admin] 参数校验失败:email 需合法、密码至少 8 位。当前值被拒绝。");
  console.error(`  email:    ${ADMIN_EMAIL}`);
  console.error(`  password: ${"*".repeat(ADMIN_PASSWORD.length)}`);
  process.exit(1);
}


async function seedAdmin(options: SeedOptions): Promise<void> {
  const { email, password, name } = options;
  const passwordHash = await hashPassword(password);
  const now = new Date();

  const [existingUser] = await db().select().from(user).where(eq(user.email, email)).limit(1);
  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
    await db()
      .update(user)
      .set({ emailVerified: true, name, role: PlatformRole.ADMIN, updatedAt: now })
      .where(eq(user.id, userId));
    console.log(`[seed-admin] updated existing user: ${email}`);
  } else {
    userId = getUuid();
    await db().insert(user).values({
      banned: false,
      createdAt: now,
      email,
      emailVerified: true,
      id: userId,
      image: null,
      ip: "",
      isAnonymous: false,
      locale: "",
      name,
      role: PlatformRole.ADMIN,
      updatedAt: now,
      utmSource: "",
    });
    console.log(`[seed-admin] created user: ${email}`);
  }

  const [existingAccountRow] = await db()
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
    .limit(1);
  if (existingAccountRow) {
    await db()
      .update(account)
      .set({ password: passwordHash, updatedAt: now })
      .where(eq(account.id, existingAccountRow.id));
    console.log("[seed-admin] updated credential account password");
  } else {
    await db().insert(account).values({
      accountId: userId,
      createdAt: now,
      id: getUuid(),
      password: passwordHash,
      providerId: "credential",
      updatedAt: now,
      userId,
    });
    console.log("[seed-admin] created credential account");
  }

  console.log(`[seed-admin] role: ${PlatformRole.ADMIN}`);

  const loginUrl = (process.env.VITE_APP_URL ?? DEFAULT_APP_URL).replace(/\/+$/, "");
  console.log("");
  console.log("================ Admin seed complete ================");
  console.log(`  Login URL : ${loginUrl}/login  (then open ${loginUrl}/admin)`);
  console.log(`  Email     : ${email}`);
  console.log(`  Password  : ${password}`);
  console.log("=====================================================");
}

seedAdmin({ email: ADMIN_EMAIL, name: ADMIN_NAME, password: ADMIN_PASSWORD })
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("[seed-admin] failed:", error);
    process.exit(1);
  });
