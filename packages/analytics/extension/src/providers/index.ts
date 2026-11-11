// 扩展端供应商注册表 —— 目录约定：一个供应商一个目录
//    providers/<name>/index.ts        供应商实现（策略 + 配置判定 + 上报）
//    providers/<name>/index.test.ts   该供应商的单元测试
//
// 新增供应商只需新建目录并登记到下面的数组。
//
// 当前仅 Plausible：MV3 禁远程脚本，脚本型供应商（gtag 等）不可用；带 API secret 的
// 服务端协议（如 GA4 Measurement Protocol）也不适合打进商店分发的产物。
// 若将来出现第二个可用供应商，facade 需要引入 composite 转发（对齐 web/mobile 的实现）。

import { plausibleDefinition } from "./plausible";

export { createNoopProvider } from "./noop";
export { createPlausibleProvider } from "./plausible";

export const EXTENSION_ANALYTICS_PROVIDERS = [plausibleDefinition] as const;
