// packages/auth/scripts/seed-admin-impl.ts
// 由 seed-admin.ts 在注入 apps/web/.env 后动态加载的实现模块。
//
// 密码使用与 Better-Auth 一致的 scrypt 实现（`better-auth/crypto.hashPassword`),
// 写入 `account` 表的 `password` 字段;后续用该 email/password 在 /login 登录
// 即可获得平台级 `admin.*` 权限并访问 /admin。

import {
  assignPermissionsToRole,
  assignRoleToUser,
  createPermission,
  createRole,
  getRoleByName,
} from "@openstarter/auth";
import {
  account,
  permission,
  rolePermission,
  user,
} from "@openstarter/db/schema";

import { db } from "@openstarter/db/server";
import { getUuid } from "@openstarter/shared/id";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

// ─── 参数解析 ─────────────────────────────────────────────────────────────

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

const ADMIN_EMAIL =
  overrides.email ?? process.env.SEED_EMAIL ?? "admin@openstarter.dev";
const ADMIN_PASSWORD =
  overrides.password ?? process.env.SEED_PASSWORD ?? "Admin@123456";
const ADMIN_NAME = overrides.name ?? "Admin";

if (!ADMIN_EMAIL.includes("@") || ADMIN_PASSWORD.length < 8) {
  console.error(
    "[seed-admin] 参数校验失败:email 需合法、密码至少 8 位。当前值被拒绝。"
  );
  console.error(`  email:    ${ADMIN_EMAIL}`);
  console.error(`  password: ${"*".repeat(ADMIN_PASSWORD.length)}`);
  process.exit(1);
}

// ─── 主体 ────────────────────────────────────────────────────────────────

async function seedAdmin(options: SeedOptions): Promise<void> {
  const { email, password, name } = options;
  const passwordHash = await hashPassword(password);
  const now = new Date();

  // 1) upsert user
  const [existingUser] = await db()
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
    await db()
      .update(user)
      .set({ emailVerified: true, name, updatedAt: now })
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
      role: null,
      updatedAt: now,
      utmSource: "",
    });
    console.log(`[seed-admin] created user: ${email}`);
  }

  // 2) upsert credential account
  //   对齐 Better-Auth sign-up:providerId=credential、accountId=userId
  const [existingAccountRow] = await db()
    .select()
    .from(account)
    .where(
      and(eq(account.userId, userId), eq(account.providerId, "credential"))
    )
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

  // 3) RBAC:admin 角色 + admin.* 权限
  let adminRole = await getRoleByName("admin");
  if (adminRole) {
    console.log("[seed-admin] role exists: admin");
  } else {
    adminRole = await createRole({
      description: "Platform administrator (wildcard admin.* permissions)",
      name: "admin",
      title: "Admin",
    });
    if (!adminRole) {
      throw new Error("create role 'admin' failed");
    }
    console.log("[seed-admin] created role: admin");
  }

  let adminPermissionId: string;
  const [adminPerm] = await db()
    .select()
    .from(permission)
    .where(eq(permission.code, "admin.*"))
    .limit(1);
  if (adminPerm) {
    adminPermissionId = adminPerm.id;
    console.log("[seed-admin] permission exists: admin.*");
  } else {
    const created = await createPermission({
      action: "*",
      code: "admin.*",
      description: "Grants access to all /admin management endpoints",
      resource: "admin",
      title: "Admin wildcard",
    });
    if (!created) {
      throw new Error("create permission 'admin.*' failed");
    }
    adminPermissionId = created.id;
    console.log("[seed-admin] created permission: admin.*");
  }

  // 4) 确保角色已绑定该权限(幂等:缺失时补,且复用现有的全部权限 id 以免误删)
  const alreadyLinked = await db()
    .select()
    .from(rolePermission)
    .where(
      and(
        eq(rolePermission.roleId, adminRole.id),
        eq(rolePermission.permissionId, adminPermissionId)
      )
    )
    .limit(1);
  if (alreadyLinked.length === 0) {
    const current = await db()
      .select({ permissionId: rolePermission.permissionId })
      .from(rolePermission)
      .where(eq(rolePermission.roleId, adminRole.id));
    const permissionIds = new Set(current.map((row) => row.permissionId));
    permissionIds.add(adminPermissionId);
    await assignPermissionsToRole(adminRole.id, [...permissionIds]);
    console.log("[seed-admin] linked permission -> role");
  } else {
    console.log("[seed-admin] permission already linked to role");
  }

  // 5) 为用户绑定管理员角色(assignRoleToUser 已 upsert,幂等)
  await assignRoleToUser(userId, adminRole.id);
  console.log("[seed-admin] assigned admin role to user");

  const loginUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
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
