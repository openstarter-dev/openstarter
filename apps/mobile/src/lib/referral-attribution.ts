import { getItem, setItem, deleteItemAsync } from "expo-secure-store";

import { apiClient } from "@/lib/api";

const STORAGE_KEY = "openstarter_referral_code";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredReferral {
  at: number;
  code: string;
}

/** URL ?ref=xxx → SecureStore（幂等，重复捕获覆盖刷新时间戳）。 */
export function captureReferralAttribution(code: string): void {
  try {
    setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), code } satisfies StoredReferral));
  } catch {
  }
}

/** 读有效归因码；过期/损坏/null 环境一律 null。 */
export function readStoredReferralCode(): string | null {
  try {
    const raw = getItem(STORAGE_KEY);
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
export async function clearReferralAttribution(): Promise<void> {
  try {
    await deleteItemAsync(STORAGE_KEY);
  } catch {
  }
}

/** 注册成功后调用：有归因码则 POST /api/referral/bind（失败静默），成功后清除。 */
export async function bindReferralAfterSignup(): Promise<void> {
  const code = readStoredReferralCode();
  if (!code) return;
  try {
    const res = await apiClient.api.referral.bind.$post({
      json: { code },
    });
    if (res.ok || res.status === 409 || res.status === 422) {
      await clearReferralAttribution();
    }
  } catch {
  }
}
