// apps/mobile/src/lib/auth-gate.ts —— 会话状态 → 应该停在哪个路由组。
//
// 唯一容易写错、也最要紧的一条：pending 必须映射到 "loading"，绝不能落到
// "unauthenticated"。否则已登录用户每次冷启动都会闪一帧登录页，
// 且 (tabs) 会在 SecureStore 读完之前把人重定向走（见 spec §4 会话门禁）。

export type AuthGate = "loading" | "authenticated" | "unauthenticated";

export function deriveAuthGate(input: {
  session: { user?: { id: string } | undefined } | null | undefined;
  isPending: boolean;
}): AuthGate {
  if (input.isPending) {
    return "loading";
  }
  return input.session?.user ? "authenticated" : "unauthenticated";
}
