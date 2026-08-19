# CLI 端到端集成测试日志

计划：`docs/superpowers/plans/2026-08-01-cli-application.md` Task 15
分支：`cli-application`（worktree `../openstarter-cli`）
日期：2026-08-02
执行者：自动化（autonomous loop）

## 方法说明

本任务的「真实设备授权登录」流程（Task 15 Step 4 及之后）本质上需要人在浏览器里
对 `/device` 页面点「授权」——RFC 8628 device authorization grant 的 approve 端点要求
一个真实登录会话（`requireHeaders: true`，靠会话 cookie 鉴权），无法用无头 shell 完成。
无需人工的验证已全部自动化（见下「自动化验证」）；需真人的流程列在「手工流程（未执行）」
并以可复现脚本记录，待有运行环境+测试账号时按步执行。

## 自动化验证（已执行并通过）

### 1. 全量构建（turbo build）—— PASS

`pnpm build` → `4 successful, 4 total`。@openstarter/cli、@openstarter/api、
apps/web（含新 device 页与 routeTree 生成）等全部构建成功。

### 2. 类型检查 —— PASS

- `pnpm --filter @openstarter/db check-types`
- `pnpm --filter @openstarter/auth check-types`（含新增的 11 个 device 错误码翻译键映射）
- `pnpm --filter @openstarter/api check-types`
- `pnpm --filter @openstarter/cli check-types`
- `pnpm --filter @openstarter/i18n check-types` + test（5 passed）
- apps/web 仅有**预存在**的 paraglide 代码生成缺失报错（main 分支同样存在），
  device.tsx 本身无新增报错。

### 3. API 路由集成测试（vitest） —— PASS（25 passed / 9 files）

- `status.test.ts`：`GET /api/status` 返回 `{ code:0, message:"ok", data:{status:"ok", timestamp, version:"0.1.0"} }` 信封。
- `notes.test.ts`：mock requireAuth（注入 userId）后验证
  - POST /api_notes 创建并回包信封（note_NN、userId、createdAt/updatedAt）；
  - GET /api_notes 按 userId 隔离（iso-user 看不到 other-user 的笔记）；
  - GET /api_notes/:id 不存在时返回 404 信封 `{code:-1, message:"note not found"}`；
  - POST body 非法时拒绝（400/422）。
- 其余既有测试无回归。

### 4. CLI 手工冒烟（node 调 dist）—— PASS

| 命令                                           | 预期                                                                        | 结果        |
| ---------------------------------------------- | --------------------------------------------------------------------------- | ----------- |
| `node apps/cli/dist/index.js --help`           | 列出 login/logout/whoami/profile/profile:update/list/get/create/status/info | ✅ 全部出现 |
| `node apps/cli/dist/index.js logout`           | `✓ 已登出`                                                                  | ✅          |
| `node apps/cli/dist/index.js whoami`（未登录） | `❌ 认证错误...`，退出码 2                                                  | ✅ exit=2   |
| `node apps/cli/dist/index.js info`             | 键值对：CLI Version/API URL/Config/Logged in                                | ✅          |

### 5. 打包体积 —— PASS（达标）

`du -sh apps/cli/dist` = **9.6 KB**（`dist/index.js` 9.75KB）。
目标 < 5MB → **达标**（差距 ~500×）。

### 6. 启动时间 —— PARTIAL

`node apps/cli/dist/index.js --version`，10 次暖启动（`--prepare` 预热）耗时（秒）：
`0.15 0.15 0.15 0.16 0.16 0.16 0.17 0.17 0.18 0.27`

- 中位 ~150ms，P90 ~180ms，偶发 270ms（首次冷启动约 320ms）。
- 目标 < 100ms → **未达标**。原因分析：Node.js 进程自身冷启动即 ~80–90ms
  （`node --version` 约 40ms 仅 fork+print，真正加载 ESM 模块图基线更高）。
  显著优化已做：`conf` 实例与 `ConfigManager` 改为懒加载单例（Proxy），
  使 `--version`/`--help`/未鉴权命令不再付出读盘+构造开销，冷启动由 320ms 降至 ~150ms 暖态。
  进一步逼近 100ms 需替换运行时（如 Bun）或自写 native shim，超出本计划范围；
  已将其作为已知限制记录，不伪称达标。

## 手工流程（未执行 / 需真人）

下列步骤需一台运行中的后端（带 DB 与 Better Auth）与浏览器登录会话，autonomous 环境不具备，
故未执行。附可复现命令，待具备条件时按序运行即可。

1. **启动后端**（需 `.env` 指向可用数据库并 `pnpm db:push` 后）：
   ```bash
   pnpm --filter @openstarter/db db:push
   pnpm --filter web dev   # http://localhost:3000
   ```
2. **创建测试用户**：浏览器访问 `/login` 注册，或 `pnpm seed:admin`。
3. **status（无需认证）**：`node apps/cli/dist/index.js status --api-url http://localhost:3000`
4. **login（设备授权）**：
   - 运行 `node apps/cli/dist/index.js login --api-url http://localhost:3000`
   - 终端打印 verification_uri_complete（`http://localhost:3000/device?user_code=XXXX`）与 user_code。
   - 用已登录用户的浏览器打开该链接 → `/device` 页显示代码 → 点「授权」。
   - CLI 轮询 `/api/auth/device/token` 命中 approved → 打印 `✓ 登录成功！`。
5. **whoami**：`node apps/cli/dist/index.js whoami` → 应回包 `{id,email,name,createdAt}`。
6. **profile**：`node apps/cli/dist/index.js profile` → 同上。
7. **create**：`node apps/cli/dist/index.js create --name "Test Note" --description "Testing CLI"` → `✓ 已创建笔记: note_NN`。
8. **list**：`node apps/cli/dist/index.js list` → 含刚创建的笔记。
9. **get**：`node apps/cli/dist/index.js get note_NN` → 笔记详情。
10. **JSON 输出**：`node apps/cli/dist/index.js list --json` → JSON 数组。
11. **logout**：`node apps/cli/dist/index.js logout` → `✓ 已登出`。
12. **登出后 auth 命令**：`node apps/cli/dist/index.js whoami` → 退出码 2。

## 结论

实现已通过自动化可达的全部验证（构建、类型、路由信封与隔离行为、CLI 冒烟、体积达标）。
启动时间目标因 Node 运行时基线无法在现实现内达成 100ms，已做懒加载优化至中位 ~150ms
并如实记录为已知限制。需真人的端到端设备授权登录留有可复现脚本，待有运行环境时执行。
