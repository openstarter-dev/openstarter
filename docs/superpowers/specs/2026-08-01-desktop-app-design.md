# 桌面端应用设计（apps/desktop）

日期：2026-08-01
状态：已评审通过，待实现

## 1. 背景与现状

`apps/desktop` 目录已存在，但未提交到 git，且只是一个最小骨架：

- `src/main.cjs`：手写 CommonJS 的 Electron 主进程，`loadURL` 到 `http://localhost:3000`，已配置 `contextIsolation` / `sandbox` / `nodeIntegration: false`，外链走 `shell.openExternal`。
- `scripts/run-desktop.mjs`：用 Node 内置 API 编排 dev 流程（起 web 的 Vite dev server → 探测就绪 → spawn Electron），不引入 `concurrently` / `wait-on`。
- 缺失：preload、生产构建、打包配置、自动更新、加载失败兜底、应用菜单、类型检查覆盖、测试、文档。

`main.cjs` 在 `apps/desktop/tsconfig.json` 里因 `checkJs: false` 完全脱离类型检查，是全仓库唯一逃过 TS strict 与质量门禁的源码文件。

同级的 `apps/cli`、`apps/extension`、`apps/mobile` 均为空占位目录，本设计不涉及。

## 2. 目标与非目标

### 目标

把上述骨架变成模板中可交付的桌面端：模板使用者执行一条命令就能得到三平台安装包，安装后能连上自己部署的站点，并且能收到下一个版本的更新通知。

### 非目标（本轮明确不做）

- CI 打包矩阵（GitHub Actions 三平台）
- 代码签名与 macOS 公证的实际接入（只在配置里留字段与注释）
- 应用内更新 UI（横幅、进度条、立即重启）
- 托盘常驻、全局快捷键、系统通知业务化
- 离线数据与本地数据库
- OAuth deep link 回调

以上全部记入 `apps/desktop/README.md` 的后续项。

## 3. 关键决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 定位 | 可分发的桌面外壳 | 复用 web 的 UI 与 API，本轮价值集中在"能发版"这条链路上 |
| 生产渲染源 | 远程加载线上站点 URL | 改动量最小，内容更新不需要重新发版；代价是离线不可用，用内置兜底页补偿 |
| 交付范围 | 本地能出包 + 自动更新 | "能发版"的最小完整定义是装得上且收得到下一版 |
| 更新源 | GitHub Releases（`github` provider） | 开源模板零成本；配置里同时留 `generic` provider 字段与注释 |
| 代码形态 | TypeScript + esbuild 编译 + 按职责拆模块 | 与全仓库 TS strict / ultracite / vitest 门禁一致；`updater` 与安全策略必然让单文件膨胀 |
| 框架 | 继续用 Electron，不换 Tauri | Tauri 要求使用者装 Rust 工具链，与"clone 完就能跑"的模板定位冲突；且对纯远程 URL 加载支持较弱 |
| OAuth | 记为已知限制 | 见 §9；正确解（deep link）需要 web/API 侧配合，是独立议题 |

### 依赖版本

全部固定为精确版本，不用范围符：

- `electron`：`43.2.0`（从骨架里的 `^33.2.0` 升级。Electron 33 已停止安全更新，而远程加载模式下渲染进程执行的是远端代码，跑 EOL 的 Chromium 有实际风险）
- `electron-builder`：`26.15.3`（devDependency）
- `electron-updater`：`6.8.9`（被 esbuild 打进产物，见 §6）
- `esbuild`：`0.28.1`（devDependency）

三者都只被 `apps/desktop` 使用，不进 `pnpm-workspace.yaml` 的 catalog。

## 4. 架构

一份代码两种运行模式，区分依据是 `app.isPackaged`，不用 `NODE_ENV`（打包后的 app 里环境变量不可控）。

```
dev   pnpm dev:desktop → run-desktop.mjs 起 web dev server(3000) + Electron
      → 窗口指向 http://localhost:3000

prod  安装包内 Electron → 窗口指向构建时注入的站点 URL
      → 可被运行时环境变量覆盖

fail  任一模式下 did-fail-load → 加载 resources/offline.html（带重试按钮）
```

进程边界三层：

