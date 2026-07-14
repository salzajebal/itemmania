import type { Response } from "express";

const clients = new Map<number, Set<Response>>();

export function addSSEClient(userId: number, res: Response): void {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(res);
}

export function removeSSEClient(userId: number, res: Response): void {
  const set = clients.get(userId);
  if (set) {
    set.delete(res);
    if (set.size === 0) clients.delete(userId);
  }
}

export function pushToUser(userId: number, event: string, data: object): void {
  const set = clients.get(userId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
      // flush immediately so data is not held in proxy buffers
      if (typeof (res as any).flush === "function") (res as any).flush();
    } catch { set.delete(res); }
  }
}
