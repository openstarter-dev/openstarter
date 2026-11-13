type ApiResponseBody = { data?: unknown; message?: string };

export type ApiErrorCode = string | number;

/** 从错误对象上读取业务错误码（我们的响应信封是 `{ code, message, data }`）。 */
export function getApiErrorCode(error: unknown): ApiErrorCode | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string" || typeof code === "number") {
      return code;
    }
  }
  return undefined;
}

async function readBody(res: { json: () => Promise<unknown> }): Promise<ApiResponseBody | null> {
  return (await res.json().catch(() => null)) as ApiResponseBody | null;
}

export async function unwrapMutation<TData>(
  res: { json: () => Promise<unknown>; ok: boolean },
  fallbackMessage: string,
): Promise<TData> {
  const json = (await readBody(res)) as { data?: TData; message?: string } | null;
  if (!res.ok) {
    throw new Error(json?.message || fallbackMessage);
  }
  if (json?.data === undefined || json?.data === null) {
    throw new Error(fallbackMessage);
  }
  return json.data;
}

export async function assertOk(
  res: { json: () => Promise<unknown>; ok: boolean },
  fallbackMessage: string,
): Promise<void> {
  if (res.ok) {
    return;
  }
  const json = await readBody(res);
  throw new Error(json?.message || fallbackMessage);
}

export async function unwrapQuery<TData>(
  res: { json: () => Promise<unknown>; ok: boolean },
  fallbackMessage: string,
): Promise<TData | undefined> {
  const json = await readBody(res);
  if (!res.ok) {
    throw new Error(json?.message || fallbackMessage);
  }
  return json?.data as TData | undefined;
}
