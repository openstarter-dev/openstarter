# MCP Server 模块（`/api/mcp`）

通过 [Model Context Protocol](https://modelcontextprotocol.io)（streamable HTTP,无状态）把
openstarter 的用户数据能力暴露给 AI 客户端（Claude Desktop、Claude Code 等已有 MCP 支持的宿主）。

## 鉴权

仅接受 **API Key**（`Authorization: Bearer sk_...`，复用 `@openstarter/auth` 的 apikey 体系），
不接受浏览器 session。在 Web 端「设置 → API Keys」创建 Key 后即可使用；吊销 Key 立即失效。

userId 在路由层解析后经 `authInfo.clientId` 传入工具回调——**工具参数永远不决定数据归属**，
越权访问返回与"不存在"一致的 `isError` 结果。

## 客户端配置

Claude Code:

```bash
claude mcp add --transport http openstarter https://<your-domain>/api/mcp \
  --header "Authorization: Bearer sk_xxxxxxxx"
```

Claude Desktop / 其他支持 streamable HTTP 的客户端:

```json
{
  "mcpServers": {
    "openstarter": {
      "type": "http",
      "url": "https://<your-domain>/api/mcp",
      "headers": { "Authorization": "Bearer sk_xxxxxxxx" }
    }
  }
}
```

## 工具清单

| 工具                              | 说明                                  | 读写 |
| --------------------------------- | ------------------------------------- | ---- |
| `openstarter_get_profile`         | 本人资料、套餐、积分余额              | R    |
| `openstarter_get_subscription`    | 订阅状态/套餐/下次计费日              | R    |
| `openstarter_list_credit_history` | 积分流水（limit/offset）              | R    |
| `openstarter_list_orders`         | 订单/支付记录（分页）                 | R    |
| `openstarter_list_ai_tasks`       | AI 生成任务（分页,可按状态/类型过滤） | R    |
| `openstarter_list_tickets`        | 本人工单列表（分页/筛选）             | R    |
| `openstarter_get_ticket_messages` | 工单消息线程（校验归属）              | R    |
| `openstarter_create_ticket`       | 创建支持工单                          | W    |
| `openstarter_reply_ticket`        | 回复本人工单（role 固定为 user）      | W    |

## 结构

```
modules/mcp/
├── index.ts       # Hono 子路由（apiKeyAuth → handler.fetch + authInfo 注入）
├── server.ts      # createMcpHandler 工厂（无状态,每请求新实例）
├── shared.ts      # 上下文解析、JSON 信封、错误格式化、分页 schema
└── tools/         # 按域拆分的工具注册（profile/orders/tickets）
```

新增工具：在对应域文件中 `server.registerTool(...)`（Zod v4 inputSchema + annotations）,
复用 `shared.ts` 的 `resolveUserId`/`jsonContent`/`withToolError`。

## 已知限制 / 跟进项

- **限流**：MCP 端点暂未加独立 rate limit（全仓尚无限流设施）,建议后续按 userId 限流
  （如 `hono-rate-limiter`）。
- **认证**：当前为静态 API Key；如需 OAuth 2.1 动态客户端注册,见 MCP 规范的
  authorization 章节,可在 `router.ts` 前置 `requireBearerAuth` + verifier。
- 所有工具结果为 JSON 文本块；分页默认 pageSize 20、上限 100。
