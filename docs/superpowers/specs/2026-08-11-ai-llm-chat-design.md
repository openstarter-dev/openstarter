# AI LLM Chat Module Design

> **Goal:** Add real-time LLM chat capability to openstarter with multi-provider support (OpenAI, Anthropic, Google), streaming responses via SSE, and conversation persistence.

**Architecture:** New standalone `modules/llm/` sub-module using Vercel AI SDK (`ai` + `@ai-sdk/*`) for multi-provider LLM orchestration. Streaming chat via SSE, conversation history persisted in `chat`/`chatMessage` database tables. Free usage (no credit deduction). Auth required, plan gating applied.

**Tech Stack:** TypeScript, Hono, Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`), Drizzle ORM

## Global Constraints

- No credit deduction for LLM chat (free feature)
- Authenticated users only (require auth middleware)
- Plan-gated: "member" plan or higher
- Streaming responses via Server-Sent Events (SSE)
- Multi-provider support configured via Config system
- Conversation history persisted in existing `chat`/`chatMessage` tables
- AI SDK used for provider abstraction (not direct API calls)
- Consistent error handling with existing API error patterns

---

## Module Structure

### File Organization

```
packages/api/src/modules/llm/
├── index.ts          # Module barrel export
├── router.ts         # Hono routes (POST /llm/chats, GET /llm/chats, etc.)
├── service.ts        # Chat/Message CRUD & business logic
├── provider.ts       # LLM provider setup (AI SDK + config resolution)
└── types.ts          # TypeScript types for chat operations
```

### Why Separate `llm/` Module?

Unlike the existing `ai/` module (Replicate/Fal media generation):
- **Different lifecycle:** LLM is streaming + synchronous; media generation is async + polling
- **Different data model:** Uses `chat`/`chatMessage` tables, not `ai_task`
- **Different provider interface:** Uses Vercel AI SDK; existing AI module uses custom `AIProvider` abstraction
- **Different economic model:** Free; media generation is credit-based
- **Keeps files focused:** Separation of concerns, clearer boundaries

---

## API Endpoints

### 1. Create Chat

```
POST /llm/chats
Authorization: required (Bearer token)
Content-Type: application/json

Request Body:
{
  "title": "string" (optional, auto-generated from first message if omitted),
  "model": "string" (optional, uses llm_default_model from config),
  "provider": "string" (optional, uses llm_provider from config)
}

Response:
{
  "code": 0,
  "data": {
    "id": "uuid",
    "title": "Chat Title",
    "model": "gpt-4o",
    "provider": "openai",
    "status": "active",
    "createdAt": "2026-08-11T12:00:00.000Z",
    "updatedAt": "2026-08-11T12:00:00.000Z"
  }
}
```

### 2. Send Message (Streaming)

```
POST /llm/chats/:id/messages
Authorization: required
Content-Type: application/json

Request Body:
{
  "content": "string (user message)"
}

Response: Server-Sent Events (SSE) stream

Event stream format:
event: message
data: {"type":"text","text":"Hello"}

event: message
data: {"type":"text","text":" there"}

event: done
data: {"finishReason":"stop","usage":{"inputTokens":50,"outputTokens":100}}
```

### 3. Get Chat History

```
GET /llm/chats/:id/messages?page=1&pageSize=20
Authorization: required

Response:
{
  "code": 0,
  "data": [
    {
      "id": "uuid",
      "chatId": "uuid",
      "role": "user",
      "content": "Hello",
      "createdAt": "2026-08-11T12:00:00.000Z"
    },
    {
      "id": "uuid",
      "chatId": "uuid",
      "role": "assistant",
      "content": "Hi there! How can I help?",
      "createdAt": "2026-08-11T12:00:01.000Z"
    }
  ],
  "page": 1,
  "total": 2
}
```

### 4. List User Chats

```
GET /llm/chats?page=1&pageSize=20
Authorization: required

Response:
{
  "code": 0,
  "data": [
    {
      "id": "uuid",
      "title": "Chat Title",
      "model": "gpt-4o",
      "provider": "openai",
      "status": "active",
      "createdAt": "2026-08-11T12:00:00.000Z",
      "updatedAt": "2026-08-11T12:00:00.000Z"
    }
  ],
  "page": 1,
  "total": 1
}
```

### 5. Delete Chat

```
DELETE /llm/chats/:id
Authorization: required

Response:
{
  "code": 0,
  "data": null
}
```

---

## Data Flow

### Conversation Lifecycle

```
1. User creates chat
   POST /llm/chats
   → Insert into `chat` table
   → Return chat object

2. User sends first message
   POST /llm/chats/:id/messages with { content: "Hello" }
   → Save user message to `chatMessage` (role: user)
   → Call AI SDK streamText() with accumulated message history
   → Stream response tokens via SSE
   → Collect full response
   → Save assistant message to `chatMessage` (role: assistant)
   → Update `chat.title` if first message (auto-generate from content)
   → Update `chat.updatedAt`
   → Close SSE stream

3. User retrieves history
   GET /llm/chats/:id/messages
   → Query `chatMessage` where chatId = :id
   → Return paginated results ordered by createdAt DESC

4. User deletes chat
   DELETE /llm/chats/:id
   → Soft-delete or hard-delete `chat` record
   → Cascade delete associated `chatMessage` records
```

### Message History Accumulation

For each new user message:
```
Messages sent to AI SDK:
[
  { role: "user", content: "What is TypeScript?" },
  { role: "assistant", content: "TypeScript is a typed superset of JavaScript..." },
  { role: "user", content: "How does it compile?" },  // <- new user message
]