- **主进程**：持有全部 Node 权限。负责窗口生命周期、应用菜单、导航安全策略、更新检查。
- **preload**：唯一的桥。通过 `contextBridge.exposeInMainWorld("desktop", …)` 暴露 `{ platform, retry() }`，不暴露任何 Node 原语。不暴露版本号——preload 运行在 renderer 进程，取不到 `app.getVersion()`，唯一"可用"的替代（`process.env.npm_package_version`）在打包后由用户双击启动的 app 里恒为空，与其暴露一个总是空的字段，不如等真正有消费者时再通过 IPC 正确实现。
- **渲染进程**：远程 web 页面。保持 `sandbox: true`、`contextIsolation: true`、`nodeIntegration: false`。

`retry()` 只服务于兜底页，通过 `ipcRenderer.invoke` 触发主进程重新 `loadURL`。远程站点页面虽然也能看到这个 API，但它只能重新加载已白名单的 URL，不构成额外攻击面。

## 5. 模块划分

`apps/desktop/src/` 下每个文件一个职责。核心手法：判断逻辑写成不依赖 Electron 的纯函数，Electron API 调用留在薄薄的一层。这样 vitest 覆盖真正会出错的地方，无需在 CI 里启动 Electron。

| 文件 | 职责 | 运行时依赖 Electron | 单测 |
|---|---|---|---|
| `config.ts` | 解析校验站点 URL、更新源开关、运行模式；非法输入返回带原因的失败结果（不抛异常，见 §8） | 否 | 有 |
| `security.ts` | 导航白名单纯判定 + 三个决策处理器工厂（窗口打开 / 导航 / 权限请求） | 否 | 有 |
| `window-state.ts` | 窗口尺寸位置的解析、校验、读写 | 否 | 有 |
| `menu.ts` | 菜单模板构造（纯数据） | 否（仅 `import type`） | 有 |
| `updater.ts` | 更新开关策略、更新源探测、延迟调度（检查函数由调用方注入） | 否 | 有 |
| `log.ts` | 统一日志前缀，写 `process.stdout` / `process.stderr` | 否 | 无（一行封装） |
| `window.ts` | 创建 `BrowserWindow`、加载、失败降级到兜底页 | 是 | 无（薄） |
| `preload.ts` | `contextBridge` 暴露最小 API | 是 | 无 |
| `main.ts` | 生命周期编排 + 把上面各模块的决策接到 Electron 事件上 | 是 | 无（薄） |

只有最后三个文件在运行时 `require("electron")`，其余六个都能在纯 Node 环境下被 vitest 直接导入。这不是巧合，是刻意约束：`menu.ts` 用 `import type` 拿 `MenuItemConstructorOptions`（类型导入编译后被擦除，不产生 require），`security.ts` 把 `shell.openExternal` 和 `event.preventDefault` 作为参数注入而不是自己去 import，`updater.ts` 把 `autoUpdater.checkForUpdatesAndNotify` 作为回调接收。electron-updater 的静态导入只出现在 `main.ts` 里。

四个需要说明的点：

**`security.ts` 是最该被测的模块。** 白名单判定要正确处理同 origin、子域、协议差异、端口与大小写差异、以及 `javascript:` / `file:` / `data:` 伪协议。写错一个分支，远端页面就能在 app 内拿到不该有的能力。这类判断靠手工点击验证不可靠。

**`menu.ts` 不是可选项。** 远程加载的页面在 Electron 里默认拿不到 `Cmd+C` / `Cmd+V` / `Cmd+A`，这些快捷键依赖应用菜单中带 `role` 的菜单项存在。没有菜单，复制粘贴静默失效。因此菜单属于最小可用集。

**窗口尺寸位置持久化**用 `app.getPath("userData")` 下的一个 JSON 文件实现，不引入 `electron-store`，与仓库既有的"零额外 dev 依赖"风格一致。单独成文件是因为"解析一个可能已损坏的 JSON 状态文件"本身值得测——状态文件损坏导致启动崩溃是个真实故障模式。

**`log.ts` 存在的唯一理由**是全仓库不用 `console`。`scripts/check-quality.mjs` 已经确立了这个先例（它全程用 `process.stdout.write`），桌面端主进程需要打不少日志，与其每处重复写前缀，不如收进一个三函数的模块。

