import { createServer } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { TLSocketRoom } from "@tldraw/sync-core";

// A local development sync service. Room UUIDs are edit-capability links.
// Production must put this behind authenticated membership and a WSS proxy.
const directory = resolve(
  process.env.CANVAS_DATA_DIR || fileURLToPath(new URL("../.canvas-data", import.meta.url)),
);
await mkdir(directory, { recursive: true });
const rooms = new Map();
const roomPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let closing = false;
async function loadRoom(id) {
  const path = join(directory, `${id}.json`);
  let initialSnapshot;
  try {
    initialSnapshot = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  let timer;
  let pending = Promise.resolve();
  const persist = () => {
    clearTimeout(timer);
    const snapshot = JSON.stringify(room.getCurrentSnapshot());
    pending = pending
      .catch(() => {})
      .then(async () => {
        await writeFile(`${path}.tmp`, snapshot);
        await rename(`${path}.tmp`, path);
      });
    pending.catch((error) => console.error("Canvas persistence failed:", error.message));
    return pending;
  };
  const room = new TLSocketRoom({
    initialSnapshot,
    onDataChange() {
      clearTimeout(timer);
      timer = setTimeout(persist, 300);
    },
  });
  return { room, persist };
}
function getRoom(id) {
  if (!rooms.has(id))
    rooms.set(
      id,
      loadRoom(id).catch((error) => {
        rooms.delete(id);
        throw error;
      }),
    );
  return rooms.get(id);
}
const server = createServer((request, response) => {
  response.writeHead(request.url === "/health" ? 200 : 404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ status: request.url === "/health" ? "ok" : "not-found" }));
});
const sockets = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 * 1024 });
server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, "http://localhost");
  const match = /^\/canvas-sync\/([^/]+)$/.exec(url.pathname);
  const id = match?.[1];
  const sessionId = url.searchParams.get("sessionId");
  // Only same-origin browser traffic via the app proxy, or explicit test clients.
  const origin = request.headers.origin;
  if (origin && new URL(origin).host !== request.headers.host) {
    socket.destroy();
    return;
  }
  if (closing || !id || !roomPattern.test(id) || !sessionId || sessionId.length > 200) {
    socket.destroy();
    return;
  }
  sockets.handleUpgrade(request, socket, head, async (ws) => {
    try {
      const { room } = await getRoom(id);
      if (ws.readyState === 1) room.handleSocketConnect({ sessionId, socket: ws });
    } catch (error) {
      console.error("Canvas room failed:", error.message);
      ws.close(1011, "Room unavailable");
    }
  });
});
server.listen(Number(process.env.CANVAS_PORT || 3102), "127.0.0.1", () =>
  console.log("Canvas sync listening on http://127.0.0.1:3102"),
);
async function shutdown() {
  if (closing) return;
  closing = true;
  const active = await Promise.allSettled(rooms.values());
  await Promise.allSettled(
    active.filter((r) => r.status === "fulfilled").map((r) => r.value.persist()),
  );
  for (const client of sockets.clients) client.close(1001, "Server restarting");
  sockets.close();
  server.close();
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