AI SDK returns streaming response for this turn only.
We accumulate the full assistant response and save it.
```

---

## Configuration

Via `@openstarter/shared/config`:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `llm_provider` | string | `openai` | Default provider (openai / anthropic / google) |
| `llm_default_model` | string | `gpt-4o-mini` | Default model ID |
| `llm_openai_api_key` | string | (required if provider=openai) | OpenAI API key |
| `llm_anthropic_api_key` | string | (optional) | Anthropic API key |
| `llm_google_api_key` | string | (optional) | Google API key |
| `llm_enabled` | boolean | `true` | Feature flag to disable LLM globally |

### Provider Setup (provider.ts)

```typescript
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";

async function getModel(provider?: string, modelId?: string) {
  const configs = await getAllConfigs();
  const providerName = provider || configs.llm_provider;
  const model = modelId || configs.llm_default_model;

  switch (providerName) {
    case "openai":
      return openai(model); // e.g., "gpt-4o"
    case "anthropic":
      return anthropic(model); // e.g., "claude-3-5-sonnet-20241022"
    case "google":
      return google(model); // e.g., "gemini-2.0-flash"
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}
```

---

## Error Handling

### Error Types

| Error | HTTP Status | Scenario |
|-------|------------|----------|
| Chat not found | 404 | User requests non-existent chat |
| Unauthorized | 403 | Chat belongs to different user |
| Invalid model | 400 | Requested model not configured |
| Provider unavailable | 503 | Provider API key missing or provider disabled |
| Provider error | 502 | OpenAI/Anthropic/Google returns error |
| Insufficient plan | 403 | User's plan doesn't allow LLM |

### Error Response Format

```json
{
  "code": 1,
  "message": "error description",
  "data": null
}
```

---

## Database Schema (Existing Tables Used)

### chat table

```sql
CREATE TABLE chat (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  createdAt INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER)),
  updatedAt INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER))
);

CREATE INDEX idx_chat_user_status ON chat(userId, status);
```

### chatMessage table

```sql
CREATE TABLE chat_message (
  id TEXT PRIMARY KEY,
  chatId TEXT NOT NULL REFERENCES chat(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  parts TEXT, -- JSON array if multi-modal in future
  model TEXT,
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  createdAt INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER)),
  updatedAt INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER))
);

CREATE INDEX idx_chat_message_chat_id ON chat_message(chatId, status);
CREATE INDEX idx_chat_message_user_id ON chat_message(userId, status);
```

Note: Tables already exist in openstarter schema. No schema changes needed.

---

## Middleware & Auth

- **`requireAuth`:** User must be authenticated (Bearer token)
- **`requirePlan("member")`:** User's subscription plan must be "member" or higher
- **User isolation:** Endpoints validate `userId` matches authenticated user before returning data

---

## Streaming Implementation

### SSE Response Format (Hono)

```typescript
import { streamText } from "ai";

app.post("/llm/chats/:id/messages", async (c) => {
  // ... validation & auth ...
  
  const result = streamText({
    model: modelInstance,
    messages: historicalMessages.concat([userMessage]),
    system: "You are a helpful assistant..."
  });

  return result.toUIMessageStreamResponse();
});
```

The `toUIMessageStreamResponse()` from Vercel AI SDK handles SSE formatting automatically.

---

## Testing Strategy

### Unit Tests

- **service.ts:** Chat/message CRUD logic, pagination, filtering
- **provider.ts:** Model resolution based on config, error handling for missing API keys

### Integration Tests

- **router.ts:** Full endpoint flows
  - Create chat + send message + retrieve history
  - Multi-turn conversation with streaming
  - Plan gating (non-members get 403)
  - Auth failure scenarios
  - Chat isolation (users can't access other users' chats)

### Mock Strategy

- Mock Vercel AI SDK's `streamText()` to avoid real API calls
- Mock `getAllConfigs()` to test different provider configurations
- Mock `db()` for database operations

---

## Dependencies to Add

In `packages/api/package.json`:

```json
{
  "dependencies": {
    "ai": "^6.0.168",
    "@ai-sdk/openai": "^3.0.53",
    "@ai-sdk/anthropic": "^0.0.53",
    "@ai-sdk/google": "^0.0.53"
  }
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure
- Create `modules/llm/` directory structure
- Write `types.ts` (TypeScript interfaces)
- Write `provider.ts` (model resolution)
- Write `service.ts` (chat/message CRUD)

### Phase 2: API Endpoints
- Write `router.ts` with all endpoints
- Implement streaming for POST `/llm/chats/:id/messages`
- Add auth middleware & plan gating

### Phase 3: Testing & Polish
- Write unit & integration tests
- Error handling & validation
- Documentation

---

## Backwards Compatibility

- No changes to existing `ai/` module
- No changes to existing `ai-tasks/` module
- New `llm/` module is additive
- Existing `chat`/`chatMessage` tables are only used by new module (not existing)

---

## Future Enhancements (Out of Scope)

- Web search integration for LLM context
- File upload & document retrieval
- Model fine-tuning or custom system prompts per chat
- Rate limiting per user
- Cost tracking (if pricing changes)
- Vision/multimodal support

---

## References

- [Vercel AI SDK Documentation](https://sdk.vercel.ai)
- [core-starter `/chat` reference](../../../core-starter/packages/api/src/modules/ai/router.ts)
- [openstarter AI module design](./packages/api/src/modules/ai/)
