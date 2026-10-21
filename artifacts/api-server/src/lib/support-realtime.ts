import type { Request, Response } from "express";
import { pool } from "@workspace/db";
import { addSSEClient, removeSSEClient, pushToUser } from "./sse";

const operators = new Set<Response>();
export function emitSupport(userId: number, messageId: number, kind: "member" | "admin" | "read" | "deleted" = "read") {
  const data = { userId, messageId, kind };
  pushToUser(userId, "support", data);
  const payload = `event: support\ndata: ${JSON.stringify(data)}\n\n`;
  for (const response of operators) {
    if (response.destroyed || response.writableEnded) { operators.delete(response); continue; }
    try { response.write(payload); } catch { operators.delete(response); }
  }
}
export function supportStream(req: Request, res: Response, id: number, admin: boolean) {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  res.write("event: connected\ndata: {}\n\n");
  if (admin) operators.add(res); else addSSEClient(id, res);
  let checking = false;
  const heartbeat = setInterval(async () => {
    if (checking || res.writableEnded || res.destroyed) return;
    checking = true;
    try {
      const saved = await new Promise<any>((resolve, reject) => req.sessionStore.get(req.sessionID,
        (error, session) => error ? reject(error) : resolve(session)));
      const { rows: [user] } = await pool.query("SELECT role,deleted_at,suspended_at FROM users WHERE id=$1", [id]);
      if (!saved || (admin ? saved.adminId : saved.userId) !== id ||
          !user || user.deleted_at || user.suspended_at || (admin && user.role !== "admin")) {
        res.write("event: unauthorized\ndata: {}\n\n"); res.end(); return;
      }
      res.write(": heartbeat\n\n");
    } catch { res.end(); }
    finally { checking = false; }
  }, 20000);
  heartbeat.unref();
  const cleanup = () => {
    clearInterval(heartbeat);
    if (admin) operators.delete(res); else removeSSEClient(id, res);
  };
  res.on("close", cleanup);
}
