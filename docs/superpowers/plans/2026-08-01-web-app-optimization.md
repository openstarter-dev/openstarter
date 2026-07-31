# Web 应用优化实施计划（第一批）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修掉 `apps/web` 里一个真实的缓存失效 bug、两处失效的构建/路由配置，并把首屏 JS 减少约 75KB (gzip)、补齐表单可访问性与公开页 SEO 元数据。

**Architecture:** 全部改动限定在 `apps/web`（外加一处 `turbo.json`）。三个新增模块承载可复用逻辑：`lib/form-validation.ts`（零依赖表单校验，替代客户端 zod）、`components/form/field-error.tsx`（无障碍错误展示）、`lib/page-head.ts`（SEO head 构造）。其余是就地修改。不新增运行时依赖，且会移除一个（客户端侧 zod）。

**Tech Stack:** TanStack Start 1.167 / TanStack Router 1.168 / TanStack Query 5.99 / TanStack Form 1.28 / React 19 / Vite 8 / Nitro 3 / Vitest 4 + @testing-library/react + fast-check / Biome 2.5.3 (ultracite 7.9.4)

## Global Constraints

这一节的约束隐含地属于每一个 task 的验收条件。

- 包管理器固定 `pnpm@10.25.0`，monorepo 由 turbo 编排。命令一律在仓库根目录执行，用 `--filter web` 指定子包，**不要 `cd`**。
- **Biome assist 会强制排序，必须遵守，否则 `pnpm lint` 失败：**
  - JSX 属性按自然序排列（`useSortedAttributes`）— 例如 `<Button className disabled onClick size type variant>`。
  - 对象字面量键按自然序排列（`useSortedKeys`）— 例如 `useQuery({ enabled, queryFn, queryKey })`。
- 禁用项（ultracite 规则集）：`any`、`console.*`、TS `enum`、TS `namespace`、非空断言 `!`、`var`、`text-red-*` 之类硬编码语义色（用主题 token）。类型导入必须写 `import type`。
- 每个 `<button>` 必须有显式 `type` 属性。
- 现有代码注释以中文为主，新增注释保持中文，风格对齐邻近文件（顶部注释写清文件职责与关联需求编号）。
- 校验三连（每个 task 的最后一步之前都要跑通）：
  - `pnpm lint`
  - `pnpm --filter web check-types`
  - `pnpm --filter web test`
- 测试栈：Vitest 4 + jsdom + `@testing-library/react`，property test 用 `fast-check`。测试文件命名 `*.test.ts(x)`，与被测文件同目录。`src/test/setup.ts` 已注册 `afterEach(cleanup)`，不要重复注册。
- 不新增运行时依赖。`zod` 保留在 `package.json`（服务端与 `packages/api` 仍在用），本计划只把它从**客户端 bundle** 移除。
- 提交信息用 Conventional Commits 前缀（`fix:` / `perf:` / `feat:` / `chore:` / `test:`）。

## File Structure

**新建**

| 文件 | 职责 |
| --- | --- |
| `apps/web/src/lib/form-validation.ts` | 零依赖字段校验原语 + TanStack Form 表单级 validator 工厂，返回 `GlobalFormValidationError` 形状 |
| `apps/web/src/lib/form-validation.test.ts` | 上者的单测 |
| `apps/web/src/components/form/field-error.tsx` | 渲染字段错误，输出稳定的 `id` 供 `aria-describedby` 关联 |
| `apps/web/src/components/form/field-error.test.tsx` | 上者的单测 |
| `apps/web/src/lib/page-head.ts` | 由 `{title, description, path, image}` 构造 TanStack Router `head()` 所需的 meta/links（含 canonical、Open Graph、Twitter Card） |
| `apps/web/src/lib/page-head.test.ts` | 上者的单测 |
| `apps/web/src/routes/admin/roles.test.tsx` | Task 1 的回归测试 |

**修改**

| 文件 | 改动 |
| --- | --- |
| `turbo.json:8-12` | `build.outputs` 补 `.output/**` |
| `apps/web/src/router.tsx:41` | 增加 `defaultPreload: "intent"` |
| `apps/web/src/routes/admin/roles.tsx:139-149` | 补 invalidate（bug 修复）；`:85` 稳定 effect 依赖；导出组件供测试 |
| `apps/web/src/routes/admin/settings.tsx:121-127` | 稳定 effect 依赖；`:344` 修 `aria-label` |
| `apps/web/src/components/auth/sign-in-form.tsx` | 去 zod、接 `FieldError` |
| `apps/web/src/components/auth/sign-up-form.tsx` | 同上 |
| `apps/web/src/routes/_auth-pages/forgot-password.tsx` | 同上 |
| `apps/web/src/routes/_auth-pages/reset-password.tsx` | 同上 |
| `apps/web/src/routes/_app/settings/profile.tsx` | 去 zod、接 `FieldError` |
| `apps/web/src/routes/_app/settings/security.tsx` | 去 zod、接 `FieldError` |
| `apps/web/src/components/blog/blog-card.tsx:34,51` | 图片补 `width`/`height`/`loading`/`decoding` |
| `apps/web/src/routes/blog/$slug.tsx:70,83` | 同上；并补 og:image 与 canonical |
| `apps/web/src/routes/_marketing/index.tsx` | 补 `head()` |
| `apps/web/src/routes/_marketing/pricing.tsx` | 补 `head()` |
| `apps/web/src/lib/branding.ts` | 新增 `SITE_URL` 常量 |
| `apps/web/src/components/admin/list.tsx` | `StatusText` 迁到共享位置供 settings 复用 |
| `apps/web/package.json` | 移除未使用的 `web-vitals` |

## 范围说明（Scope Check）

原始分析覆盖了多个互相独立的子系统。按 writing-plans 的要求，本计划只包含**边界清晰、可独立验证、且能给出完整代码**的部分。以下三块建议各自单独立 plan，理由写在文末「后续计划」：

- i18n 接入（约 48 个文件、802 条已翻译但未使用的消息）
- 数据获取重构（19 个页面从客户端 `useQuery` 改为 route loader 预取）
- 安全加固（认证端点速率限制 + 安全响应头）

---

## Phase 1：正确性修复

### Task 1: 修复角色权限保存后缓存未失效

`savePermsMutation` 成功后没有让 `["admin","roles",<id>,"permissions"]` 失效。全局 `staleTime` 是 60 秒（`router.tsx:32`），所以保存后一分钟内重开同一角色的权限弹窗，看到的是保存前的勾选状态。同文件的 `saveMutation` 和 `deleteMutation` 都正确 invalidate 了，只有这一处漏了。

**Files:**
- Modify: `apps/web/src/routes/admin/roles.tsx:47`（导出组件）、`:139-149`（补 invalidate）
- Test: `apps/web/src/routes/admin/roles.test.tsx`

**Interfaces:**
- Produces: `export function AdminRolesPage()` — 从 `apps/web/src/routes/admin/roles.tsx` 具名导出，无 props，供测试独立渲染。该组件体内不使用任何 router hook，因此只需 `QueryClientProvider` 即可渲染。

- [ ] **Step 1: 写失败的测试**

创建 `apps/web/src/routes/admin/roles.test.tsx`：

```tsx
// 回归测试：保存角色权限后必须使该角色的权限查询失效，
// 否则 60s staleTime 内重开弹窗会显示保存前的旧勾选（见 Task 1）。
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMocks = vi.hoisted(() => ({
  getPermissions: vi.fn(),
  getRolePermissions: vi.fn(),
  getRoles: vi.fn(),
  putRolePermissions: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  client: {
    api: {
      admin: {
        permissions: { $get: rpcMocks.getPermissions },
        roles: {
          ":id": {
            $delete: vi.fn(),
            $put: vi.fn(),
            permissions: {
              $get: rpcMocks.getRolePermissions,
              $put: rpcMocks.putRolePermissions,
            },
          },
          $get: rpcMocks.getRoles,
          $post: vi.fn(),
        },
      },
    },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { AdminRolesPage } from "./roles";

const okJson = (data: unknown) => ({
  json: () => Promise.resolve({ data }),
  ok: true,
});

function renderPage(): { queryClient: QueryClient } {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  render(<AdminRolesPage />, { wrapper: Wrapper });
  return { queryClient };
}

describe("AdminRolesPage permission cache invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMocks.getRoles.mockResolvedValue(
      okJson([{ id: "role-1", name: "admin", title: "Administrator" }])
    );
    rpcMocks.getPermissions.mockResolvedValue(
      okJson([{ code: "admin.*", id: "perm-1", title: "Admin all" }])
    );
    rpcMocks.getRolePermissions.mockResolvedValue(okJson([]));
    rpcMocks.putRolePermissions.mockResolvedValue(okJson(null));
  });

  it("invalidates the role permissions query after saving", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Permissions" })
    );
    await waitFor(() => expect(rpcMocks.getRolePermissions).toHaveBeenCalled());
    const callsBeforeSave = rpcMocks.getRolePermissions.mock.calls.length;

    await user.click(screen.getByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: "Save permissions" })
    );
    await waitFor(() =>
      expect(rpcMocks.putRolePermissions).toHaveBeenCalledTimes(1)
    );

    // 重开弹窗：若 mutation 正确失效了缓存，这里必须重新发起请求；
    // 缺失 invalidate 时 60s staleTime 会直接命中旧缓存，调用次数不变。
    await user.click(screen.getByRole("button", { name: "Permissions" }));
    await waitFor(() =>
      expect(rpcMocks.getRolePermissions.mock.calls.length).toBeGreaterThan(
        callsBeforeSave
      )
    );
  });
});
```

- [ ] **Step 2: 安装测试需要的交互库**

`@testing-library/user-event` 目前不在 `apps/web` 的 devDependencies 里。安装固定版本：

```bash
pnpm --filter web add -D @testing-library/user-event@14.6.1
```

- [ ] **Step 3: 运行测试确认失败**

```bash
pnpm --filter web test src/routes/admin/roles.test.tsx
```

预期：FAIL。首次会因为 `AdminRolesPage` 不是导出成员而报错（`does not provide an export named 'AdminRolesPage'`）。

- [ ] **Step 4: 导出组件**

在 `apps/web/src/routes/admin/roles.tsx` 把组件声明改为具名导出（第 47 行附近）：

```tsx
export function AdminRolesPage() {
```

原本是 `function AdminRolesPage() {`。同文件 `createFileRoute` 的 `component: AdminRolesPage` 引用不变。

