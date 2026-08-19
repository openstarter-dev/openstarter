// apps/mobile/src/lib/api-error.ts —— 把 HTTP / 网络结果归一成判别联合。
//
// 关键约定（与 apps/extension 的状态机同语义，见 spec §7）：
//   1. 后端错误体统一为 { code: -1, message }（packages/api 的 app.onError）；
//   2. 401 归入 "unauthorized" 而不是 "server-error" —— token 过期、会话被吊销、
//      服务端不认，对用户而言都是"没登录"，应引导登录而非弹报错；
//   3. fetch 本身 reject（后端未启动、IP 填错）归 "unreachable"；
//   4. 文案在 UI 层决定：本模块只给判别式，"unreachable" 的措辞由界面本地化。
//
// 本模块刻意不 import lib/api.ts —— 那会拉进 auth-client 与 expo-secure-store，
// 使这里无法在 Node 环境下测试。

const UNAUTHORIZED_STATUS = 401;

// runRequest 只用到响应的 ok / status / json() 三者；把入参收窄成这个结构化接口，
// 既兼容 DOM Response（测试里直接 new Response(...)），也兼容 Hono 客户端的
// ClientResponse —— 后者的 .formData() 返回 Hono 自己的 FormData，与全局 Response
// 不能互相赋值，若要求完整 Response 会反过来卡住调用方。
export interface HttpResponse {
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
}

export type ApiFailure =
  | { status: "unauthorized" }
  | { status: "unreachable" }
  | { status: "server-error"; message: string };

export type ApiResult<TData> = { status: "success"; data: TData } | ApiFailure;

export function extractMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  if (!("message" in body)) {
    return null;
  }
  const { message } = body as { message: unknown };
  return typeof message === "string" && message.length > 0 ? message : null;
}

export function mapApiError(httpStatus: number, body: unknown): ApiFailure {
  if (httpStatus === UNAUTHORIZED_STATUS) {
    return { status: "unauthorized" };
  }
  return {
    message: extractMessage(body) ?? `Request failed (${httpStatus})`,
    status: "server-error",
  };
}

export async function runRequest<TData>(
  send: () => Promise<HttpResponse>,
  extract: (body: unknown) => TData,
): Promise<ApiResult<TData>> {
  let response: HttpResponse;
  try {
    response = await send();
  } catch {
    return { status: "unreachable" };
  }

  if (response.ok) {
    try {
      const body: unknown = await response.json();
      return { data: extract(body), status: "success" };
    } catch {
      // 2xx 但响应体不是预期 JSON：代理返回了 HTML、或 base URL 指向了别的服务。
      // 对用户而言等同于"连不上正确的服务"。
      return { status: "unreachable" };
    }
  }

  const errorBody: unknown = await response.json().catch(() => null);
  return mapApiError(response.status, errorBody);
}
