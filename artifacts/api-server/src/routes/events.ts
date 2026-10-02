import { Router, type IRouter, type Request, type Response } from "express";
import { addSSEClient, removeSSEClient } from "../lib/sse";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

function streamEvents(userId: number, req: Request, res: Response): void {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  res.write("event: connected\ndata: {}\n\n");

  addSSEClient(userId, res);

  req.on("close", () => removeSSEClient(userId, res));
}

router.get("/events", (req, res): void => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).end();
    return;
  }
  streamEvents(userId, req, res);
});

router.get("/admin/events", requireAdmin, (req, res): void => {
  streamEvents(req.session.adminId ?? req.session.userId!, req, res);
});

export default router;