- [ ] **Step 5: 再次运行测试，确认失败原因变成缓存问题**

```bash
pnpm --filter web test src/routes/admin/roles.test.tsx
```

预期：FAIL，最后一个断言超时 —— `getRolePermissions` 调用次数没有增加。这正是要修的 bug。

- [ ] **Step 6: 修复 mutation**

在 `apps/web/src/routes/admin/roles.tsx` 中把 `savePermsMutation` 改成（原第 139-149 行）：

```tsx
  const savePermsMutation = useMutation({
    mutationFn: async (input: { id: string; permissionIds: string[] }) => {
      const res = await client.api.admin.roles[":id"].permissions.$put({
        json: { permissionIds: input.permissionIds },
        param: { id: input.id },
      });
      if (!res.ok) {
        throw new Error("Failed to save permissions");
      }
    },
    onError: (error: Error) => toast.error(error.message),
    onSuccess: (_data, variables) => {
      // 覆盖式写入后必须让该角色的权限查询失效，否则 60s staleTime 内
      // 重开弹窗会渲染保存前的旧勾选集合。
      queryClient.invalidateQueries({
        queryKey: ["admin", "roles", variables.id, "permissions"],
      });
      setPermRoleId(null);
      toast.success("Permissions updated");
    },
  });
```

- [ ] **Step 7: 运行测试确认通过**

```bash
pnpm --filter web test src/routes/admin/roles.test.tsx
```

预期：PASS，1 passed。

- [ ] **Step 8: 跑校验三连**

```bash
pnpm lint && pnpm --filter web check-types && pnpm --filter web test
```

预期：全部通过。

- [ ] **Step 9: 提交**

```bash
git add apps/web/src/routes/admin/roles.tsx apps/web/src/routes/admin/roles.test.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "fix(web): invalidate role permissions query after saving"
```

---

### Task 2: 稳定两处 useEffect 依赖

`admin/settings.tsx:121` 的 effect 依赖 `[data, activeTab, tabs, configs]`，但 `configs = data?.configs ?? {}` 和 `tabs = data?.tabs ?? []` 每次渲染都是新引用，effect 每次渲染都重跑。目前靠 `activeTab === null` 守卫兜住了没出 bug，但这个守卫是唯一防线。`admin/roles.tsx:85` 是同类问题。改法是让 effect 只依赖真正稳定的 query 数据引用。

**Files:**
- Modify: `apps/web/src/routes/admin/settings.tsx:121-127`
- Modify: `apps/web/src/routes/admin/roles.tsx:85-89`

**Interfaces:**
- Consumes: Task 1 导出的 `AdminRolesPage`（本 task 不改变其签名）

- [ ] **Step 1: 修 admin/settings.tsx 的 effect**

把第 119-127 行（含注释）替换为：

```tsx
  // 首次加载完成后初始化 active tab 与可编辑值快照。
  // 只依赖 query 数据本身（引用稳定），不要依赖派生的 configs / tabs ——
  // 后两者每次渲染都是新对象/新数组，会让 effect 每次渲染重跑。
  // (useEffect 必须在任何 early-return 之前挂在顶层,以保持 hook 调用顺序稳定。)
  useEffect(() => {
    if (!data) {
      return;
    }
    const firstTab = data.tabs.at(0)?.name ?? null;
    if (firstTab === null) {
      return;
    }
    setActiveTab((prev) => prev ?? firstTab);
    setPending((prev) =>
      Object.keys(prev).length === 0 ? { ...data.configs } : prev
    );
  }, [data]);
```

改动要点：依赖数组从 4 项收到 1 项；用 setState 的函数式更新替代读 `activeTab`，这样 `activeTab` 不必进依赖数组。

- [ ] **Step 2: 修 admin/roles.tsx 的 effect**

第 85-89 行本身依赖的 `rolePermsQuery.data` 引用是稳定的，问题在于切换角色时不会重置。替换为：

```tsx
  // permRoleId 一并进依赖：切换角色时即便新角色的权限响应未回来，
  // 也先清空勾选，避免短暂显示上一个角色的权限集合。
  useEffect(() => {
    if (permRoleId === null) {
      setSelectedPerms(new Set());
      return;
    }
    if (rolePermsQuery.data) {
      setSelectedPerms(new Set(rolePermsQuery.data.map((p) => p.permissionId)));
    }
  }, [permRoleId, rolePermsQuery.data]);
```

- [ ] **Step 3: 运行 admin 相关测试**

```bash
pnpm --filter web test src/routes/admin/roles.test.tsx
```

预期：PASS（Task 1 的回归测试仍然通过 —— 这次改动不应破坏它）。

- [ ] **Step 4: 跑校验三连**

```bash
pnpm lint && pnpm --filter web check-types && pnpm --filter web test
```

预期：全部通过。`noUnusedLocals` 可能提示 `configs` / `tabs` 仍被 JSX 使用 —— 它们确实还在渲染里用，不会报未使用。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/routes/admin/settings.tsx apps/web/src/routes/admin/roles.tsx
git commit -m "fix(web): stabilize effect dependencies in admin settings and roles"
```

---

## Phase 2：失效的配置

### Task 3: 修正 turbo build 产物声明

`turbo.json` 的 `build.outputs` 声明是 `["dist/**", "src/routeTree.gen.ts"]`，但 `apps/web` 实际只产出 `.output/`（约 9.7MB）—— 删掉 `dist` 后重新构建，`dist` 并不会被重建，它已经不是产物目录了。后果：build 缓存命中时不恢复可部署产物，CI 上 `pnpm build` 命中缓存等于什么都没有。

**Files:**
- Modify: `turbo.json:8-12`

**Interfaces:** 无代码接口。

- [ ] **Step 1: 复现问题**

```bash
pnpm --filter web build && ls apps/web/dist 2>&1 | head -2
```

预期：构建成功，但 `ls: apps/web/dist: No such file or directory` —— 证明 `dist/**` 是过时声明。

```bash
ls -d apps/web/.output && du -sh apps/web/.output
```

预期：目录存在，约 9-10MB —— 这才是真正的产物。

- [ ] **Step 2: 修改 turbo.json**

把 `tasks.build` 块（第 6-10 行）替换为：

```jsonc
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": ["dist/**", ".output/**", "src/routeTree.gen.ts"]
    },
```

保留 `dist/**`：`packages/*` 与 `apps/desktop` 仍然输出到 `dist`。新增 `.output/**` 覆盖 TanStack Start / Nitro 的产物。

- [ ] **Step 3: 验证缓存能恢复产物**

```bash
pnpm --filter web build && rm -rf apps/web/.output && pnpm --filter web build
```

预期：第二次构建输出 `cache hit, replaying logs` 或 `FULL TURBO`，且：

```bash
ls apps/web/.output/server/index.mjs
```

预期：文件存在 —— 缓存把产物恢复回来了。修改前这一步会失败。

- [ ] **Step 4: 提交**

```bash
git add turbo.json
git commit -m "fix(build): declare .output as a turbo build artifact"
```

注意：`turbo.json` 工作区里可能已有 `dev:electron` 的未提交改动。只 stage 本 task 相关的 `outputs` 行，如果 `git add` 带进了无关改动，用 `git add -p turbo.json` 逐块选择。

---

### Task 4: 开启链接预加载

`router.tsx:41` 设了 `defaultPreloadStaleTime: 0`，但没设 `defaultPreload`。TanStack Router 的 `defaultPreload` 默认是 `false`，也就是预加载压根没开启，那行 staleTime 配置目前不起作用。

**Files:**
- Modify: `apps/web/src/router.tsx:38-42`

**Interfaces:** 无新增接口。

- [ ] **Step 1: 修改 router 配置**

把 `createTanStackRouter` 的前几个选项（第 38-42 行）替换为：

```tsx
  const router = createTanStackRouter({
    routeTree,
    // hover / focus 即预取路由代码与 loader 数据。配合 defaultPreloadStaleTime: 0
    // （预取结果不缓存、由 TanStack Query 自己的 staleTime 兜底）。
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    context: { queryClient },
```

`defaultPreload` 的合法取值是 `false | "intent" | "viewport" | "render"`（见 `@tanstack/router-core` 的 `router.d.ts:79`）。选 `"intent"`：只在用户表达意图时预取，不像 `"viewport"` 那样把视口内所有链接都拉一遍。

注意键的排列要满足 biome `useSortedKeys`：`routeTree` 之后按自然序 `defaultPreload` < `defaultPreloadStaleTime` < `scrollRestoration` < `context`。若 lint 报排序，按它的 `--write` 建议调整。

- [ ] **Step 2: 确认类型与 lint 通过**

```bash
pnpm lint && pnpm --filter web check-types
```

预期：通过。若 `useSortedKeys` 报错，运行 `pnpm exec biome check --write apps/web/src/router.tsx` 自动排序后复查。

- [ ] **Step 3: 人工验证预取生效**

```bash
pnpm --filter web build
```

启动生产预览需要你在自己的终端里手动执行（不要让 agent 起长驻进程）：

```
pnpm --filter web start
```

打开 http://localhost:3000，DevTools → Network 面板，hover 顶部导航的 "Pricing" 链接（**不点击**）。预期：出现对应路由 chunk 的请求。修改前 hover 不会产生任何请求。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/router.tsx
git commit -m "perf(web): enable intent-based route preloading"
```

---

## Phase 3：首屏体积

### Task 5: 用零依赖校验替换客户端 zod

干净构建的实测数据：`zod-*.js` raw 330KB / gzip 75KB，且被入口 chunk `index-*.js` 引用（即首屏就下载）。它服务的全部是 6 个文件里的表单校验，实际用到的规则只有邮箱格式、最小长度、最大长度。

TanStack Form 的 `validators.onSubmit` 除了接受 Standard Schema（zod 走这条路），也接受函数 `FormValidateFn<TFormData>`，返回 `GlobalFormValidationError<TFormData>`，形状是 `{ form?: unknown; fields: Partial<Record<DeepKeys<TFormData>, unknown>> }`（见 `@tanstack/form-core` 的 `FormApi.d.ts:13` 与 `types.d.ts:70`）。字段错误值类型是 `unknown`，所以返回 `{ message: string }` 对象就能让现有渲染代码 `error?.message` **完全不用改**。Step 1 的测试首先要锁定这个行为。

**Files:**
- Create: `apps/web/src/lib/form-validation.ts`
- Create: `apps/web/src/lib/form-validation.test.ts`
- Modify: `apps/web/src/components/auth/sign-in-form.tsx:7,67-71`
- Modify: `apps/web/src/components/auth/sign-up-form.tsx:7,68-73`
- Modify: `apps/web/src/routes/_auth-pages/forgot-password.tsx:15,44-46`
- Modify: `apps/web/src/routes/_auth-pages/reset-password.tsx:15`（zod schema 块）
- Modify: `apps/web/src/routes/_app/settings/profile.tsx:20,46-50`
- Modify: `apps/web/src/routes/_app/settings/security.tsx:18`（zod schema 块）

**Interfaces:**
- Produces（供 Task 5 内部各文件与 Task 7 使用）：
  - `type FieldMessage = { message: string }`
  - `type FieldRule<T> = (value: T) => FieldMessage | undefined`
  - `function required(message: string): FieldRule<string>`
  - `function email(message: string): FieldRule<string>`
  - `function minLength(length: number, message: string): FieldRule<string>`
  - `function maxLength(length: number, message: string): FieldRule<string>`
  - `function matches<TValues>(otherKey: keyof TValues & string, message: string): (value: string, values: TValues) => FieldMessage | undefined`
  - `function formValidator<TValues extends Record<string, unknown>>(rules: { [K in keyof TValues]?: FieldRule<TValues[K]>[] }): (props: { value: TValues }) => { fields: Partial<Record<keyof TValues, FieldMessage>> }`

- [ ] **Step 1: 写失败的测试**

创建 `apps/web/src/lib/form-validation.test.ts`：

```ts
// 零依赖表单校验的单测。关键在于 formValidator 的返回形状必须是
// TanStack Form 的 GlobalFormValidationError（{ fields: {...} }），且字段值为
// { message } 对象 —— 这样各表单的 `error?.message` 渲染代码无需改动。
import { describe, expect, it } from "vitest";

import {
  email,
  formValidator,
  matches,
  maxLength,
  minLength,
  required,
} from "./form-validation";

describe("field rules", () => {
  it("required rejects empty and whitespace-only values", () => {
    const rule = required("Name is required");
    expect(rule("")).toEqual({ message: "Name is required" });
    expect(rule("   ")).toEqual({ message: "Name is required" });
    expect(rule("a")).toBeUndefined();
  });

  it("email accepts a plain address and rejects malformed ones", () => {
    const rule = email("Invalid email address");
    expect(rule("user@example.com")).toBeUndefined();
    expect(rule("user.name+tag@sub.example.co.uk")).toBeUndefined();
    for (const bad of ["", "user", "user@", "@example.com", "a b@c.com"]) {
      expect(rule(bad)).toEqual({ message: "Invalid email address" });
    }
  });

  it("minLength and maxLength check boundaries inclusively", () => {
    const min = minLength(8, "too short");
    expect(min("1234567")).toEqual({ message: "too short" });
    expect(min("12345678")).toBeUndefined();

    const max = maxLength(3, "too long");
    expect(max("abc")).toBeUndefined();
    expect(max("abcd")).toEqual({ message: "too long" });
  });

  it("matches compares against another field", () => {
    const rule = matches<{ confirm: string; password: string }>(
      "password",
      "Passwords do not match"
    );
    expect(rule("a", { confirm: "a", password: "a" })).toBeUndefined();
    expect(rule("b", { confirm: "b", password: "a" })).toEqual({
      message: "Passwords do not match",
    });
  });
});

describe("formValidator", () => {
  const validate = formValidator<{ email: string; password: string }>({
    email: [email("Invalid email address")],
    password: [minLength(8, "Password must be at least 8 characters")],
  });

  it("returns an empty fields map when everything is valid", () => {
    expect(
      validate({ value: { email: "a@b.com", password: "12345678" } })
    ).toEqual({ fields: {} });
  });

  it("reports the first failing rule per field as a message object", () => {
    expect(validate({ value: { email: "nope", password: "short" } })).toEqual({
      fields: {
        email: { message: "Invalid email address" },
        password: { message: "Password must be at least 8 characters" },
      },
    });
  });

  it("omits fields that pass while reporting those that fail", () => {
    expect(
      validate({ value: { email: "a@b.com", password: "short" } })
    ).toEqual({
      fields: { password: { message: "Password must be at least 8 characters" } },
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm --filter web test src/lib/form-validation.test.ts
```

预期：FAIL，`Failed to resolve import "./form-validation"`。

- [ ] **Step 3: 实现校验模块**

创建 `apps/web/src/lib/form-validation.ts`：

```ts
// apps/web/src/lib/form-validation.ts
// 零依赖表单校验原语。替代客户端侧的 zod —— 后者仅为几条邮箱/长度规则
// 就给首屏 bundle 增加约 75KB (gzip)。
//
// 返回形状对齐 TanStack Form 的 GlobalFormValidationError：
// `{ fields: { <name>: { message } } }`。字段错误用 `{ message }` 对象而非裸
// 字符串，是为了让各表单里既有的 `field.state.meta.errors.map(e => e?.message)`
// 渲染代码保持不变。
//
// 服务端与 packages/api 继续使用 zod（那里没有体积成本），本模块只覆盖浏览器表单。

/** 单条字段错误。与 zod 的 StandardSchemaV1Issue 在渲染侧同构（都有 message）。 */
// 注意必须用 interface：biome 的 useConsistentTypeDefinitions 要求对象类型
// 一律声明为 interface，写成 `type FieldMessage = { ... }` 会 lint 失败。
export interface FieldMessage {
  message: string;
}

