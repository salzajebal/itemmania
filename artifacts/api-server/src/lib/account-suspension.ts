import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

const cache = new Map<number, { suspended: boolean; expires: number }>();
const CACHE_MS = 1500;

export function invalidateAccountSuspension(userId: number): void {
  cache.delete(userId);
}

export async function rejectSuspendedAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session?.userId;
  if (!userId || req.path === "/api/auth/logout" || req.path === "/api/auth/login" ||
      req.path === "/banana777" || req.path.startsWith("/banana777/") ||
      req.path === "/api/admin" || req.path.startsWith("/api/admin/") ||
      (req.session.adminId === userId && req.session.adminRole === "admin")) {
    next();
    return;
  }

  try {
    let state = cache.get(userId);
    if (!state || state.expires <= Date.now()) {
      const [user] = await db.select({ suspendedAt: usersTable.suspendedAt })
        .from(usersTable).where(eq(usersTable.id, userId));
      state = { suspended: !user || !!user.suspendedAt, expires: Date.now() + CACHE_MS };
      if (cache.size > 2000) cache.clear();
      cache.set(userId, state);
    }
    if (state.suspended) {
      res.set("Cache-Control", "no-store");
      if (req.path.startsWith("/api/")) {
        res.status(403).json({ error: "차단된 계정입니다. 관리자에게 문의해 주세요." });
      } else {
        res.status(403).type("text/plain; charset=utf-8").send("차단된 계정입니다. 관리자에게 문의해 주세요.");
      }
      return;
    }
    next();
  } catch (error) {
    req.log.error({ err: error }, "계정 차단 상태 조회 실패");
    res.status(503).json({ error: "계정 상태를 확인할 수 없습니다." });
  }
}