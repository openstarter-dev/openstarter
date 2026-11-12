const UNAUTHORIZED_STATUS = 401;

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
      return { status: "unreachable" };
    }
  }

  const errorBody: unknown = await response.json().catch(() => null);
  return mapApiError(response.status, errorBody);
}
