import { respData, respErr } from "@openstarter/shared";
import { Hono } from "hono";

import { zValidator } from "../../lib/validator";
import { requireAuth } from "../../middleware/auth";
import { createSchema, listQuery } from "../../schema/demo";

interface Note {
  createdAt: string;
  description: string;
  id: string;
  name: string;
  updatedAt: string;
  userId: string;
}

const notes: Note[] = [];
let noteIdCounter = 1;

export const demoRouter = new Hono()
  // Private data endpoint (demo)
  .get("/private-data", requireAuth, (c) => {
    const session = c.get("session");
    if (!session) {
      return c.json(respErr("unauthorized"), 401);
    }
    return c.json(respData({ message: "This is private", user: session.user }));
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