/** 字段规则：通过返回 undefined，失败返回错误。 */
export type FieldRule<T> = (value: T) => FieldMessage | undefined;

// 邮箱格式：单个 @、本地部分与域名均非空且不含空白，域名至少有一个点分段。
// 刻意保持保守 —— 客户端校验只为即时反馈，真正的权威校验在服务端。
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/u;

/** 非空（去除首尾空白后仍有内容）。 */
export function required(message: string): FieldRule<string> {
  return (value) => (value.trim().length === 0 ? { message } : undefined);
}

/** 邮箱格式。 */
export function email(message: string): FieldRule<string> {
  return (value) => (EMAIL_PATTERN.test(value) ? undefined : { message });
}

/** 最小长度（含边界：length 本身合法）。 */
export function minLength(length: number, message: string): FieldRule<string> {
  return (value) => (value.length < length ? { message } : undefined);
}

/** 最大长度（含边界：length 本身合法）。 */
export function maxLength(length: number, message: string): FieldRule<string> {
  return (value) => (value.length > length ? { message } : undefined);
}

/**
 * 与同表单另一字段比较（如确认密码）。
 * 签名比 FieldRule 多一个 values 参数，由 formValidator 负责传入。
 */
export function matches<TValues extends Record<string, unknown>>(
  otherKey: keyof TValues & string,
  message: string
): (value: string, values: TValues) => FieldMessage | undefined {
  return (value, values) =>
    values[otherKey] === value ? undefined : { message };
}

/**
 * 规则表：每个字段一组规则，按顺序求值，命中第一个失败即止。
 * 这里是 mapped type，无法用 interface 表达，所以 type 别名是必需的
 * （useConsistentTypeDefinitions 只约束对象字面量类型）。
 */
export type FieldRules<TValues extends Record<string, unknown>> = {
  [K in keyof TValues]?: ((
    value: TValues[K],
    values: TValues
  ) => FieldMessage | undefined)[];
};

/**
 * 构造 TanStack Form 的表单级 validator，用于 `validators: { onSubmit }`。
 *
 * @example
 * validators: {
 *   onSubmit: formValidator<{ email: string }>({
 *     email: [email("Invalid email address")],
 *   }),
 * }
 */
