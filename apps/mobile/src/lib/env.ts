// apps/mobile/src/lib/env.ts —— 校验 EXPO_PUBLIC_API_URL。
// Expo 只把 EXPO_PUBLIC_ 前缀的变量注入客户端 bundle（构建期内联 process.env 访问），
// 因此这里读 process.env 在设备与 Node 测试下都成立。
//
// 配置缺失/非法必须是一个独立的错误态，而不是退化成"网络错误" —— 否则 fork 该模板的人
// 拿到的只是一个连不上的应用，无从判断是自己没配还是后端挂了（见 spec §5.1 / §7 第 4 条）。
//
// 不用 zod 的 z.url()：它走的是宽松的 WHATWG URL 解析，会把 "localhost:3000" 这类
// 非绝对 http(s) 字符串判为合法（解析出 protocol:"localhost"），而 hc(baseUrl) 拿到这种
// 值会拼出无效请求。这里显式要求 http/https 协议的绝对 URL，与 apps/desktop/config.ts
// 的判定同语义（见 docs/superpowers/plans/2026-08-01-mobile-app.md Task 5）。

export type EnvResult = { ok: true; apiUrl: string } | { ok: false; reason: string };

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function resolveApiUrl(raw: string | undefined): EnvResult {
  if (!raw) {
    return { ok: false, reason: "EXPO_PUBLIC_API_URL is not set" };
  }

  if (!isValidHttpUrl(raw)) {
    return {
      ok: false,
      reason: `EXPO_PUBLIC_API_URL is not a valid absolute URL: ${raw}`,
    };
  }

  // 去掉末尾斜杠：hc(baseUrl) 拼接路径时会自行加 "/"，
  // 留着会产出 "https://host//api/..." 这种双斜杠 URL。
  return { apiUrl: raw.replace(/\/$/u, ""), ok: true };
}

export function getEnv(): EnvResult {
  return resolveApiUrl(process.env.EXPO_PUBLIC_API_URL);
}