## 6. 构建与打包

两步，各自单一职责：

```
apps/desktop/scripts/build.mjs     esbuild: src/{main,preload}.ts → dist/{main,preload}.cjs
apps/desktop/electron-builder.yml  打 dist/ + resources/ → release/ 下的安装包
```

`package.json` 的 `main` 指向 `dist/main.cjs`。

### 四个目录的职责必须分清

electron-builder 的默认输出目录也叫 `dist`，会和 esbuild 产物撞在一起——安装包被写进 `dist/` 后，`files: [dist/**]` 又会把安装包递归打进 app。因此显式分开：

| 目录 | 内容 | git |
|---|---|---|
| `dist/` | esbuild 编译产物（`main.cjs` / `preload.cjs`） | 忽略 |
| `release/` | electron-builder 安装包输出（`directories.output`） | 忽略 |
| `build-resources/` | 打包资源（`icon.png`），显式配置为 `directories.buildResources` | **需要提交** |
| `resources/` | 打进 app 的静态文件（`offline.html`） | 需要提交 |

图标目录不能用 electron-builder 的默认名 `build`：根 `.gitignore` 第 8 行的 `build` 规则会忽略任意层级的 `build` 目录（已实测确认），图标提交不进版本库，模板使用者 clone 后打包只会得到 Electron 默认图标。改名成 `build-resources` 比在两层 `.gitignore` 里做反向排除更省事——被父级规则排除的目录，子级 `.gitignore` 想重新纳入还得先反排除目录本身，容易出错且难以察觉。

`apps/desktop/.gitignore` 需要补上 `/release`。

### esbuild 配置要点

`platform: node`、`format: cjs`、`bundle: true`，`target: node20`（保守下限，Electron 43 内置的 Node 版本高于此）。**只把 `electron` 标记为 external，其余依赖（含 `electron-updater`）全部打进产物**。

这是个有意的取舍：pnpm 的 symlink 式 `node_modules` 与 electron-builder 的依赖收集历来不兼容，通常需要给整个 monorepo 加 hoisting 配置才能绕过——为一个包改全仓库的依赖布局，代价不对等。全部 bundle 之后 `files` 只需 `dist/**`、`resources/**`、`package.json`，包体更小，且完全不碰 pnpm 结构。

站点 URL 通过 `define` 在构建时注入默认值。版本号不注入，运行时用 `app.getVersion()` 读打包进去的 `package.json`。

### electron-builder 配置要点

- `appId: com.openstarter.desktop`、`productName: OpenStarter`（README 标注必改）
- `files: [dist/**, resources/**, package.json]`
- `mac`：`dmg` + `zip`，`arm64` + `x64`。**zip 是必需项**——`electron-updater` 在 macOS 上取 zip 而非 dmg，只配 dmg 则无法更新。签名与公证字段留空并加注释。
- `win`：`nsis`，`x64`
- `linux`：`AppImage` + `deb`
- `directories.output: release`、`directories.buildResources: build-resources`（见上表）
- `publish`：`github`，`owner` / `repo` 用占位值；旁边注释掉一段 `generic` provider 配置供自建托管切换
- 图标只放一张 `build-resources/icon.png`（1024×1024），electron-builder 自行派生 icns / ico 与各尺寸

### 脚本分层

```
根        dev:desktop / build:desktop / package:desktop / release:desktop
desktop   dev / dev:electron / build / package / release / check-types / test
```

`package` 与 `release` 用 `pnpm --filter desktop` 直连，不注册为 turbo task——turbo 会去缓存几百 MB 的安装包产物目录，收益为负。

`turbo.json` 不需要改动：全局 `build` 任务的 `outputs` 已含 `dist/**`，`dev:electron` 任务也已存在于当前未提交改动中。

`scripts/run-desktop.mjs` 保留，改为先执行 `pnpm --filter desktop build` 再 spawn Electron，因为入口从手写 `main.cjs` 变成了编译产物。

## 7. 自动更新

行为边界：

