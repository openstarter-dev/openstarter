// apps/desktop/src/security.ts —— 导航白名单纯判定 + 安全策略处理器工厂。
//
// 远程加载模式下渲染进程执行的是远端代码，这里是防止远端页面在 app 内获得不该有能力的
// 最后一道边界。判定只依赖 URL.origin 的相等性：origin 天然编码了 protocol/host/port，
// 天然处理大小写；子域因 origin 不同而天然被拒绝；伪协议（javascript:/file:/data:）的
// origin 恒为字符串 "null"，天然不等于任何合法 allowedOrigin。
// 详见 docs/superpowers/specs/2026-08-01-desktop-app-design.md §9。

/** 判断 targetUrl 是否与 allowedOrigin 同源。解析失败（畸形字符串）返回 false，不抛异常。 */
export function isAllowedNavigation(
  targetUrl: string,
  allowedOrigin: string
): boolean {
  try {
    return new URL(targetUrl).origin === new URL(allowedOrigin).origin;
  } catch {
    return false;
  }
}

export type ExternalOpener = (url: string) => void;

interface WindowOpenHandlerDetails {
  url: string;
}

interface WindowOpenHandlerResult {
  action: "allow" | "deny";
}

/**
 * 生成 setWindowOpenHandler 的处理器：任何新窗口请求（含站内的 target=_blank 链接和
 * OAuth 跳转）一律拒绝原生窗口创建，转交系统浏览器打开。不接收 allowedOrigin——
 * window.open() 触发的新窗口请求无论站内站外都统一转发，不需要按 origin 分流
 * （站内 target=_blank 链接本就该在系统浏览器里打开，不必留在 app 窗口内）。
 */
export function createWindowOpenHandler(
  openExternal: ExternalOpener
): (details: WindowOpenHandlerDetails) => WindowOpenHandlerResult {
  return (details) => {
    openExternal(details.url);
    return { action: "deny" };
  };
}

interface WillNavigateEvent {
  preventDefault: () => void;
}

/**
 * 生成 will-navigate 的处理器：站内导航放行，站外导航阻止并转系统浏览器。
 * allowedOrigin 参数目前未在函数体内直接使用比较（isAllowedNavigation 内联判断），
 * 保留显式参数是为了让调用方在构造时就能看清这个处理器绑定的是哪个 origin。
 */
export function createWillNavigateHandler(
  allowedOrigin: string,
  openExternal: ExternalOpener
): (event: WillNavigateEvent, url: string) => void {
  return (event, url) => {
    if (isAllowedNavigation(url, allowedOrigin)) {
      return;
    }
    event.preventDefault();
    openExternal(url);
  };
}

export type PermissionCallback = (granted: boolean) => void;

/** 生成 setPermissionRequestHandler 的处理器：默认拒绝一切权限请求。 */
export function createPermissionRequestHandler(): (
  webContents: unknown,
  permission: string,
  callback: PermissionCallback
) => void {
  return (_webContents, _permission, callback) => {
    callback(false);
  };
}
