// packages/api/src/routes/notes —— 笔记示例资源（CLI data 命令的数据面）。
//
// 全挂 `requireAuth`（会话或有效 API Key），以 `c.get("userId")` 范围隔离，每人看不到他人笔记。
//   - GET /api/notes           列出当前用户笔记（支持 ?limit）；
//   - GET /api/notes/:id        获取单条；
//   - POST /api/notes           创建笔记（name 必填，description 可选）。
// 响应统一走 `{ code, message, data? }` 信封。
//
// 存储说明：使用进程内内存数组（对齐计划「简单实现，生产应使用数据库」）。在多实例 / 无状态
// 部署下数据不跨进程持久，仅供 CLI 数据命令的端到端演示；后续可平迁到 @openstarter/db。

import { respData, respErr } from "@openstarter/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const createSchema = z.object({
  description: z.string().optional(),
  name: z.string().min(1).max(200),
});

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

interface Note {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

// 进程内存储（见上文存储说明）。单实例内随 userId 隔离、跨请求存活。
const notes: Note[] = [];
let noteIdCounter = 1;

export const notesRoute = new Hono()
  .get("/api/notes", requireAuth, zValidator("query", listQuery), async (c) => {
    const { limit } = c.req.valid("query");
    const userId = c.get("userId");
    const userNotes = notes
      .filter((note) => note.userId === userId)
      .slice(-limit)
      .reverse();
    return c.json(respData(userNotes));
  })
  .get("/api/notes/:id", requireAuth, async (c) => {
    const userId = c.get("userId");
    const note = notes.find(
      (n) => n.id === c.req.param("id") && n.userId === userId,
    );
    if (!note) {
      return c.json(respErr("note not found"), 404);
    }
    return c.json(respData(note));
  })
  .post("/api/notes", requireAuth, zValidator("json", createSchema), async (c) => {
    const userId = c.get("userId");
    const { name, description } = c.req.valid("json");
    const now = new Date().toISOString();
    const note: Note = {
      createdAt: now,
      description: description ?? "",
      id: `note_${noteIdCounter++}`,
      name,
      updatedAt: now,
      userId,
    };
    notes.push(note);
    return c.json(respData(note), 201);
  });
