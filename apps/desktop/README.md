# @openstarter/desktop

Electron 桌面外壳：复用 `apps/web` 的同一套 UI 与 API，加载你部署好的站点 URL。
本地能出三平台安装包，并通过 GitHub Releases 支持自动更新。

## 定位

这不是一个离线优先的桌面应用——它是一个"远程加载"的外壳：生产环境下 app 会打开你
配置的站点 URL，行为等价于把该站点装进一个原生窗口。好处是内容更新不需要重新发版
桌面端；代价是完全离线时无法使用（会显示兜底页而不是白屏）。

## 开发

```bash
pnpm dev:desktop
```

这会启动 `apps/web` 的 Vite dev server（端口 3000）并等待其就绪，再打开一个加载
`http://localhost:3000` 的 Electron 窗口。

## 构建

```bash
pnpm build:desktop
```

用 esbuild 把 `src/main.ts` 和 `src/preload.ts` 编译成 `dist/*.cjs`。站点 URL 的
默认值在这一步通过 `OPENSTARTER_DESKTOP_APP_URL` 环境变量注入，例如：

```bash
OPENSTARTER_DESKTOP_APP_URL=https://app.yourdomain.com pnpm build:desktop
```

## 打包（本机出安装包，不发布）

```bash
pnpm package:desktop
```

产物在 `apps/desktop/release/`：macOS 出 `.dmg` + `.zip`，Windows 出 NSIS 安装包，
Linux 出 AppImage + `.deb`。这一步不会推送到 GitHub Releases。

## 发版

```bash
GH_TOKEN=<your-token> pnpm release:desktop
```

发版前必须：
1. 更新 `apps/desktop/package.json` 里的 `version`（electron-builder 和
   electron-updater 都从这里读版本号做比对，不会跟随根 `package.json`）。
2. 确认 `apps/desktop/electron-builder.yml` 里的 `publish.owner` / `publish.repo`
   已改成你自己的 GitHub 仓库。

## 模板使用者必改项

把这个模板变成你自己的产品前，至少要改：

| 位置 | 字段 | 说明 |
|---|---|---|
| `electron-builder.yml` | `appId` | 改成你自己的反向域名标识，如 `com.yourcompany.yourapp` |
| `electron-builder.yml` | `productName` | 窗口标题、安装包文件名里显示的产品名 |
| `electron-builder.yml` | `publish.owner` / `publish.repo` | 你的 GitHub 仓库，自动更新依赖这个 |
| `build-resources/icon.png` | — | 换成你自己的 1024×1024 图标，当前是占位图 |
| `package.json` | `version` | 每次发版前手动递增 |
| `.env` | `OPENSTARTER_DESKTOP_APP_URL` | 你部署好的站点地址（构建时注入，见上方"构建"一节）|

## 已知限制

**OAuth 登录在桌面端不可用。** 导航白名单只允许站内跳转，OAuth 登录会把用户导向
`accounts.google.com` 之类的第三方域，这会被识别为站外导航并转到系统浏览器打开，
登录完成后的回调落在浏览器而不是 app 窗口里，流程会断掉。即便把 OAuth 域加入白名单
也不完全可靠——Google 明确拒绝在嵌入式 webview 里完成 OAuth，会返回
`disallowed_useragent` 错误。

邮箱密码登录在窗口内完全可用，这是模板的默认登录方式。真正支持 OAuth 需要让登录流程
走系统浏览器 + 自定义协议（如 `openstarter://auth/callback`）唤回 app，这需要
`apps/web` / `packages/api` 侧配合签发一次性可交换 token，属于独立的后续工作。

**macOS 上未签名的 app 无法自动更新。** Apple 的 Squirrel.Mac 更新框架强制校验代码
签名，这一点无法通过配置绕过。在你接入 Apple Developer 证书（`electron-builder.yml`
里 `mac.notarize` / `mac.identity` 字段）之前，macOS 用户只能手动下载新版本安装。
Windows（NSIS）和 Linux（AppImage）未签名也能正常自动更新，Windows 会有一次
SmartScreen "未知发布者"警告。

## 后续项（本轮未做）

- CI 打包矩阵（GitHub Actions 跑三平台构建）
- 代码签名与 macOS 公证的实际接入（配置文件已留字段和注释）
- 应用内更新提示 UI（当前只有系统通知，下次启动生效）
- 托盘常驻、全局快捷键
- 离线数据 / 本地数据库
- OAuth 走系统浏览器 + deep link 回调

## 人工验收清单

自动化测试只覆盖纯逻辑模块（`config`/`security`/`window-state`/`menu`/`updater`）。
以下步骤需要手动验证，涉及真实的 Electron 窗口行为：

1. `pnpm dev:desktop` 能跑起来，窗口显示 web 首页
2. 窗口内可以用邮箱密码登录，进入登录后的应用路由
3. `Cmd+C` / `Cmd+V` / `Cmd+A`（Windows/Linux 用 `Ctrl`）在窗口内的输入框里生效
4. 点击站外链接（如页脚的外部链接）会在系统浏览器打开，不会在窗口内跳转
5. 停掉 web dev server 后重启 app，应显示兜底页；恢复 dev server 后点"Retry"按钮能重新加载成功
6. `pnpm package:desktop` 在本机能产出安装包；安装后启动，确认能连上 `.env` 里配置的站点 URL
7. 关闭 app 再重新打开，窗口的尺寸和位置应与关闭前一致
