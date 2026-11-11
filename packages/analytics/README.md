# @openstarter/analytics

一份类型契约 + 三个平台实现：`shared` 定义跨端同语义的 `AnalyticsProvider`，`web` / `mobile` / `extension` 各自落地，互不 import 对方。

```
packages/analytics/
├── shared/      @openstarter/analytics            契约类型 + 事件常量 + runtime 工具
├── web/         @openstarter/analytics-web        TanStack Start：脚本注入 + 运行时策略 + 服务端上报
├── mobile/      @openstarter/analytics-mobile     Expo：OpenPanel / Firebase
└── extension/   @openstarter/analytics-extension  WXT：Plausible HTTP
```

每个平台包的结构一致：根目录只留入口（`index` / `facade` 或 `scripts`+`strategy`+`server`）、`internal/`（包内类型与校验）、`providers/<供应商>/`（一个供应商一个目录）。

## 接入

### web（TanStack Start）

三步都已接好，新增供应商时只需改 `providers/` 与注册表。

```ts
// 1) 根路由：SSR 注入采集脚本 + 读配置
import { buildAnalyticsHeadScripts } from "@openstarter/analytics-web/scripts";
import { getAnalyticsConfigFn } from "@openstarter/analytics-web/server";

// 2) 运行时事件（浏览器侧）
import { createAnalyticsStrategy } from "@openstarter/analytics-web";
const analytics = createAnalyticsStrategy(config); // 同配置恒返回同一实例
await analytics.track(ANALYTICS_EVENTS.SIGNUP, { plan: "pro" });

// 3) 服务端事件（支付/订阅，密钥不进客户端产物）
import { createGA4ServerStrategy } from "@openstarter/analytics-web/server-track";
const serverAnalytics = createGA4ServerStrategy({
  measurementId: process.env.GOOGLE_ANALYTICS_MEASUREMENT_ID,
  apiSecret: process.env.GOOGLE_ANALYTICS_SECRET,
});
await serverAnalytics.track(ANALYTICS_EVENTS.PURCHASE, { clientId: userId, value: 99 });
```

### mobile（Expo）

```ts
import { configureAnalyticsErrors, initAnalytics, resolveMobileAnalyticsConfig, track } from "@openstarter/analytics-mobile";

configureAnalyticsErrors({ debug: __DEV__ }); // 可选：接 Sentry 用 onError
await initAnalytics(resolveMobileAnalyticsConfig(process.env));
await track(ANALYTICS_EVENTS.LOGIN);
```

### extension（WXT）

```ts
import { initAnalytics, resolveExtensionAnalyticsConfig, track } from "@openstarter/analytics-extension";

initAnalytics(resolveExtensionAnalyticsConfig(import.meta.env));
await track(ANALYTICS_EVENTS.SIGNUP);
```

## 环境变量

| 平台 | 变量 | 说明 |
|---|---|---|
| web | 后台配置（`google_analytics_id` / `plausible_domain` / `plausible_src`） | 运行时生效，改完最多 30s 生效，无需重新部署 |
| web（服务端） | `GOOGLE_ANALYTICS_SECRET` | GA4 Measurement Protocol 密钥，仅服务端 |
| mobile | `EXPO_PUBLIC_ANALYTICS_GA_ENABLED` | `"true"` 才启用 Firebase |
| mobile | `EXPO_PUBLIC_ANALYTICS_OPENPANEL_CLIENT_ID` / `_SECRET` | 两者都非空才启用 OpenPanel |
| extension | `VITE_ANALYTICS_PLAUSIBLE_DOMAIN` | 不配则整体 noop |
| extension | `VITE_ANALYTICS_PLAUSIBLE_HOST` | 留空回退 `https://plausible.io` |
| extension | `VITE_APP_URL` | 事件归属的站点 URL（扩展页面自身无域名） |

构建期变量随包固化：App 与扩展是静态产物，后台改配置触达不到已安装版本。

## 能力矩阵

| | GA4（web） | Plausible（web/扩展） | OpenPanel（mobile） | Firebase（mobile） |
|---|---|---|---|---|
| track | 是 | 是 | 是 | 是 |
| identify | `user_id` + `user_properties` | 仅低基数画像（plan/role） | profile + 顶层画像字段 | user properties |
| reset | 清 `user_id` + `user_properties` | 清内存画像 | `userId=null` | 清 id + properties |
| setScreenName | `page_view` | `pageview` | `screen_view` | `screen_view` |
| 服务端上报 | 是（`server-track`） | — | — | — |

跨端对齐请按**语义**（`ANALYTICS_EVENTS`）而不是字符串：GA4 用 `page_view`、Plausible 用 `pageview`、Firebase/OpenPanel 用 `screen_view`，这是各供应商的原生规范名，不可强行统一。

## 错误可观测

所有实现都不向业务层抛错。默认静默，需要排查时：

```ts
configureAnalyticsErrors({ debug: true });            // console.warn
configureAnalyticsErrors({ onError: reportToSentry }); // 接监控
```

`onError` 收到 `(error, { provider, method })`，即使 `debug` 关闭也会被调用。

## 新增供应商

web：新建 `providers/<name>/{scripts,strategy,index}.ts`，在 `providers/index.ts` 的数组里加一行。
mobile：新建 `providers/<name>/index.ts`，在 `facade.ts` 的 `initAnalytics` 里加一个配置分支。
extension：新建 `providers/<name>/index.ts`，在 `providers/index.ts` 的数组里加一行（第二个供应商出现时需要引入 composite 转发）。

实现必须 `satisfies AnalyticsProvider`：错误在 provider 内部消化、`init` 幂等（可选）、`reset` 清身份。

## 约束守护

- `web/src/no-sdk.test.ts`：断言 web 端源码不 import 任何分析 SDK（采集脚本由 CDN 运行时加载，SDK 进包会破坏零依赖优势）。
- `shared/src/runtime/runtime.test.ts`：属性裁剪、错误出口、noop/composite 的行为基线。
- 各 provider 目录内 `index.test.ts`：请求形状、降级路径、错误吞噬。

```bash
pnpm --filter @openstarter/analytics test
pnpm --filter @openstarter/analytics-web test
pnpm --filter @openstarter/analytics-mobile test
pnpm --filter @openstarter/analytics-extension test
```
