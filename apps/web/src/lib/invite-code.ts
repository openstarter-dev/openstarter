const INVITE_CODE_COOKIE = "openstarter_invite_code";
const INVITE_CODE_MAX_AGE_SECONDS = 600;

/**
 * Remember a signup invite code for flows that leave the page (OAuth redirect,
 * magic link, OTP email). The auth server reads this cookie when creating a user.
 */
export function rememberInviteCode(code: string): void {
  if (typeof document === "undefined") {
    return;
  }
  const value = code.trim();
  if (!value) {
    return;
  }
  document.cookie = `${INVITE_CODE_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${INVITE_CODE_MAX_AGE_SECONDS}; SameSite=Lax`;
}