export function formValidator<TValues extends Record<string, unknown>>(
  rules: FieldRules<TValues>
): (props: { value: TValues }) => {
  fields: Partial<Record<keyof TValues, FieldMessage>>;
} {
  return ({ value }) => {
    const fields: Partial<Record<keyof TValues, FieldMessage>> = {};
    for (const key of Object.keys(rules) as (keyof TValues)[]) {
      const fieldRules = rules[key];
      if (!fieldRules) {
        continue;
      }
      for (const rule of fieldRules) {
        const failure = rule(value[key], value);
        if (failure) {
          fields[key] = failure;
          break;
        }
      }
    }
    return { fields };
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm --filter web test src/lib/form-validation.test.ts
```

预期：PASS，3 个 describe 共 7 个测试通过。

- [ ] **Step 5: 提交校验模块**

```bash
git add apps/web/src/lib/form-validation.ts apps/web/src/lib/form-validation.test.ts
git commit -m "feat(web): add zero-dependency form validation primitives"
```

- [ ] **Step 6: 替换 sign-in-form.tsx**

删掉第 7 行的 `import z from "zod";`，在 `@/lib/auth-client` 那组 import 中加入（保持 import 分组与字母序）：

```tsx
import { email, formValidator, minLength } from "@/lib/form-validation";
```

把 `validators` 块（第 66-71 行）替换为：

```tsx
    validators: {
      onSubmit: formValidator<{ email: string; password: string }>({
        email: [email("Invalid email address")],
        password: [minLength(8, "Password must be at least 8 characters")],
      }),
    },
```

- [ ] **Step 7: 替换 sign-up-form.tsx**

删掉第 7 行 `import z from "zod";`，加入：

```tsx
import { email, formValidator, minLength } from "@/lib/form-validation";
```

把 `validators` 块（第 67-73 行）替换为：

```tsx
    validators: {
      onSubmit: formValidator<{
        email: string;
        name: string;
        password: string;
      }>({
        email: [email("Invalid email address")],
        name: [minLength(2, "Name must be at least 2 characters")],
        password: [minLength(8, "Password must be at least 8 characters")],
      }),
    },
```

- [ ] **Step 8: 替换 forgot-password.tsx**

删掉第 15 行 `import z from "zod";`，加入：

```tsx
import { email, formValidator } from "@/lib/form-validation";
```

把 `validators` 块（第 44-46 行）替换为：

```tsx
    validators: {
      onSubmit: formValidator<{ email: string }>({
        email: [email("Invalid email address")],
      }),
    },
```

- [ ] **Step 9: 替换 reset-password.tsx**

这个文件的 schema 是模块级常量（第 31-39 行），且用 `.refine()` 做跨字段比较，`path: ["confirmPassword"]` 把错误挂到确认字段上。

删掉第 15 行 `import z from "zod";`，加入：

```tsx
import { formValidator, matches, minLength } from "@/lib/form-validation";
```

删掉整个 `resetSchema` 常量（第 31-39 行）：

```tsx
const resetSchema = z
  .object({
    confirmPassword: z.string().min(8),
    password: z.string().min(8, "Password must be at least 8 characters"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
```

替换为模块级 validator（放在同一位置，保持模块级常量的写法）：

```tsx
// 跨字段比较由 matches 承担，等价于原 zod schema 的 .refine(path: ["confirmPassword"])：
// 错误同样挂在确认字段上，而非表单级。
const validateReset = formValidator<{
  confirmPassword: string;
  password: string;
}>({
  confirmPassword: [
    minLength(8, "Password must be at least 8 characters"),
    matches<{ confirmPassword: string; password: string }>(
      "password",
      "Passwords do not match"
    ),
  ],
  password: [minLength(8, "Password must be at least 8 characters")],
});
```

原 schema 里 `confirmPassword: z.string().min(8)` 没写自定义消息（会落到 zod 的默认英文文案）。这里显式补上与 password 一致的消息，是一处顺带的文案改善。

再把 `validators` 那一行（第 67 行）从：

```tsx
    validators: { onSubmit: resetSchema },
```

改为：

```tsx
    validators: { onSubmit: validateReset },
```

- [ ] **Step 10: 替换 profile.tsx**

删掉第 20 行 `import { z } from "zod";`，加入：

```tsx
import { formValidator, maxLength, required } from "@/lib/form-validation";
```

把 `validators` 块（第 45-50 行）替换为：

```tsx
    validators: {
      onSubmit: formValidator<{ name: string }>({
        name: [required("Name is required"), maxLength(100, "Name too long")],
      }),
    },
```

- [ ] **Step 11: 替换 security.tsx（两个表单）**

这个文件有两个独立的 `useForm`：`passwordForm`（3 个字段）与 `emailForm`（1 个字段）。

删掉第 18 行 `import { z } from "zod";`，加入：

```tsx
import { email, formValidator, minLength, required } from "@/lib/form-validation";
```

把 `passwordForm` 的 `validators` 块（第 62-69 行）替换为：

```tsx
    validators: {
      onSubmit: formValidator<{
        confirmPassword: string;
        currentPassword: string;
        newPassword: string;
      }>({
        confirmPassword: [required("Please confirm the new password")],
        currentPassword: [required("Current password is required")],
        newPassword: [minLength(8, "Password must be at least 8 characters")],
      }),
    },
```

原 schema 用的是 `z.string().min(1, …)`，语义就是「非空」，对应 `required(…)`。注意 `required` 会额外拒绝纯空白输入（`.trim()`），比原来的 `min(1)` 略严 —— 对密码确认字段这是改善，不是回归。

把 `emailForm` 的 `validators` 块（第 88-92 行）替换为：

```tsx
    validators: {
      onSubmit: formValidator<{ newEmail: string }>({
        newEmail: [email("Invalid email address")],
      }),
    },
```

**不要动** `passwordForm.onSubmit` 里已有的 `value.newPassword !== value.confirmPassword` 手动检查（第 39-42 行）。它当前以 toast 形式提示不匹配，改成 `matches` 会把提示从 toast 变成字段内错误 —— 那是一次行为变更，不属于本 task「去 zod 且不改行为」的范围。若之后想统一，留给 Task 7 之后的独立改动。

- [ ] **Step 12: 确认 zod 已从 web 源码中消失**

```bash
pnpm exec grep -rn "from \"zod\"\|from 'zod'" apps/web/src --include="*.ts" --include="*.tsx"
```

预期：无输出（退出码 1）。

- [ ] **Step 13: 跑校验三连**

```bash
pnpm lint && pnpm --filter web check-types && pnpm --filter web test
```

预期：全部通过。既有的 `oauth-buttons.property.test.tsx` 会渲染 `SignInForm` / `SignUpForm`，它必须仍然通过 —— 这是本 task 的免费回归保护。

- [ ] **Step 14: 提交**

```bash
git add apps/web/src/components/auth/sign-in-form.tsx apps/web/src/components/auth/sign-up-form.tsx apps/web/src/routes/_auth-pages/forgot-password.tsx apps/web/src/routes/_auth-pages/reset-password.tsx apps/web/src/routes/_app/settings/profile.tsx apps/web/src/routes/_app/settings/security.tsx
git commit -m "perf(web): replace client-side zod validation with zero-dep rules"
```

---

### Task 6: 验证 zod 已离开客户端 bundle

Task 5 改的是源码，这个 task 用构建产物证明收益真实存在。

**Files:** 无（纯验证）。

**Interfaces:** 无。

- [ ] **Step 1: 干净构建**

```bash
rm -rf apps/web/.output && pnpm --filter web build
```

预期：构建成功。

- [ ] **Step 2: 确认没有 zod chunk**

```bash
ls apps/web/.output/public/assets/ | grep -i zod
```

预期：无输出（退出码 1）。修改前这里会列出 `zod-*.js`。

- [ ] **Step 3: 测量入口 chunk 的 gzip 体积**

```bash
for f in apps/web/.output/public/assets/*.js; do
  printf "%8d  %s\n" "$(gzip -c "$f" | wc -c)" "$(basename "$f")"
done | sort -rn | head -5
```

预期：不再出现约 76800 字节（75KB gzip）的 zod chunk。入口 `index-*.js` 此前实测 gzip 约 178KB，应基本持平或略降 —— 收益主要体现在**首屏少了一整个 75KB 的并行请求**，而不是入口本身变小。把实测数字记进提交信息。

- [ ] **Step 4: 确认 Cloudflare 构建也正常**

```bash
pnpm --filter web cf:build
```

预期：构建成功（CI 会跑这条，本地先确认不回归）。

- [ ] **Step 5: 记录结果**

```bash
git commit --allow-empty -m "perf(web): confirm zod removed from client bundle (-75KB gzip)"
```

用空提交留个基准记录。如果不想要空提交，跳过这步，把数字写进 Task 5 的提交信息。

---

## Phase 4：可访问性与设计一致性

### Task 7: 让表单校验错误对屏幕阅读器可见

全仓 0 处 `aria-invalid` / `aria-describedby` / `role="alert"`。错误只渲染成 `<p className="text-red-500">`，与输入框没有程序化关联，屏幕阅读器不会播报。同时 4 个文件用硬编码 `text-red-500`（8 处），另 14 个文件用主题 token `text-destructive` —— red-500 在暗色主题下对比度不达标。一次改动同时解决这两件事。

**Files:**
- Create: `apps/web/src/components/form/field-error.tsx`
- Create: `apps/web/src/components/form/field-error.test.tsx`
- Modify: `apps/web/src/components/auth/sign-in-form.tsx`（2 处错误块）
- Modify: `apps/web/src/components/auth/sign-up-form.tsx`（3 处）
- Modify: `apps/web/src/routes/_auth-pages/forgot-password.tsx`（1 处）
- Modify: `apps/web/src/routes/_auth-pages/reset-password.tsx`（2 处）
- Modify: `apps/web/src/routes/_app/settings/profile.tsx`（1 处）
- Modify: `apps/web/src/routes/_app/settings/security.tsx`（4 处：`passwordForm` 的 3 个字段 + `emailForm` 的 `newEmail`）

共 13 处字段错误块。其中 `profile.tsx` 与 `security.tsx` 已在用 `text-destructive`（颜色本就正确），改造它们只为补 a11y 属性；另 4 个文件同时修颜色与 a11y。

**Interfaces:**
- Consumes: Task 5 的 `FieldMessage`（错误项形状 `{ message }`）
- Produces:
  - `function fieldErrorId(name: string): string` — 返回 `${name}-error`，供 `aria-describedby` 引用
  - `function FieldError(props: { errors: unknown[]; name: string }): ReactNode` — 无错误时返回 `null`

- [ ] **Step 1: 写失败的测试**

创建 `apps/web/src/components/form/field-error.test.tsx`：

```tsx
// FieldError 的可访问性契约：错误容器必须有稳定 id（供 aria-describedby 引用）、
// role="alert" + aria-live="polite"（让屏幕阅读器播报），且用主题 token 着色。
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldError, fieldErrorId } from "./field-error";

describe("fieldErrorId", () => {
  it("derives a stable id from the field name", () => {
    expect(fieldErrorId("email")).toBe("email-error");
    expect(fieldErrorId("confirmPassword")).toBe("confirmPassword-error");
  });
});

describe("FieldError", () => {
  it("renders nothing when there are no errors", () => {
    const { container } = render(<FieldError errors={[]} name="email" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ignores nullish entries", () => {
    const { container } = render(
      <FieldError errors={[undefined, null]} name="email" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("announces errors with an alert role and the derived id", () => {
    render(
      <FieldError errors={[{ message: "Invalid email address" }]} name="email" />
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("id", "email-error");
    expect(alert).toHaveAttribute("aria-live", "polite");
    expect(alert.textContent).toBe("Invalid email address");
  });

  it("uses the destructive theme token rather than a hardcoded red", () => {
    render(<FieldError errors={[{ message: "nope" }]} name="email" />);
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("text-destructive");
    expect(alert.className).not.toContain("text-red-");
  });

  it("renders every message when a field has several", () => {
    render(
      <FieldError
        errors={[{ message: "first" }, { message: "second" }]}
        name="password"
      />
    );
    expect(screen.getByRole("alert").textContent).toBe("firstsecond");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm --filter web test src/components/form/field-error.test.tsx
```

预期：FAIL，`Failed to resolve import "./field-error"`。

如果报 `toHaveAttribute is not a function`，说明缺 jest-dom 匹配器。安装并注册：

```bash
pnpm --filter web add -D @testing-library/jest-dom@6.9.1
```

然后在 `apps/web/src/test/setup.ts` 顶部加一行 `import "@testing-library/jest-dom/vitest";`（保留既有的 `afterEach(cleanup)`）。

- [ ] **Step 3: 实现组件**

创建 `apps/web/src/components/form/field-error.tsx`：

```tsx
// apps/web/src/components/form/field-error.tsx
// 表单字段错误的无障碍展示。
//
// 三件事让错误对辅助技术可见：
//   1. 容器有稳定 id（fieldErrorId），输入框用 aria-describedby 指向它；
//   2. role="alert" + aria-live="polite"，错误出现时被播报；
//   3. 用 text-destructive 主题 token 而非硬编码 red-500（后者在暗色主题下
//      对比度不达标，且与项目其余 14 个文件的用法不一致）。
//
// errors 的元素类型是 unknown：TanStack Form 的 ValidationError 就是 unknown。
// 实际形状由 lib/form-validation 保证为 { message: string }。

// 对象类型用 interface（biome useConsistentTypeDefinitions）。
interface FieldErrorProps {
  errors: unknown[];
  name: string;
}

/** 由字段名派生错误容器 id，供 aria-describedby 引用。 */
export function fieldErrorId(name: string): string {
  return `${name}-error`;
}

function messageOf(error: unknown): string | undefined {
  if (typeof error === "string") {
    return error;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return undefined;
}

export function FieldError({ errors, name }: FieldErrorProps) {
  const messages = errors
    .map(messageOf)
    .filter((message): message is string => message !== undefined);

  if (messages.length === 0) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className="text-destructive text-sm"
      id={fieldErrorId(name)}
      role="alert"
    >
      {messages.map((message) => (
        <span key={message}>{message}</span>
      ))}
    </p>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm --filter web test src/components/form/field-error.test.tsx
```

预期：PASS，6 个测试通过。

- [ ] **Step 5: 提交组件**

```bash
git add apps/web/src/components/form/field-error.tsx apps/web/src/components/form/field-error.test.tsx apps/web/src/test/setup.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add accessible FieldError component"
```

- [ ] **Step 6: 接入 sign-in-form.tsx**

加入 import：

```tsx
import { FieldError, fieldErrorId } from "@/components/form/field-error";
```

email 字段块（第 128-148 行附近）替换为：

```tsx
            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Email</Label>
                  <Input
                    aria-describedby={
                      field.state.meta.errors.length > 0
                        ? fieldErrorId(field.name)
                        : undefined
                    }
                    aria-invalid={field.state.meta.errors.length > 0}
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="email"
                    value={field.state.value}
                  />
                  <FieldError
                    errors={field.state.meta.errors}
                    name={field.name}
                  />
                </div>
              )}
            </form.Field>
```

password 字段块（第 150-179 行附近）替换为 —— 注意 Label 与「Forgot password?」链接同处一个 flex 容器，这个结构要原样保留：

```tsx
            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={field.name}>Password</Label>
                    {passwordResetEnabled && (
                      <Link
                        className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
                        to="/forgot-password"
                      >
                        Forgot password?
                      </Link>
                    )}
                  </div>
                  <Input
                    aria-describedby={
                      field.state.meta.errors.length > 0
                        ? fieldErrorId(field.name)
                        : undefined
                    }
                    aria-invalid={field.state.meta.errors.length > 0}
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="password"
                    value={field.state.value}
                  />
                  <FieldError
                    errors={field.state.meta.errors}
                    name={field.name}
                  />
                </div>
              )}
            </form.Field>
```

- [ ] **Step 7: 接入 sign-up-form.tsx（3 个字段）**

加同一条 import，对 `name` / `email` / `password` 三个字段做与 Step 6 相同的处理。`name` 字段的 `<Input>` 没有 `type` 属性，保持不加。

- [ ] **Step 8: 接入 forgot-password.tsx（1 字段）与 reset-password.tsx（2 字段）**

两个文件都加同一条 import，然后对每个 `form.Field` 做与 Step 6 相同的三步改造。以 `reset-password.tsx` 的 `password` 字段为例，改造后是：

```tsx
            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>New password</Label>
                  <Input
                    aria-describedby={
                      field.state.meta.errors.length > 0
                        ? fieldErrorId(field.name)
                        : undefined
                    }
                    aria-invalid={field.state.meta.errors.length > 0}
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="password"
                    value={field.state.value}
                  />
                  <FieldError
                    errors={field.state.meta.errors}
                    name={field.name}
                  />
                </div>
              )}
            </form.Field>
```

`confirmPassword` 字段同构（Label 文案是 "Confirm new password"）。`forgot-password.tsx` 的 `email` 字段同构（`type="email"`，Label 文案 "Email"）。

注意这两个文件里另有页面级错误提示（`error ? <div className="rounded-md bg-destructive/10 …">` ），那是提交失败的整体反馈，不是字段校验错误，**保持原样不要动**。

- [ ] **Step 9: 接入 profile.tsx（1 字段）与 security.tsx（4 字段）**

这两个文件的错误块已经在用 `text-destructive`，所以改造只增加 a11y 属性、不改变视觉。

`profile.tsx` 的 `name` 字段（第 71-90 行）改造后：

```tsx
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Display name</Label>
                <Input
                  aria-describedby={
                    field.state.meta.errors.length > 0
                      ? fieldErrorId(field.name)
                      : undefined
                  }
                  aria-invalid={field.state.meta.errors.length > 0}
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} name={field.name} />
              </div>
            )}
          </form.Field>
