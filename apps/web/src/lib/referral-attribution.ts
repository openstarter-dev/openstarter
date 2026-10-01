// ?ref= 归因捕获：localStorage 暂存（30 天 TTL），注册成功后一次性 bind。
const STORAGE_KEY = "ref:code";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredReferral {
  at: number;
  code: string;
}

function safeLocalStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

/** URL ?ref=xxx → localStorage（幂等，重复捕获覆盖刷新时间戳）。 */
export function captureReferralAttribution(code: string): void {
  const store = safeLocalStorage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), code } satisfies StoredReferral));
  } catch {
    // localStorage 满/被禁：静默（归因是旁路）
  }
}

/** 读有效归因码；过期/损坏/null 环境一律 null。 */
export function readStoredReferralCode(): string | null {
  const store = safeLocalStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredReferral;
    if (typeof parsed.code !== "string" || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > TTL_MS) return null;
    return parsed.code;
  } catch {
    return null;
  }
}

/** bind 成功或明确放弃后清除。 */
export function clearReferralAttribution(): void {
  safeLocalStorage()?.removeItem(STORAGE_KEY);
}

/** 注册成功后调用：有归因码则 POST /api/referral/bind（失败静默），成功后清除。 */
export async function bindReferralAfterSignup(): Promise<void> {
  const code = readStoredReferralCode();
  if (!code) return;
  try {
    const res = await fetch("/api/referral/bind", {
      body: JSON.stringify({ code }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (res.ok) clearReferralAttribution();
    // 409 ALREADY_REFERRED 等也清除，避免反复重试
    else if (res.status === 409 || res.status === 422) clearReferralAttribution();
  } catch {
    // 网络失败保留归因，下次登录页可重试
  }
}
