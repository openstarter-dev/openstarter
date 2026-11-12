/** 设备授权端点基址（Better-Auth deviceAuthorization 插件挂载点）。 */
const DEVICE_ENDPOINT_BASE = "/api/auth/device";

/** 服务端返回的业务错误文案（Better-Auth 的 error_description 优先）。 */
async function serverErrorMessage(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as {
      error_description?: string;
      message?: string;
    };
    return body.error_description ?? body.message;
  } catch {
    return undefined;
  }
}

/** 设备授权流程错误；detail 为服务端给定的业务文案，可能为空。 */
export class DeviceFlowError extends Error {
  readonly detail: string | undefined;

  constructor(detail?: string) {
    super(detail ?? "device authorization failed");
    this.name = "DeviceFlowError";
    this.detail = detail;
  }
}

async function assertOk(res: Response): Promise<void> {
  if (res.ok) {
    return;
  }
  throw new DeviceFlowError(await serverErrorMessage(res));
}

/** 把当前登录会话 claim 到该设备码（GET /api/auth/device）。 */
export async function claimDevice(userCode: string): Promise<void> {
  const res = await fetch(`${DEVICE_ENDPOINT_BASE}?user_code=${encodeURIComponent(userCode)}`, {
    method: "GET",
  });
  await assertOk(res);
}

/** 批准该设备码登录（POST /api/auth/device/approve，靠会话 cookie 鉴权）。 */
export async function approveDevice(userCode: string): Promise<void> {
  const res = await fetch(`${DEVICE_ENDPOINT_BASE}/approve`, {
    body: JSON.stringify({ userCode }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  await assertOk(res);
}

/** 拒绝该设备码登录（POST /api/auth/device/deny）。 */
export async function denyDevice(userCode: string): Promise<void> {
  const res = await fetch(`${DEVICE_ENDPOINT_BASE}/deny`, {
    body: JSON.stringify({ userCode }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  await assertOk(res);
}