```

`security.tsx` 有 4 个字段，分属两个表单，注意渲染器前缀不同（`passwordForm.Field` 与 `emailForm.Field`）。以 `currentPassword` 为例：

```tsx
            <passwordForm.Field name="currentPassword">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Current password</Label>
                  <Input
                    aria-describedby={
                      field.state.meta.errors.length > 0
                        ? fieldErrorId(field.name)
                        : undefined
                    }
                    aria-invalid={field.state.meta.errors.length > 0}
                    autoComplete="current-password"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type="password"
                    value={field.state.value}
                  />
                  <FieldError
                    errors={field.state.meta.errors}
                    name={field.name}
                  />
                </div>
              )}
            </passwordForm.Field>
```

`newPassword` 与 `confirmPassword` 同构，各自保留原有的 `autoComplete="new-password"`。`emailForm` 的 `newEmail` 同构，保留 `autoComplete="email"` 与 `type="email"`。注意 `aria-describedby` / `aria-invalid` 要排在 `autoComplete` **之前**（字母序：aria- < autoComplete）。

- [ ] **Step 10: 确认硬编码红色已清零**

```bash
pnpm exec grep -rn "text-red-" apps/web/src --include="*.tsx"
```

预期：无输出（退出码 1）。

- [ ] **Step 11: 确认 13 处字段错误全部改造完毕**

```bash
pnpm exec grep -rc "FieldError" apps/web/src/components/auth/sign-in-form.tsx apps/web/src/components/auth/sign-up-form.tsx apps/web/src/routes/_auth-pages/forgot-password.tsx apps/web/src/routes/_auth-pages/reset-password.tsx apps/web/src/routes/_app/settings/profile.tsx apps/web/src/routes/_app/settings/security.tsx
```

预期：每个文件的计数为「字段数 + 1」（多出的 1 是 import 行）—— sign-in-form 3、sign-up-form 4、forgot-password 2、reset-password 3、profile 2、security 5。

另确认再无遗留的手写错误渲染：

```bash
pnpm exec grep -rn "meta.errors.map" apps/web/src --include="*.tsx"
```

预期：无输出（退出码 1）。

- [ ] **Step 12: 跑校验三连**

```bash
pnpm lint && pnpm --filter web check-types && pnpm --filter web test
```

预期：全部通过，含 `oauth-buttons.property.test.tsx` 的 200 轮 property 测试。

- [ ] **Step 13: 提交**

```bash
git add apps/web/src/components/auth/sign-in-form.tsx apps/web/src/components/auth/sign-up-form.tsx apps/web/src/routes/_auth-pages/forgot-password.tsx apps/web/src/routes/_auth-pages/reset-password.tsx apps/web/src/routes/_app/settings/profile.tsx apps/web/src/routes/_app/settings/security.tsx
git commit -m "fix(web): associate form errors with inputs for screen readers"
```

---

### Task 8: 修 admin 设置页开关的 aria-label

`admin/settings.tsx` 的 `SwitchField` 传 `aria-label={id}`，而 id 形如 `setting-stripe_enabled`。屏幕阅读器会念出这个机器名。该组件已经有一个 `<Label htmlFor>` 指向它（`FieldRow` 渲染的），但因为 `<button role="switch">` 不是原生表单控件，`htmlFor` 关联不生效，所以需要显式传人类可读的标签文本。

**Files:**
- Modify: `apps/web/src/routes/admin/settings.tsx:255-263`（`renderControl` 的 switch 分支）、`:330-360`（`SwitchField` 定义）

**Interfaces:**
- Produces: `SwitchField` 的 props 增加 `label: string`，`aria-label` 改用它。

- [ ] **Step 1: 改 SwitchField 的签名与 aria-label**

把 `SwitchField` 定义（第 332-360 行附近）替换为：

```tsx
// base-ui 无 Switch 组件封装,这里用一个带样式的 checkbox 作为开关。
// 外观与 shadcn/base-ui toggle 一致(圆点滑动),纯 CSS 实现,无新依赖。
//
// aria-label 必须是人类可读的字段标题：role="switch" 的 <button> 不是原生表单
// 控件，FieldRow 的 <Label htmlFor> 关联不生效，把 id（如 setting-stripe_enabled）
// 当标签会让屏幕阅读器念出机器名。
function SwitchField({
  id,
  checked,
  label,
  onChange,
}: {
  id: string;
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors",
        checked ? "bg-primary" : "bg-input"
      )}
      id={id}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-background shadow ring-1 ring-foreground/5 transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
```

- [ ] **Step 2: 在调用处传入 field.title**

把 `renderControl` 里的 `case "switch"` 分支（第 255-263 行附近）替换为：

```tsx
    case "switch":
      return (
        <SwitchField
          checked={value === "true"}
          id={inputId}
          label={field.title}
          onChange={(checked) =>
            onChange(field.name, checked ? "true" : "false")
          }
        />
      );
```

- [ ] **Step 3: 跑校验三连**

```bash
pnpm lint && pnpm --filter web check-types && pnpm --filter web test
```

预期：全部通过。`check-types` 会在漏传 `label` 时报错，这是本改动的类型保护。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/routes/admin/settings.tsx
git commit -m "fix(web): give admin setting switches human-readable labels"
```

---

### Task 9: 给博客图片补尺寸与懒加载

4 处 `<img>` 全都没有 `width` / `height`（造成 CLS 布局偏移），也没有 `loading="lazy"`。博客列表是 3 列网格，首屏之外的封面图也在立即下载。

**Files:**
- Modify: `apps/web/src/components/blog/blog-card.tsx:33-38`（封面）、`:49-55`（作者头像）
- Modify: `apps/web/src/routes/blog/$slug.tsx:68-75`（作者头像）、`:81-87`（封面）

**Interfaces:** 无新增接口。

- [ ] **Step 1: 改 blog-card.tsx 的封面图**

替换第 33-38 行：

```tsx
        {image ? (
          <img
            alt={title}
            className="aspect-video w-full object-cover"
            decoding="async"
            height={450}
            loading="lazy"
            src={image}
            width={800}
          />
        ) : null}
```

