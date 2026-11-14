import { BrowserWindow } from "electron";

export interface OAuthResult {
  user: { id: string; email: string; name?: string };
}

export interface OAuthWindowOptions {
  baseUrl: string;
  getSession: () => Promise<{ user: { id: string; email: string; name?: string } } | null>;
  tokenStore: { get(): string | null; set(token: string): void; clear(): void };
}

/**
 * 构造 OAuth 授权 URL。
 * 纯函数，无副作用，适合单元测试。
 */
export function buildOAuthUrl(
  baseUrl: string,
  provider: "google" | "github",
  callbackUrl: string,
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

const SESSION_COOKIE_NAMES = new Set([
  "openstarter.session_token",
  "__Secure-openstarter.session_token",
]);

export function extractTokenFromCookies(cookies: ElectronCookie[]): string | null {
  const sessionCookie = cookies.find((c) => SESSION_COOKIE_NAMES.has(c.name));
  return sessionCookie?.value ?? null;
}

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
  options: OAuthWindowOptions,
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

    // Guard against closed event rejecting while async callback resolution is in flight
    // 防止回调处理期间窗口关闭事件触发导致 Promise 被提前 reject
    let settled = false;

    const handleNavigation = async (event: { preventDefault: () => void }, url: string) => {
      if (!url.startsWith(callbackUrl) || settled) {
        return;
      }

      settled = true;
      event.preventDefault();
      win.hide();

      try {
        const cookies = await win.webContents.session.cookies.get({});
        const token = extractTokenFromCookies(cookies);
        if (token) {
          tokenStore.set(token);
        }

        const session = await getSession();
        if (session?.user) {
          resolve({ user: session.user });
        } else {
          reject(new Error("Failed to get session after OAuth"));
        }
      } catch (err) {
        reject(err);
      } finally {
        if (!win.isDestroyed()) {
          win.close();
        }
      }
    };

    win.webContents.on("will-navigate", (event, url) => {
      void handleNavigation(event, url);
    });

    win.webContents.on("will-redirect", (event, url) => {
      void handleNavigation(event, url);
    });

    win.on("closed", () => {
      if (!settled) {
        settled = true;
        reject(new Error("OAuth window closed by user"));
      }
    });

    win.loadURL(oauthUrl);
  });
}