- 仅在 `app.isPackaged` 时启用，dev 直接跳过
- publish 配置缺失时打一次 warning 后静默禁用（模板使用者 clone 后第一次跑不应满屏报错）
- 窗口就绪后延迟约 10 秒再检查，不与首屏加载抢带宽
- 用 `checkForUpdatesAndNotify()`：系统通知告知，下次启动生效
- 失败只记日志，不弹框（远程模式下网络本就不稳）

不做应用内横幅。这是远程模式的直接约束：页面来自远端，往里插 UI 就等于改 web 应用，破掉"零 web 侧改动"的前提。

## 8. 配置项

| 变量 | 作用 | 生效时机 |
|---|---|---|
| `OPENSTARTER_DESKTOP_APP_URL` | 生产模式加载的站点 URL | 构建时注入默认值，运行时可覆盖 |
| `OPENSTARTER_DESKTOP_DISABLE_UPDATER` | 显式关闭更新检查 | 运行时 |
| `OPENSTARTER_RENDERER_PORT` | dev 模式 web dev server 端口，默认 3000 | 运行时（已有） |
| `GH_TOKEN` | `electron-builder --publish` 发布用 | 发版时 |

URL 解析规则：必须是 `http:` 或 `https:`；尾斜杠归一化。

解析失败时的行为按模式区分。dev 模式回退到 `http://localhost:3000`。生产模式不回退也不静默——`config.ts` 返回一个明确的失败结果，`main.ts` 照常创建窗口但直接加载兜底页，兜底页显示"站点地址未配置或非法"而不是网络错误文案。静默连到一个错误地址比明确报错更难排查。

注意这里不能用抛异常终止启动：主进程在 `whenReady` 之前抛错会得到一个没有任何窗口的静默失败进程，用户看到的是双击图标后什么都没发生。

## 9. 安全策略与已知限制

策略挂在 `app.on("web-contents-created")` 上，而非只挂主窗口，这样任何新建的 webContents 都被覆盖：

- 导航白名单：只允许站点 origin 内导航，其余 `preventDefault` + `shell.openExternal`
- `setWindowOpenHandler` 全部 deny 并转系统浏览器
- 拒绝 webview 附加（`will-attach-webview`），防止远端页面注入自己的 webview 绕过策略
- `setPermissionRequestHandler` 默认全拒，需要通知或剪贴板时在白名单里显式开
- 子域不放宽（SaaS 通常单域，放宽等于扩大攻击面）

### 已知限制一：OAuth 在桌面端不可用

导航白名单会挡住 OAuth 跳转：用户点"用 Google 登录"，页面要跳到 `accounts.google.com`，白名单把它踢到系统浏览器，登录完成后回调落在浏览器而不是 app 里，流程断掉。即便给 provider 域开白名单也不保险——Google 明确拒绝嵌入式 webview 完成 OAuth，返回 `disallowed_useragent`。

本轮处理：邮箱密码登录在窗口内完全可用（模板默认登录方式）；OAuth 域放进白名单作尽力而为；README 中说明原因与解法。正确解是 OAuth 走系统浏览器 + 自定义协议 deep link 唤回，但需要 web/API 侧签发一次性可交换 token，是独立议题。

### 已知限制二：macOS 未签名无法自动更新

Squirrel.Mac 强制校验签名，配置绕不过。接入 Apple 证书之前，mac 用户只能手动下载新版本。Windows NSIS 与 Linux AppImage 未签名可正常更新，Windows 会有 SmartScreen 警告。

## 10. 测试策略

新增 `apps/desktop/vitest.config.ts`（`defineProject`，`environment: node`，`include: src/**/*.test.ts`，`name: desktop`），并加入根 `vitest.config.ts` 的 `test.projects` 数组——根配置是显式列举而非通配，这一行必须手动添加。

五组用例：

- `config.ts`：URL 缺失、非法协议、尾斜杠归一化、运行时覆盖构建时默认值的优先级、dev 回退与生产返回失败结果的分支差异
- `security.ts`：同 origin 放行；子域拒绝；`http`/`https` 差异；端口与大小写差异；`javascript:` / `file:` / `data:` 伪协议拒绝；三个决策处理器的行为（外链转发、导航拦截、权限拒绝）
- `window-state.ts`：合法状态往返、损坏 JSON 回退到默认值、越界尺寸被夹紧
- `menu.ts`：断言模板中存在 `copy` / `paste` / `selectAll` role。此条为防回归——菜单形似样板代码，最易被后来者当冗余删除，删后复制粘贴静默失效
- `updater.ts`：`shouldCheckForUpdates` 真值表、更新源文件存在性探测、延迟调度在禁用时不排任务