`width`/`height` 给浏览器提供 16:9 的宽高比以预留空间（配合 `aspect-video` 与 `w-full`，实际渲染尺寸仍由 CSS 决定）。列表卡片全部 `loading="lazy"`：网格里大部分卡片在首屏之外。

- [ ] **Step 2: 改 blog-card.tsx 的作者头像**

替换第 49-55 行：

```tsx
            {authorImage ? (
              <img
                alt=""
                className="size-5 rounded-full object-cover"
                decoding="async"
                height={20}
                loading="lazy"
                src={authorImage}
                width={20}
              />
            ) : null}
```

`size-5` 是 20px，尺寸属性与之对齐。

- [ ] **Step 3: 改 blog/$slug.tsx 的作者头像**

替换第 68-75 行的 `<img>`：

```tsx
                {post.authorImage ? (
                  <img
                    alt=""
                    className="size-5 rounded-full object-cover"
                    decoding="async"
                    height={20}
                    loading="lazy"
                    src={post.authorImage}
                    width={20}
                  />
                ) : null}
```

- [ ] **Step 4: 改 blog/$slug.tsx 的正文封面图**

替换第 81-87 行：

```tsx
        {post.image ? (
          <img
            alt={title}
            className="mt-8 w-full rounded-2xl border object-cover"
            decoding="async"
            fetchPriority="high"
            height={675}
            src={post.image}
            width={1200}
          />
        ) : null}
```

这张**不加** `loading="lazy"`：它是文章详情页的主视觉，几乎总在首屏，很可能就是 LCP 元素。用 `fetchPriority="high"` 让它优先。

- [ ] **Step 5: 确认所有图片都有尺寸**

```bash
pnpm exec grep -rn -A9 "<img" apps/web/src --include="*.tsx" | grep -c "width="
```

预期：`4`。

- [ ] **Step 6: 跑校验三连**

```bash
pnpm lint && pnpm --filter web check-types && pnpm --filter web test
```

预期：全部通过。

- [ ] **Step 7: 提交**

```bash
git add apps/web/src/components/blog/blog-card.tsx apps/web/src/routes/blog/\$slug.tsx
git commit -m "perf(web): add dimensions and lazy loading to blog images"
```

---

## Phase 5：SEO 元数据

### Task 10: 建立共享的页面 head 构造器

有 `head()` 的只有 root、privacy、terms 和 blog 两页。全仓 0 处 `og:` / `twitter:` / `canonical`。对比之下 `lib/seo.ts` 的 sitemap 写得很细致（hreflang alternate、XSD 子元素顺序都对）—— 爬虫能发现页面，但页面本身没有可抓的元信息。

`head()` 在 SSR 阶段拿不到 request，所以 canonical 与 og:url 需要一个编译期已知的站点基址。用 `VITE_SITE_URL`（Vite 编译期注入，与既有的 `VITE_GOOGLE_CLIENT_ID` 同一机制），缺省回落到 `http://localhost:3000`。

**Files:**
- Create: `apps/web/src/lib/page-head.ts`
- Create: `apps/web/src/lib/page-head.test.ts`
- Modify: `apps/web/src/lib/branding.ts`（新增 `SITE_URL`）
- Modify: `apps/web/.env.example`（新增 `VITE_SITE_URL` 说明）

**Interfaces:**
- Produces:
  - `const SITE_URL: string`（来自 `lib/branding.ts`）— 无尾斜杠的站点基址
  - `type PageHeadInput = { description: string; image?: string; path: string; title: string }`
  - `function buildPageHead(input: PageHeadInput): { links: { href: string; rel: string }[]; meta: ({ content: string; name: string } | { content: string; property: string } | { title: string })[] }`

- [ ] **Step 1: 写失败的测试**

创建 `apps/web/src/lib/page-head.test.ts`：

```ts
// buildPageHead 的契约：产出 TanStack Router head() 所需的 meta/links，
// 覆盖 title、description、canonical、Open Graph 与 Twitter Card。
import { describe, expect, it } from "vitest";

import { SITE_URL } from "./branding";
import { buildPageHead } from "./page-head";

const findMeta = (
  meta: ReturnType<typeof buildPageHead>["meta"],
  key: "name" | "property",
  value: string
) =>
  meta.find(
    (entry) => key in entry && (entry as Record<string, string>)[key] === value
  ) as Record<string, string> | undefined;

describe("buildPageHead", () => {
  const head = buildPageHead({
    description: "Pricing plans for every stage",
    path: "/pricing",
    title: "Pricing",
  });

  it("puts the title first", () => {
    expect(head.meta.at(0)).toEqual({ title: "Pricing" });
  });

  it("emits a description meta tag", () => {
    expect(findMeta(head.meta, "name", "description")?.content).toBe(
      "Pricing plans for every stage"
    );
  });

  it("emits a canonical link built from SITE_URL", () => {
    expect(head.links).toContainEqual({
      href: `${SITE_URL}/pricing`,
      rel: "canonical",
    });
  });

  it("emits Open Graph title, description, url and type", () => {
    expect(findMeta(head.meta, "property", "og:title")?.content).toBe("Pricing");
    expect(findMeta(head.meta, "property", "og:description")?.content).toBe(
      "Pricing plans for every stage"
    );
    expect(findMeta(head.meta, "property", "og:url")?.content).toBe(
      `${SITE_URL}/pricing`
    );
    expect(findMeta(head.meta, "property", "og:type")?.content).toBe("website");
  });

  it("emits a Twitter card", () => {
    expect(findMeta(head.meta, "name", "twitter:card")?.content).toBe(
      "summary_large_image"
    );
    expect(findMeta(head.meta, "name", "twitter:title")?.content).toBe(
      "Pricing"
    );
  });

  it("omits image tags when no image is given", () => {
    expect(findMeta(head.meta, "property", "og:image")).toBeUndefined();
    expect(findMeta(head.meta, "name", "twitter:image")).toBeUndefined();
  });

  it("absolutizes a relative image path", () => {
    const withImage = buildPageHead({
      description: "d",
      image: "/og/cover.png",
      path: "/blog/hello",
      title: "Hello",
    });
    expect(findMeta(withImage.meta, "property", "og:image")?.content).toBe(
      `${SITE_URL}/og/cover.png`
    );
    expect(findMeta(withImage.meta, "name", "twitter:image")?.content).toBe(
      `${SITE_URL}/og/cover.png`
    );
  });

  it("leaves an absolute image URL untouched", () => {
    const withImage = buildPageHead({
      description: "d",
      image: "https://cdn.example.com/a.png",
      path: "/blog/hello",
      title: "Hello",
    });
    expect(findMeta(withImage.meta, "property", "og:image")?.content).toBe(
      "https://cdn.example.com/a.png"
    );
  });

  it("maps the site root to a canonical without a trailing slash artifact", () => {
    const home = buildPageHead({ description: "d", path: "/", title: "Home" });
    expect(home.links).toContainEqual({ href: `${SITE_URL}/`, rel: "canonical" });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm --filter web test src/lib/page-head.test.ts
```

预期：FAIL，无法解析 `./page-head`，以及 `branding` 没有导出 `SITE_URL`。

- [ ] **Step 3: 给 branding.ts 加 SITE_URL**

在 `apps/web/src/lib/branding.ts` 的 `BRAND_DESCRIPTION` 之后插入：

```ts
// 站点绝对基址（无尾斜杠），用于 canonical / og:url / twitter 卡片。
// head() 在 SSR 阶段拿不到 request，所以这里必须是编译期已知值。
// 经 Vite 的 VITE_ 前缀在构建期注入；未设置时回落到本地开发地址。
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL ?? "http://localhost:3000"
).replace(/\/+$/u, "");
```

- [ ] **Step 4: 实现 page-head.ts**

创建 `apps/web/src/lib/page-head.ts`：

