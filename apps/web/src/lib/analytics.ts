// 分析脚本条件注入（R25.1、R25.2）。
//
// 依据 Config 的分析供应商标识，构造经 TanStack Router `head().scripts` 注入的采集脚本描述。
// 安全（XSS）约束：
//   - **受控白名单**：注入脚本只能来自固定的供应商 → 脚本模板映射（此处支持 Google Analytics 与
//     Plausible，与参照实现的分析集合一致）；未知/未配置供应商一律不注入。
//   - **度量 ID 校验**：内联脚本中被插值的度量 ID 仅允许预期字符集（`[A-Za-z0-9_-]`），
//     Plausible 域名仅允许 `[A-Za-z0-9.,_-]`；任一不合规即跳过该供应商，绝不将任意 Config
//     字符串原样作为可执行脚本注入（杜绝断开引号/标签的注入）。
//   - **脚本 URL 约束**：Plausible 自托管脚本 URL 必须为合法 https 绝对 URL，否则回退官方默认。
//   - 经框架的 `head().scripts` 机制注入（由 Router 统一管理 `<script>` 标签），而非在组件内
//     直接使用危险的 innerHTML。
//
// 本模块为**纯函数**（无副作用、无 I/O），输入为已从 Config 读取的分析配置，输出为脚本描述数组。

/** 从 Config 读取的分析供应商配置（空字符串表示未配置对应供应商）。 */
export type AnalyticsConfig = {
  googleAnalyticsId: string;
  plausibleDomain: string;
  plausibleSrc: string;
};

/**
 * TanStack Router `head().scripts` 的单项描述（扁平形态）：
 * `src` → 外部脚本；`children` → 内联脚本内容；其余字段作为 `<script>` 属性透传。
 */
export type HeadScript = {
  id?: string;
  src?: string;
  children?: string;
  async?: boolean;
  defer?: boolean;
  "data-domain"?: string;
};

// 度量 ID 允许字符集：字母/数字/连字符/下划线（覆盖 GA 的 `G-XXXX`/`UA-XXXX-Y`/`AW-XXX` 等）。
// 严格白名单确保插值进内联脚本时无法断开引号或注入 `</script>`。
const MEASUREMENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_MEASUREMENT_ID_LENGTH = 64;

// Plausible 域名允许字符集：字母/数字/点/连字符/下划线，多域以逗号分隔。
const PLAUSIBLE_DOMAIN_PATTERN = /^[A-Za-z0-9.,_-]+$/;
const MAX_DOMAIN_LENGTH = 253;

// Plausible 官方云端默认脚本地址（未配置或自托管地址不合规时回退）。
const DEFAULT_PLAUSIBLE_SRC = "https://plausible.io/js/script.js";

/** 校验度量 ID：非空、长度受限、且仅含允许字符集。 */
function isValidMeasurementId(id: string): boolean {
  return (
    id.length > 0 &&
    id.length <= MAX_MEASUREMENT_ID_LENGTH &&
    MEASUREMENT_ID_PATTERN.test(id)
  );
}

/** 校验 Plausible 域名：非空、长度受限、且仅含允许字符集。 */
function isValidPlausibleDomain(domain: string): boolean {
  return (
    domain.length > 0 &&
    domain.length <= MAX_DOMAIN_LENGTH &&
    PLAUSIBLE_DOMAIN_PATTERN.test(domain)
  );
}

/** 归一 Plausible 脚本 URL：仅接受合法 https 绝对 URL，否则回退官方默认。 */
function resolvePlausibleSrc(src: string): string {
  if (src === "") {
    return DEFAULT_PLAUSIBLE_SRC;
  }
  try {
    const url = new URL(src);
    if (url.protocol === "https:") {
      return url.href;
    }
  } catch {
    return DEFAULT_PLAUSIBLE_SRC;
  }
  return DEFAULT_PLAUSIBLE_SRC;
}

/** Google Analytics（gtag.js）脚本模板：加载器 + 初始化（度量 ID 已校验，安全插值）。 */
function googleAnalyticsScripts(measurementId: string): HeadScript[] {
  return [
    {
      id: "ga-loader",
      src: `https://www.googletagmanager.com/gtag/js?id=${measurementId}`,
      async: true,
    },
    {
      id: "ga-init",
      children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${measurementId}');`,
    },
  ];
}

/** Plausible 脚本模板：初始化桩（静态、无插值）+ 加载器（域名/URL 已校验，作为属性透传）。 */
function plausibleScripts(domain: string, src: string): HeadScript[] {
  return [
    {
      id: "plausible-init",
      children:
        "window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)};",
    },
    {
      id: "plausible-loader",
      "data-domain": domain,
      src,
      defer: true,
      async: true,
    },
  ];
}

/**
 * 依据分析配置构造要注入的脚本描述数组（R25.1、R25.2）：
 *   - 配置了某供应商（且标识合规）→ 注入且仅注入该供应商对应的脚本；
 *   - 未配置任何供应商（或标识不合规）→ 返回空数组，即不注入任何分析脚本。
 */
export function buildAnalyticsHeadScripts(
  config: AnalyticsConfig | undefined
): HeadScript[] {
  if (!config) {
    return [];
  }

  const scripts: HeadScript[] = [];

  if (isValidMeasurementId(config.googleAnalyticsId)) {
    scripts.push(...googleAnalyticsScripts(config.googleAnalyticsId));
  }

  if (isValidPlausibleDomain(config.plausibleDomain)) {
    scripts.push(
      ...plausibleScripts(
        config.plausibleDomain,
        resolvePlausibleSrc(config.plausibleSrc)
      )
    );
  }

  return scripts;
}
