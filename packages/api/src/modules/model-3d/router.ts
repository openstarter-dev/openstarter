import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { respData, respErr } from "@openstarter/shared";
import { requireAuth } from "../../middleware/auth";
import { createTask, findTask, updateTask } from "../ai-tasks";
import {
  ARK_3D_MODEL,
  ARK_3D_TASKS_URL,
  buildGenerationRequest,
  creationResponse,
  generationInput,
  queryResponse,
} from "./contract";

async function ark(path: string, body?: unknown) {
  const key = process.env.ARK_API_KEY;
  if (!key) throw new HTTPException(503, { message: "3D generation is not configured" });
  const response = await fetch(`${ARK_3D_TASKS_URL}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok)
    throw new HTTPException(502, { message: `3D provider returned HTTP ${response.status}` });
  return response.json();
}
export const model3dRouter = new Hono()
  .post("/model-3d/tasks", requireAuth, zValidator("json", generationInput), async (c) => {
    if (!process.env.ARK_API_KEY) return c.json(respErr("3D generation is not configured"), 503);
    const input = c.req.valid("json");
    const task = await createTask({
      userId: c.get("userId"),
      mediaType: "model3d",
      model: ARK_3D_MODEL,
      provider: "ark-3d",
      prompt: input.prompt,
    });
    // Do not retry creation: the provider may already have charged for an accepted request.
    try {
      const result = creationResponse.parse(await ark("", buildGenerationRequest(input)));
      await updateTask({ id: task.id, providerTaskId: result.id, status: "processing" });
      return c.json(respData({ id: task.id, status: "processing" }), 202);
    } catch {
      await updateTask({
        id: task.id,
        status: "failed",
        taskInfo: {
          errorMessage:
            "Submission could not be confirmed. Check provider history before submitting again.",
        },
      });
      return c.json(
        respErr(
          "Submission could not be confirmed. Check provider history before submitting again.",
        ),
        502,
      );
    }
  })
  .get("/model-3d/tasks/:id", requireAuth, async (c) => {
    const task = await findTask(c.req.param("id"));
    if (!task || task.userId !== c.get("userId") || task.provider !== "ark-3d")
      return c.json(respErr("Task not found"), 404);
    if (!task.taskId) return c.json(respData({ id: task.id, status: task.status }));
    const result = queryResponse.parse(await ark(`/${encodeURIComponent(task.taskId)}`));
    const status =
      result.status === "succeeded"
        ? "success"
        : result.status === "failed" || result.status === "cancelled" || result.status === "expired"
          ? "failed"
          : "processing";
    await updateTask({ id: task.id, status, taskResult: result });
    return c.json(
      respData({
        id: task.id,
        status,
        fileUrl: status === "success" ? result.content?.file_url : undefined,
      }),
    );
  });
