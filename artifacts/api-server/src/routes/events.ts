import { Router, type IRouter } from "express";
import { addSSEClient, removeSSEClient } from "../lib/sse";

const router: IRouter = Router();

router.get("/events", (req, res): void => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).end();
    return;
  }

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
});

export default router;
