import { zValidator } from "@hono/zod-validator";
import { respData, respErr } from "@openstarter/shared";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuth } from "../../middleware/auth";

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
  createdAt: string;
  description: string;
  id: string;
  name: string;
  updatedAt: string;
  userId: string;
}

// 进程内存储（见上文存储说明）。单实例内随 userId 隔离、跨请求存活。
const notes: Note[] = [];
let noteIdCounter = 1;

export const demoRouter = new Hono()
  // Private data endpoint (demo)
  .get("/private-data", requireAuth, (c) => {
    const session = c.get("session");
    if (!session) {
      return c.json({ message: "Unauthorized" }, 401);
    }
    return c.json({ message: "This is private", user: session.user });
  })
  // Notes endpoints (demo)
  .get("/notes", requireAuth, zValidator("query", listQuery), (c) => {
    const { limit } = c.req.valid("query");
    const userId = c.get("userId");
    const userNotes = notes
      .filter((note) => note.userId === userId)
      .slice(-limit)
      .reverse();
    return c.json(respData(userNotes));
  })
  .get("/notes/:id", requireAuth, (c) => {
    const userId = c.get("userId");
    const note = notes.find((n) => n.id === c.req.param("id") && n.userId === userId);
    if (!note) {
      return c.json(respErr("note not found"), 404);
    }
    return c.json(respData(note));
  })
  .post("/notes", requireAuth, zValidator("json", createSchema), (c) => {
    const userId = c.get("userId");
    const { name, description } = c.req.valid("json");
    const now = new Date().toISOString();
    const noteId = noteIdCounter;
    noteIdCounter += 1;
    const note: Note = {
      createdAt: now,
      description: description ?? "",
      id: `note_${noteId}`,
      name,
      updatedAt: now,
      userId,
    };
    notes.push(note);
    return c.json(respData(note), 201);
  });