```ts
// apps/web/src/lib/page-head.ts
// 公开页面的元数据构造器（SEO_Module，R24 的页面侧补充）。
//
// lib/seo.ts 负责站点级产物（sitemap / robots / llms），本模块负责单个页面的
// <head>：title、description、canonical、Open Graph、Twitter Card。
// 返回值直接摊进 TanStack Router 路由的 head() 返回对象。
//
// 注意 head() 在 SSR 阶段无法访问 request，因此绝对 URL 一律基于编译期常量
// SITE_URL 构造，而非从请求头派生（后者是 lib/seo.ts 的做法，因为那些端点
// 是服务端 handler，能拿到 Request）。

import { SITE_URL } from "@/lib/branding";

// 对象类型一律用 interface（biome useConsistentTypeDefinitions），
// 且联合类型成员按字母序排列，否则 lint 失败。
export interface PageHeadInput {
  description: string;
  /** 页面图（og:image / twitter:image）。相对路径会基于 SITE_URL 绝对化。 */
  image?: string;
  /** 以 `/` 开头的站内路径，例如 `/pricing`。 */
  path: string;
  title: string;
}

interface TitleMeta {
  title: string;
}

interface NamedMeta {
  content: string;
  name: string;
}

interface PropertyMeta {
  content: string;
  property: string;
}

export interface PageHead {
  links: { href: string; rel: string }[];
  meta: (NamedMeta | PropertyMeta | TitleMeta)[];
}

const ABSOLUTE_URL_PATTERN = /^https?:\/\//u;

function absolute(pathOrUrl: string): string {
  if (ABSOLUTE_URL_PATTERN.test(pathOrUrl)) {
    return pathOrUrl;
  }
  return `${SITE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/**
 * 构造单页 head 元数据。
 *
 * @example
 * head: () =>
 *   buildPageHead({
 *     description: BRAND_DESCRIPTION,
 *     path: "/pricing",
 *     title: `Pricing | ${BRAND_NAME}`,
 *   }),
 */
export function buildPageHead({
  description,
  image,
  path,
  title,
}: PageHeadInput): PageHead {
  const url = absolute(path);
  const meta: (NamedMeta | PropertyMeta | TitleMeta)[] = [
    { title },
    { content: description, name: "description" },
    { content: title, property: "og:title" },
    { content: description, property: "og:description" },
    { content: url, property: "og:url" },
    { content: "website", property: "og:type" },
    { content: "summary_large_image", name: "twitter:card" },
    { content: title, name: "twitter:title" },
    { content: description, name: "twitter:description" },
  ];

  if (image) {
    const imageUrl = absolute(image);
    meta.push(
      { content: imageUrl, property: "og:image" },
      { content: imageUrl, name: "twitter:image" }
    );
  }

  return {
    links: [{ href: url, rel: "canonical" }],
    meta,
  };
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
pnpm --filter web test src/lib/page-head.test.ts
```

预期：PASS，10 个测试通过。

- [ ] **Step 6: 在 .env.example 记录新变量**

在 `apps/web/.env.example` 的「前端编译期开关」小节末尾追加：

```
# 站点绝对基址（无尾斜杠），用于 canonical / og:url / Twitter 卡片。
# 未设置时回落 http://localhost:3000；生产部署必须设为真实域名，
# 否则社交分享卡片与 canonical 会指向 localhost。
VITE_SITE_URL=
```

- [ ] **Step 7: 跑校验三连**

```bash
pnpm lint && pnpm --filter web check-types && pnpm --filter web test
```

预期：全部通过。

- [ ] **Step 8: 提交**

```bash
git add apps/web/src/lib/page-head.ts apps/web/src/lib/page-head.test.ts apps/web/src/lib/branding.ts apps/web/.env.example
git commit -m "feat(web): add shared page head builder with canonical and OG tags"
```

---

### Task 11: 给公开页面接上元数据

首页和定价页目前没有 `head()`，title/description 直接继承 root 的 `BRAND_NAME` —— 搜索结果里两个页面标题相同。博客两页有 title/description 但缺 canonical 与 og:image。

**Files:**
- Modify: `apps/web/src/routes/_marketing/index.tsx`
- Modify: `apps/web/src/routes/_marketing/pricing.tsx`
- Modify: `apps/web/src/routes/blog/index.tsx:23-30`
- Modify: `apps/web/src/routes/blog/$slug.tsx:26-38`

**Interfaces:**
- Consumes: Task 10 的 `buildPageHead`、`lib/branding` 的 `BRAND_NAME` / `BRAND_DESCRIPTION` / `BRAND_TAGLINE`

- [ ] **Step 1: 给首页加 head**

`apps/web/src/routes/_marketing/index.tsx` 整体替换为：

```tsx
import { createFileRoute } from "@tanstack/react-router";

import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { PricingSection } from "@/components/marketing/pricing-section";
import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_TAGLINE } from "@/lib/branding";
import { buildPageHead } from "@/lib/page-head";

export const Route = createFileRoute("/_marketing/")({
  component: LandingPage,
  head: () =>
    buildPageHead({
      description: BRAND_DESCRIPTION,
      path: "/",
      title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
    }),
});

function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <PricingSection />
      <Faq />
    </>
  );
}
```

- [ ] **Step 2: 给定价页加 head**

`apps/web/src/routes/_marketing/pricing.tsx` 整体替换为：

```tsx
import { createFileRoute } from "@tanstack/react-router";

import { PricingSection } from "@/components/marketing/pricing-section";
import { BRAND_NAME } from "@/lib/branding";
import { buildPageHead } from "@/lib/page-head";

export const Route = createFileRoute("/_marketing/pricing")({
  component: PricingPage,
  head: () =>
    buildPageHead({
      description: "Choose the plan that fits where you are today.",
      path: "/pricing",
      title: `Pricing | ${BRAND_NAME}`,
    }),
});

function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 text-center">
      <h1 className="font-bold text-4xl tracking-tight">Pricing</h1>
      <p className="mt-3 text-muted-foreground">
        Choose the plan that fits where you are today.
      </p>
      <PricingSection />
    </div>
  );
}
```

- [ ] **Step 3: 给博客列表页补 canonical / OG**

`apps/web/src/routes/blog/index.tsx` 中，把 `head` 选项（第 23-30 行）替换为：

```tsx
  head: () =>
    buildPageHead({
      description: m["blog.description"](),
      path: "/blog",
      title: `${m["blog.title"]()} | ${BRAND_NAME}`,
    }),
```

并加入 import：

```tsx
import { buildPageHead } from "@/lib/page-head";
```

- [ ] **Step 4: 给博客详情页补 canonical / og:image**

`apps/web/src/routes/blog/$slug.tsx` 中，把 `head` 选项（第 26-38 行）替换为：

```tsx
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {};
    }
    const { post } = loaderData;
    return buildPageHead({
      description: post.description ?? "",
      image: post.image ?? undefined,
      path: `/blog/${post.slug}`,
      title: `${post.title ?? post.slug} | ${BRAND_NAME}`,
    });
  },
```

并加入 import：

```tsx
import { buildPageHead } from "@/lib/page-head";
```

文章封面图此时会同时作为 og:image 与 twitter:image —— 这是分享到社交平台时的卡片配图。

- [ ] **Step 5: 跑校验三连**

```bash
pnpm lint && pnpm --filter web check-types && pnpm --filter web test
```

预期：全部通过。

- [ ] **Step 6: 验证渲染出的 HTML 真的带上了这些标签**

```bash
pnpm --filter web build
```

在你自己的终端里手动起服务（不要让 agent 起长驻进程）：

```
pnpm --filter web start
```

然后：

```bash
curl -s http://localhost:3000/pricing | grep -o '<link rel="canonical"[^>]*>\|<meta property="og:[^>]*>\|<title>[^<]*</title>' | head
```

预期：能看到 `<title>Pricing | openstarter</title>`、`og:title`、`og:url`、以及指向 `/pricing` 的 canonical。修改前只有继承自 root 的 `<title>openstarter</title>`。

- [ ] **Step 7: 提交**

```bash
git add apps/web/src/routes/_marketing/index.tsx apps/web/src/routes/_marketing/pricing.tsx apps/web/src/routes/blog/index.tsx apps/web/src/routes/blog/\$slug.tsx
git commit -m "feat(web): add page metadata to landing, pricing and blog routes"
```

---

## Phase 6：清理

### Task 12: 把 StatusText 复用到 settings 侧

6 个 settings 页面（accounts、apikeys、credits、payments、sessions、tickets）各自手写 `isPending ? <p>Loading...</p> : null` 加 `error ? <p>…</p> : null` 的组合。`components/admin/list.tsx` 里的 `StatusText` 已经封装了这个模式，但只在 admin 侧用。把它挪到中立位置，两边共用。

这 6 个页面**并非同构**，逐个核对过实际写法后的分类：

| 文件 | 现状 | 处理 |
| --- | --- | --- |
| `tickets.tsx` | loading + error + empty 三态齐全 | 直接替换 |
| `apikeys.tsx` | 三态齐全（empty 在列表之后） | 直接替换 |
| `sessions.tsx` | 三态齐全 | 直接替换 |
| `accounts.tsx` | 只有 loading + error，**无 empty** | 替换并补上空态（行为改善） |
| `payments.tsx` | 只有 error + empty，**无 loading** | 替换并补上加载态（行为改善） |
| `credits.tsx` | loading 是余额位的内联 `—` 占位，不是独立提示 | **排除**，见 Step 6 |

**Files:**
- Create: `apps/web/src/components/system/status-text.tsx`
- Modify: `apps/web/src/components/admin/list.tsx`（移除 `StatusText`，改为再导出）
- Modify: `apps/web/src/routes/_app/settings/tickets.tsx`、`apikeys.tsx`、`sessions.tsx`、`accounts.tsx`、`payments.tsx`
- 不改：`apps/web/src/routes/_app/settings/credits.tsx`

**Interfaces:**
- Produces: `function StatusText(props: { empty: boolean; emptyLabel?: string; error: Error | null; loading: boolean }): ReactNode` — 从 `@/components/system/status-text` 导出；`@/components/admin/list` 继续再导出它以免改动 7 个 admin 页面的 import。

- [ ] **Step 1: 新建共享组件**

创建 `apps/web/src/components/system/status-text.tsx`，把 `list.tsx` 里的实现原样搬过来并补上文件注释：

```tsx
// apps/web/src/components/system/status-text.tsx
// 列表类页面的 loading / error / empty 三态提示。
// admin 与 settings 两侧共用（原先只存在于 components/admin/list.tsx，
// 导致 settings 侧 6 个页面各自手写同一套三元表达式）。

export function StatusText({
  loading,
  error,
  empty,
  emptyLabel = "No records found.",
}: {
  loading: boolean;
  error: Error | null;
  empty: boolean;
  emptyLabel?: string;
}) {
  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading...</p>;
  }
  if (error) {
    return <p className="text-destructive text-sm">{error.message}</p>;
  }
  if (empty) {
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;
  }
  return null;
}
```

- [ ] **Step 2: 让 admin/list.tsx 再导出**

删掉 `apps/web/src/components/admin/list.tsx` 末尾的 `StatusText` 定义（第 66 行到文件结尾），改为在文件顶部 import 区之后加一行再导出：

```tsx
// StatusText 已迁至 components/system（admin 与 settings 共用）。
// 这里保留再导出，使既有 `import { AdminHeader, StatusText } from "@/components/admin/list"` 不必改动。
export { StatusText } from "@/components/system/status-text";
```

- [ ] **Step 3: 确认 admin 侧未回归**

```bash
pnpm lint && pnpm --filter web check-types && pnpm --filter web test src/routes/admin/roles.test.tsx
```

预期：全部通过 —— 7 个 admin 页面的 import 未改动，行为不变。

- [ ] **Step 4: 替换 settings/tickets.tsx 的三态渲染**

加入 import：

```tsx
import { StatusText } from "@/components/system/status-text";
```

把 `<CardContent className="space-y-2">` 里的 loading/error/empty 三块（第 148-181 行附近的 `listQuery.isPending ? …`、`listQuery.error ? …`、以及底部 `items.length === 0 && !listQuery.isPending ? …`）合并为一处，放在 items 列表**之前**：

```tsx
          <StatusText
            empty={items.length === 0}
            emptyLabel="No tickets yet."
            error={listQuery.error as Error | null}
            loading={listQuery.isPending}
          />
```

列表本身的 `{items.length > 0 ? (…) : null}` 保持不变。

- [ ] **Step 5: 替换 apikeys.tsx 与 sessions.tsx（三态齐全，直接替换）**

两个文件都先加 import：

```tsx
import { StatusText } from "@/components/system/status-text";
```

`apikeys.tsx`：删掉第 116-122 行的 loading/error 两块，以及第 167-169 行的 empty 块，在列表 `{items.length > 0 ? … }` **之前**插入：

```tsx
        <StatusText
          empty={items.length === 0}
          emptyLabel="No API keys yet."
          error={keysQuery.error as Error | null}
          loading={keysQuery.isPending}
        />
