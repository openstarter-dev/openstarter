// apps/desktop/src/main/oauth-window.ts —— OAuth 登录窗口
//
// 纯函数（可测试）：
//   buildOAuthUrl —— 构造 OAuth 授权 URL
//   extractTokenFromCookies —— 从 Cookie 数组提取 session token
//
// 窗口编排（测试覆盖在集成测试层）：
//   openOAuthWindow —— 创建 BrowserWindow 完成 OAuth 流程

import { BrowserWindow } from "electron";

export interface OAuthResult {
  user: { id: string; email: string; name?: string };
}

export interface OAuthWindowOptions {
  baseUrl: string;
  getSession: () => Promise<{ user: { id: string; email: string; name?: string } } | null>;
  tokenStore: { get(): string | null; set(token: string): void; clear(): void };
}

// ─── 纯函数 ────────────────────────────────────────────────────

/**
 * 构造 OAuth 授权 URL。
 * 纯函数，无副作用，适合单元测试。
 */
export function buildOAuthUrl(
  baseUrl: string,
  provider: "google" | "github",
  callbackUrl: string
): string {
  const url = new URL(`${baseUrl}/api/auth/sign-in/social`);
  url.searchParams.set("provider", provider);
  url.searchParams.set("callbackURL", callbackUrl);
  url.searchParams.set("errorCallbackURL", callbackUrl);
  return url.toString();
}

/**
 * 从 Electron Cookie 数组提取 openstarter.session_token。
 * 纯函数，无副作用，适合单元测试。
 */
export interface ElectronCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

export function extractTokenFromCookies(
  cookies: ElectronCookie[]
): string | null {
  const sessionCookie = cookies.find(
    (c) => c.name === "openstarter.session_token"
  );
  return sessionCookie?.value ?? null;
}

// ─── 窗口编排 ──────────────────────────────────────────────────

/**
 * 打开 OAuth 登录窗口并等待用户完成授权。
 *
 * 流程：
 * 1. 创建 BrowserWindow（600x700，无工具栏）
 * 2. 加载 OAuth 授权 URL
 * 3. 监听窗口导航，检测到 callback URL 后关闭窗口
 * 4. 从窗口 session 的 cookies 提取 session token
 * 5. 调用 getSession() 获取用户信息
 * 6. 返回用户信息
 */
export async function openOAuthWindow(
  provider: "google" | "github",
  options: OAuthWindowOptions
): Promise<OAuthResult> {
  const { baseUrl, getSession, tokenStore } = options;
  const callbackUrl = "openstarter://oauth-callback";
  const oauthUrl = buildOAuthUrl(baseUrl, provider, callbackUrl);

  return new Promise<OAuthResult>((resolve, reject) => {
    const win = new BrowserWindow({
      width: 600,
      height: 700,
      autoHideMenuBar: true,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // 拦截导航到 callback URL
    const handleNavigation = async (
      event: { preventDefault: () => void },
      url: string
    ) => {
      if (url.startsWith(callbackUrl)) {
        event.preventDefault();
        win.close();

        try {
          // 从 session 读取 cookie
          const cookies = await win.webContents.session.cookies.get({
            name: "openstarter.session_token",
          });
          const token = extractTokenFromCookies(cookies);
          if (token) {
            tokenStore.set(token);
          }

          // 获取用户信息
          const session = await getSession();
          if (session?.user) {
            resolve({ user: session.user });
          } else {
            reject(new Error("Failed to get session after OAuth"));
          }
        } catch (err) {
          reject(err);
        }
      }
    };

    win.webContents.on("will-navigate", (event, url) => {
      handleNavigation(event, url);
    });

    win.webContents.on("will-redirect", (event, url) => {
      handleNavigation(event, url);
    });

    // 窗口被用户关闭（取消授权）
    win.on("closed", () => {
      reject(new Error("OAuth window closed by user"));
    });

    win.loadURL(oauthUrl);
  });
}