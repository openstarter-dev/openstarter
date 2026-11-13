const DEVICE_ENDPOINT_BASE = "/api/auth/device";

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

export async function claimDevice(userCode: string): Promise<void> {
  const res = await fetch(`${DEVICE_ENDPOINT_BASE}?user_code=${encodeURIComponent(userCode)}`, {
    method: "GET",
  });
  await assertOk(res);
}

export async function approveDevice(userCode: string): Promise<void> {
  const res = await fetch(`${DEVICE_ENDPOINT_BASE}/approve`, {
    body: JSON.stringify({ userCode }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  await assertOk(res);
}

export async function denyDevice(userCode: string): Promise<void> {
  const res = await fetch(`${DEVICE_ENDPOINT_BASE}/deny`, {
    body: JSON.stringify({ userCode }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  await assertOk(res);
}
