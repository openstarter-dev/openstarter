// packages/api/src/routes/status —— 系统状态公开端点。
// GET /api/status 返回服务可用性、版本与时间戳，供 CLI `status` 命令探活。无鉴权。

import { respData } from "@openstarter/shared";
import { Hono } from "hono";

const APP_VERSION = "0.1.0";

interface StatusView {
  status: "ok";
  timestamp: string;
  version: string;
}

export const statusRoute = new Hono().get("/api/status", (c) => {
  const view: StatusView = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
  };
  return c.json(respData(view));
});