不测 Electron runtime、打包产物、真实更新下载，不引入 `playwright-electron`。

新增文件必须干净通过 `pnpm lint`（ultracite / biome），不写入 `.ultracite-baseline.json`。

### 人工验收清单（写入 README）

1. `pnpm dev:desktop` 起得来，窗口显示 web 首页
2. 窗口内可用邮箱密码登录，进入 `_app` 路由
3. `Cmd+C` / `Cmd+V` / `Cmd+A` 在窗口内生效
4. 点击站外链接在系统浏览器打开，不在窗口内跳转
5. 停掉 web dev server 后重启 app，显示兜底页；恢复后点重试能加载成功
6. `pnpm package:desktop` 在本机产出安装包，安装后能启动并连上配置的站点 URL
7. 关闭再打开，窗口尺寸位置被记住

## 11. 文档变更

- `apps/desktop/README.md`：开发 / 构建 / 打包 / 发版四段流程，加两张清单——「模板使用者必改项」（appId、productName、图标、站点 URL、publish 的 owner+repo、版本号）与「已知限制」（§9 两条），加 §10 的人工验收清单，加后续项列表
- `apps/desktop/.env.example`：与 `apps/web/.env.example` 的既有做法一致
- 根 `README.md`："What's in the box" 表格加一行 Desktop；"Available scripts" 补四个新命令

发版流程写明版本号改 `apps/desktop/package.json`——`electron-builder` 与 `electron-updater` 都从这里读版本做比对，无法跟随根 `package.json`。

顺带记录一个发现（本轮不修）：根 README 链接的 `CUSTOMIZE.md` 实际不存在，是坏链接。因此必改清单放在桌面端自己的 README 里。

## 12. 完整改动清单

```
新增  apps/desktop/electron-builder.yml
新增  apps/desktop/vitest.config.ts
新增  apps/desktop/README.md
新增  apps/desktop/.env.example
新增  apps/desktop/scripts/build.mjs
新增  apps/desktop/resources/offline.html
新增  apps/desktop/build-resources/icon.png
新增  apps/desktop/src/{main,preload,config,security,window,window-state,updater,menu,log}.ts
新增  apps/desktop/src/{config,security,window-state,menu,updater}.test.ts
删除  apps/desktop/src/main.cjs
改动  apps/desktop/package.json      main 指向 dist/、脚本、精确版本依赖
改动  apps/desktop/tsconfig.json     继承 tsconfig.base.json，移除 allowJs/checkJs
改动  apps/desktop/.gitignore        补上 /release
改动  vitest.config.ts               projects 加 apps/desktop
改动  package.json                   加 build:desktop / package:desktop / release:desktop
改动  README.md                      能力表格 + 脚本列表
改动  scripts/run-desktop.mjs        先 build 再 spawn electron
不改  turbo.json                     全局 build 已覆盖 dist/**，dev:electron 已存在
```

## 13. 实现顺序建议

按依赖关系分四层，每层结束时仓库都处于可运行状态：

1. **地基**：`log.ts` + `config.ts` + `security.ts` + `window-state.ts` + `menu.ts`，及各自单测。全部纯逻辑，无 Electron 依赖，可独立验证。`vitest.config.ts` 的新增与注册必须在这一层做，否则本层单测跑不到。
2. **可跑起来**：`preload.ts` + `window.ts` + `main.ts` + `resources/offline.html` + `scripts/build.mjs`，删除 `main.cjs`，改 `tsconfig.json` 与 `run-desktop.mjs`。此层结束时 `pnpm dev:desktop` 应通过验收清单第 1–5 条。
3. **可分发**：`electron-builder.yml` + `build-resources/icon.png` + `.gitignore` 调整 + 打包脚本。此层结束时通过第 6–7 条。
4. **可更新 + 可交接**：`updater.ts` 及其单测、`.env.example`、两个 README。