```

`sessions.tsx`：删掉第 102-108 行的 loading/error 两块，以及第 158 行起的 `sessions.length === 0 && !sessionsQuery.isPending && …` 空态块，在会话列表之前插入：

```tsx
        <StatusText
          empty={sessions.length === 0}
          emptyLabel="No active sessions."
          error={sessionsQuery.error as Error | null}
          loading={sessionsQuery.isPending}
        />
```

`emptyLabel` 用该页原本的空态文案。若原文案与这里给的不同，以**原文案**为准（本 task 不改文案）。

- [ ] **Step 6: 替换 accounts.tsx 与 payments.tsx（会补齐缺失的一态）**

这两个文件各缺一态，替换后会新增一条此前不存在的提示。这是有意的改善，不是回归 —— 但要知道视觉上会多出内容。

`accounts.tsx` 此前只有 loading 与 error，没有空态。删掉第 118-124 行两块，插入：

```tsx
        <StatusText
          empty={accounts.length === 0}
          emptyLabel="No linked accounts."
          error={accountsQuery.error as Error | null}
          loading={accountsQuery.isPending}
        />
```

注意：`empty` 表达式里的数组变量名以该文件实际的列表变量为准（先 `grep -n "accountsQuery.data" apps/web/src/routes/_app/settings/accounts.tsx` 确认，可能是 `accounts` 或 `items`）。

`payments.tsx` 此前只有 error 与 empty，没有加载态 —— 首次进入页面时是空白。删掉第 79-82 行的 error 块与第 128-129 行的 empty 块，插入：

```tsx
        <StatusText
          empty={items.length === 0}
          emptyLabel="No payments yet."
          error={ordersQuery.error as Error | null}
          loading={ordersQuery.isPending}
        />
```

- [ ] **Step 7: 明确跳过 credits.tsx**

不要改这个文件。它的加载态不是一条独立提示，而是余额数字位上的内联占位（第 66 行 `{creditsQuery.isPending ? "—" : balance.toLocaleString()}`），`StatusText` 的三态模型表达不了这种就地占位。硬套会把「余额位显示 —」变成「整块被 Loading... 替换」，是一次无谓的视觉退化。

它的 error 与 empty 两块与 `StatusText` 形态相近，但只为这两态引入组件、同时把 loading 留在原地，会让这个文件出现两套并存的状态表达 —— 比现状更难读。保持原样。

- [ ] **Step 8: 确认样板已收敛**

```bash
pnpm exec grep -rn "Loading [a-z]*\.\.\." apps/web/src/routes/_app/settings --include="*.tsx"
```

预期：无输出（退出码 1）—— `Loading accounts...` / `Loading API keys...` / `Loading sessions...` / `Loading tickets...` 四处自定义加载文案都已收敛到 `StatusText` 的统一 `Loading...`。

```bash
pnpm exec grep -rlc "StatusText" apps/web/src/routes/_app/settings/*.tsx
```

预期：列出 5 个文件（tickets、apikeys、sessions、accounts、payments），不含 credits。

- [ ] **Step 9: 跑校验三连**

```bash
pnpm lint && pnpm --filter web check-types && pnpm --filter web test
```

预期：全部通过。既有的 `-settings.test.tsx` 覆盖了 settings 区域，它必须仍然通过 —— 如果它断言了某条具体的加载文案（例如 `Loading sessions...`），本 task 会让它失败。此时把断言更新为 `StatusText` 输出的 `Loading...`，这是预期内的调整，不要为了迁就测试而保留旧文案。

- [ ] **Step 10: 提交**

```bash
git add apps/web/src/components/system/status-text.tsx apps/web/src/components/admin/list.tsx apps/web/src/routes/_app/settings
git commit -m "refactor(web): share StatusText between admin and settings pages"
```

---

### Task 13: 移除未使用的 web-vitals 依赖

`apps/web/package.json` 的 devDependencies 里有 `web-vitals: ^5.2.0`，全仓 0 处引用。要么接进 `packages/analytics` 做真实用户监控，要么删掉。本 task 选择删除 —— 接入 RUM 是一个独立的产品决策，不该以「装了个没用的包」的形式半吊着。

**Files:**
- Modify: `apps/web/package.json:52`

**Interfaces:** 无。

- [ ] **Step 1: 再次确认无引用**

```bash
pnpm exec grep -rn "web-vitals" apps packages --include="*.ts" --include="*.tsx" | grep -v node_modules
```

预期：无输出（退出码 1）。若有输出则**停止本 task**，改为把它接进 analytics 包。

- [ ] **Step 2: 移除依赖**

```bash
pnpm --filter web remove web-vitals
```

- [ ] **Step 3: 确认构建与测试不受影响**

```bash
pnpm lint && pnpm --filter web check-types && pnpm --filter web test && pnpm --filter web build
```

预期：全部通过。

- [ ] **Step 4: 提交**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): drop unused web-vitals dependency"
```

---

## 收尾验证

全部 task 完成后，跑一遍与 CI 等价的完整门禁：

- [ ] **完整校验**

```bash
pnpm test && pnpm generate:routes && pnpm exec turbo check-types && pnpm lint && pnpm build && pnpm --filter web cf:build
```

这与 `.github/workflows/ci.yml` 的步骤一致（少了 coverage 收集）。预期全部通过。

- [ ] **确认体积收益**

```bash
for f in apps/web/.output/public/assets/*.js; do
  printf "%8d  %s\n" "$(gzip -c "$f" | wc -c)" "$(basename "$f")"
done | sort -rn | head -5
```

对照基准（本计划实施前的实测值）：入口 `index-*.js` gzip 约 178KB，另有独立的 `zod-*.js` gzip 约 75KB。预期 zod chunk 消失。

- [ ] **确认改动清单**

```bash
git log --oneline main..HEAD
```

预期 13 个左右的提交，每个对应一个 task。

---

## 后续计划

以下三块从本计划中剔除，各自需要独立的 plan。理由不是优先级低，而是它们各自的体量与决策面都足以独立成篇 —— 塞进本计划会让任务无法给出完整代码。

**1. i18n 接入**（建议下一个做，落差最大）

`packages/i18n/messages/{en,zh}.json` 各有 810 条消息，实测只有 3 个文件引用编译后的消息（`lib/i18n.ts`、`routes/blog/index.tsx`、`routes/blog/$slug.tsx`）。按目录统计：`routes/admin` 0/8、`routes/_app` 0/15、`routes/_marketing` 0/3、`routes/_auth-pages` 0/5、`components/*` 0/17。基础设施是齐的（Vite 插件的 URL 前缀策略、`server.ts` 的 `paraglideMiddleware`、`router.tsx` 的双向 rewrite），所以访问 `/zh/login` 目前仍是英文，约 802 条已翻译消息是死代码。

这个 plan 需要先定两件事，才能写任务：一是 810 个 key 与 48 个文件的映射表（消息目录里 `common.sign.sign_in_title` 这类 key 显然是给 `sign-in-form.tsx` 准备的，但需要逐条确认），二是 key 缺失时的兜底策略（`lib/i18n.ts` 的 `tDynamic` 已有回落到 key 本身的行为，静态访问路径需要对应约定）。建议按目录分批，每批一个 task，每批结束都能在 `/zh` 前缀下人工验证。

**2. 数据获取重构**

20 个 admin/settings 页面里 19 个用纯客户端 `useQuery`，只有 `settings/index.tsx` 有 loader（且只是重定向）。全仓 0 处 `ensureQueryData` / `prefetchQuery` / `queryOptions`。叠加 `admin/route.tsx` 与 `_app/route.tsx` 的 `ssr: false` 加 beforeLoad 里串行两个请求（`authClient.getSession()` 然后 `api.user.permissions`），进入 `/admin/users` 的链路是：空白 → JS → getSession → permissions → 渲染 → 才发数据请求，四层瀑布。

改造方向是建立 `queryOptions` 工厂 + route loader 里 `ensureQueryData` 预取，把数据请求提到导航时并行。之所以要独立成 plan：需要先决定 SSR 边界（这些页面当前刻意 `ssr: false`，认证态在客户端解析，改成 loader 预取要重新审视是否保持 `ssr: false`），这个决策会影响全部 19 个页面的写法。Task 4 开启的 `defaultPreload: "intent"` 会与这项改造叠加放大收益 —— loader 预取加 hover 预加载，数据在用户点击前就到位。

**3. 安全加固**

web、api、auth 三个包扫下来 0 处速率限制。登录、注册、密码重置、magic link、发验证邮件、创建工单全部无节流，暴力破解与邮件轰炸都是敞口。同时 0 处 CSP / X-Frame-Options / HSTS。

这块要独立，是因为要先做一个部署层面的决策：节流放在应用层（Hono 中间件，`packages/api/src/index.ts` 已有清晰的 `app.route("/", xxx)` 挂载点和 `app.onError` 统一错误处理，接中间件的位置是现成的）还是放在边缘层（Cloudflare Rate Limiting Rules / WAF，毕竟已有 `cf:build` 与 `wrangler.jsonc`）。两条路的任务完全不同。安全响应头同理 —— Nitro 层加还是 Workers 层加。

**4. 注册页独立路由**

`_auth-pages/login.tsx` 目前用 `useState(showSignIn)` 在登录与注册之间切换，两个表单都打进同一个 login chunk。后果：没法直链注册页，做不了注册落地页的转化追踪与 SEO，广告投放也无法把流量直接送到注册表单。

这块要独立，是因为需要先定产品决策：路径用 `/signup` 还是 `/register`；登录页是否保留「Need an account?」的就地切换（保留则两个路由共用组件、切换改为 `navigate`，不保留则彻底拆开）；以及注册页要不要独立的 `head()`（如果要，会依赖本计划 Task 10 的 `buildPageHead`）。定完之后改动本身不大，但它会与后续 i18n 接入在同一批文件上冲突，建议排在 i18n **之前**做完。

**5. 测试覆盖**（可与上述任一并行）

`apps/web` 只有 4 个测试文件，全仓 38 个；`vitest.config.ts` 的 coverage 阈值是 2%。本计划新增了 4 个测试文件（form-validation、field-error、page-head、admin/roles 回归），但仍未覆盖：登录注册流程、admin RBAC 守卫、支付结算。性价比最高的起点是 `lib/seo.ts` 的 `buildSitemapXml` / `buildRobotsTxt` / `buildLlmsTxt` —— 它们是无副作用纯函数（作者刻意这样设计的，文件注释里写明了「便于单测、无副作用」），却一个测试都没有。
