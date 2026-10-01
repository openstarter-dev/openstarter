// RevenueCat webhook 路由集成测试：fail-closed 门禁（开关/secret/验签）→ 放行编排。
//
// mock @openstarter/billing-web/payment 保留 mapRevenueCatEvent 真实现并以 spy 接管，
// 验证路由层只负责「门禁 + 读原始字节 + 委托编排」，不复制任何业务逻辑。

import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// mock requireAuth：绕开 @openstarter/auth 的 import 期 env 校验（BETTER_AUTH_SECRET
// 等与本套件无关；同 checkout.test.ts 的做法）。
vi.mock("../../middleware/auth", () => ({
  requireAuth: (_c: unknown, next: () => Promise<void>) => next(),
}));

// mock 配置读取：默认未启用 / 无 secret，各用例按需覆写。
const configsState = vi.hoisted(() => ({
  map: {} as Record<string, string>,
}));
vi.mock("@openstarter/shared/config", async () => {
  const actual = await vi.importActual<typeof import("@openstarter/shared/config")>(
    "@openstarter/shared/config",
  );
  return {
    ...actual,
    getAllConfigs: () => Promise.resolve(configsState.map),
  };
});

// mock 编排模块：mapRevenueCatEvent 以 spy 接管（避免真实 db 依赖），
// 其余导出（configureRevenueCatProducts / SIGNATURE_HEADER / verifyRevenueCatWebhook）保持真实现。
const mapRevenueCatEventMock = vi.hoisted(() => vi.fn());
vi.mock("@openstarter/billing-web/payment/revenuecat", async () => {
  const actual = await vi.importActual<
    typeof import("@openstarter/billing-web/payment/revenuecat")
  >("@openstarter/billing-web/payment/revenuecat");
  return {
    ...actual,
    mapRevenueCatEvent: (...args: unknown[]) => mapRevenueCatEventMock(...args),
  };
});

import { billingRouter } from "./router";

const SECRET = "whsec_route_test";

/** 以测试 secret 生成合法签名头。 */
function signBody(t: number, rawBody: string): string {
  const v1 = createHmac("sha256", SECRET).update(`${t}.${rawBody}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

const RAW_BODY = JSON.stringify({
  event: { type: "TEST", app_user_id: "user-1" },
});

/** 构造指向 RC webhook 路由的请求。 */
function postWebhook(headers: Record<string, string>, body: string) {
  return billingRouter.request("/payment/webhook/revenuecat", {
    body,
    headers,
    method: "POST",
  });
}

function enabledHeaders() {
  return {
    "content-type": "application/json",
    "x-revenuecat-webhook-signature": signBody(Math.floor(Date.now() / 1000), RAW_BODY),
  };
}

beforeEach(() => {
  configsState.map = {};
  mapRevenueCatEventMock.mockReset();
});

describe("POST /payment/webhook/revenuecat", () => {
  it("returns 401 when revenuecat_enabled is not true (fail-closed)", async () => {
    const response = await postWebhook(enabledHeaders(), RAW_BODY);

    expect(response.status).toBe(401);
    expect(mapRevenueCatEventMock).not.toHaveBeenCalled();
  });

  it("returns 401 when webhook secret is missing even if enabled", async () => {
    configsState.map = { revenuecat_enabled: "true" };
    const response = await postWebhook(enabledHeaders(), RAW_BODY);

    expect(response.status).toBe(401);
    expect(mapRevenueCatEventMock).not.toHaveBeenCalled();
  });

  it("returns 401 on an invalid signature", async () => {
    configsState.map = {
      revenuecat_enabled: "true",
      revenuecat_webhook_secret: SECRET,
    };
    const response = await postWebhook(
      { "x-revenuecat-webhook-signature": "t=1,v1=deadbeef" },
      RAW_BODY,
    );

    expect(response.status).toBe(401);
    expect(mapRevenueCatEventMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the signature header is absent", async () => {
    configsState.map = {
      revenuecat_enabled: "true",
      revenuecat_webhook_secret: SECRET,
    };
    const response = await postWebhook({ "content-type": "application/json" }, RAW_BODY);

    expect(response.status).toBe(401);
    expect(mapRevenueCatEventMock).not.toHaveBeenCalled();
  });

  it("delegates to mapRevenueCatEvent and returns received:true on a valid webhook", async () => {
    configsState.map = {
      revenuecat_enabled: "true",
      revenuecat_webhook_secret: SECRET,
    };
    const response = await postWebhook(enabledHeaders(), RAW_BODY);

    expect(response.status).toBe(200);
    const data = (await response.json()) as { data?: { received?: boolean } };
    expect(data.data?.received).toBe(true);
    expect(mapRevenueCatEventMock).toHaveBeenCalledTimes(1);

    const payload = mapRevenueCatEventMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toEqual({ event: { app_user_id: "user-1", type: "TEST" } });
  });
});
