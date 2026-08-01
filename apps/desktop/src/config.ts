// apps/desktop/src/config.ts —— 站点 URL 与更新配置解析（纯函数，无 Electron 依赖）。
//
// 运行模式判断依据 app.isPackaged，不用 NODE_ENV（打包后的 app 里环境变量不可控，见
// docs/superpowers/specs/2026-08-01-desktop-app-design.md §4）。
//
// URL 解析失败时返回带原因的失败结果而不抛异常：主进程在 whenReady 之前抛错会得到一个
// 没有任何窗口的静默失败进程，用户双击图标后什么都不会发生（见 spec §8）。

export type DesktopMode = "dev" | "prod";

export type ResolvedUrl =
  | { ok: true; url: string }
  | { ok: false; reason: string };

const DEV_FALLBACK_URL = "http://localhost:3000";

/** 依据 app.isPackaged 判断运行模式。 */
export function getDesktopMode(isPackaged: boolean): DesktopMode {
  return isPackaged ? "prod" : "dev";
}

/** 校验并归一化一个候选 URL：必须是 http/https，返回值经 URL.toString() 归一化。 */
function normalizeUrl(candidate: string): string | null {
  if (!candidate) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  return parsed.toString();
}

interface ResolveAppUrlParams {
  buildTimeUrl: string;
  env: Record<string, string | undefined>;
  isPackaged: boolean;
}

/**
 * 解析生产模式加载的站点 URL。
 * 优先级：运行时环境变量覆盖 > 构建时注入的默认值。
 * dev 模式下两者都解析失败时回退到 localhost:3000；prod 模式下返回失败结果。
 */
export function resolveAppUrl(params: ResolveAppUrlParams): ResolvedUrl {
  const { buildTimeUrl, env, isPackaged } = params;
  const mode = getDesktopMode(isPackaged);

  const runtimeOverride = normalizeUrl(env.OPENSTARTER_DESKTOP_APP_URL ?? "");
  if (runtimeOverride) {
    return { ok: true, url: runtimeOverride };
  }

  const fromBuildTime = normalizeUrl(buildTimeUrl);
  if (fromBuildTime) {
    return { ok: true, url: fromBuildTime };
  }

  if (mode === "dev") {
    return { ok: true, url: `${DEV_FALLBACK_URL}/` };
  }

  return {
    ok: false,
    reason:
      "No valid app URL configured. Set OPENSTARTER_DESKTOP_APP_URL or rebuild with a valid default URL.",
  };
}

/** 是否显式关闭自动更新检查（OPENSTARTER_DESKTOP_DISABLE_UPDATER=true）。 */
export function isUpdaterDisabled(
  env: Record<string, string | undefined>
): boolean {
  return env.OPENSTARTER_DESKTOP_DISABLE_UPDATER === "true";
}
