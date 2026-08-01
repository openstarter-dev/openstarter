# Browser Extension — 手工验证清单（Task 9）

> 对应 `docs/superpowers/plans/2026-08-01-browser-extension-app.md` 的 Task 9 与 spec §8.4。
> 该步骤无法在无浏览器环境的会话中自动完成，已自动化部分记录在此，余下需操作者在本机 Chrome 实跑。

## 已自动化确认（CLI 侧）

| 检查 | 结果 |
| --- | --- |
| `packages/api` 无 CORS 中间件 | 确认（`grep -rn cors packages/api/src` 为空） |
| `app.onError` 统一错误体 `{ code: -1, message }` | 确认（`packages/api/src/index.ts:36-43`） |
| `GET /api/health` 探针端点存在 | 确认（`packages/api/src/routes/health.ts`，挂载于 `index.ts:68`） |
| Web dev 服务可达 | 确认（`pnpm dev:web` 启动后 `curl http://localhost:3000/api/health` 返回 `200 {"status":"ok"}`） |
| 构建产物 manifest 正确 | 确认（`.output/chrome-mv3/manifest.json`：`permissions:["cookies"]`、`host_permissions:["http://localhost:3000/*"]`、`action.default_popup:"popup.html"`） |
| 全仓自动化闸门 | `pnpm check-types` 13/13、`pnpm lint` clean、`pnpm test` 57 文件/271 用例、`pnpm build` 3/3，`git status` 无遗留 |

## Task 9 Step 2 — 在 popup 内探测 CORS

未在浏览器内执行。MV3 文档：扩展源 / service worker 对声明了 `host_permissions` 的源发起的跨源请求豁免 CORS。本仓库 API 不强制 CORS，故预期分支为 **(a) 豁免成立**。
若操作者在 popup DevTools 控制台执行 `fetch("http://localhost:3000/api/health").then(r=>r.json()).then(console.log)` 看到 CORS 报错，再按 Task 9 Step 3 挂 `hono/cors`（收窄为具体 extension ID）并把 `trustedOrigins` 收窄。

## 待操作者执行（spec §8.4）

1. `pnpm dev:web` 起后端，`pnpm dev:extension` 起 WXT。
2. `chrome://extensions` 开发者模式 → 加载 `.output/chrome-mv3-dev`。
3. 未登录打开 popup → 应为 `signed-out`，点「Sign in」开出 web 登录页。
4. web 端登录后重开 popup → 应显示账户数据（plan / credits / subscription）。
5. 点「Manage in web app」→ 新标签到 `/settings/profile`。
6. popup 点「Sign out」→ 刷新 web 标签 → web 端应也已登出（共享会话语义）。
7. 改 `apps/extension/.env` 为非法 URL → 重启 `pnpm dev:extension` 并 reload 扩展 → 应为 `misconfigured` 而非网络错误。
8. 还原 `.env` 为 `VITE_APP_URL=http://localhost:3000`。
