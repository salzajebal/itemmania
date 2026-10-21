import type { Response } from "express";

/** Comments keep proxy connections alive without emitting application events. */
export function keepEventStreamAlive(res: Response, onClose: () => void): () => void {
  let stopped = false;
  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    res.off("close", cleanup);
    onClose();
  };
  const timer = setInterval(() => {
    if (res.destroyed || res.writableEnded) return cleanup();
    try { res.write(": heartbeat\n\n"); }
    catch { cleanup(); }
  }, 25_000);
  timer.unref();
  res.on("close", cleanup);
  return cleanup;
}
