import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { desc, eq } from "drizzle-orm";
import { db, blockedIpsTable } from "@workspace/db";
import { clientIp, normalizeIp, updateBlockedIp } from "../lib/ip-blocks";

const router: IRouter = Router();

router.use("/admin/ip-blocks", (req: Request, res: Response, next: NextFunction): void => {
  if (!req.session?.adminId || req.session.adminRole !== "admin") {
    res.status(401).json({ error: "관리자 로그인이 필요합니다." });
    return;
  }
  res.set("Cache-Control", "no-store");
  if (req.method !== "GET") {
    const origin = req.get("origin");
    if (origin) {
      try {
        if (new URL(origin).host !== req.get("host")) {
          res.status(403).json({ error: "허용되지 않은 요청입니다." });
          return;
        }
      } catch {
        res.status(403).json({ error: "허용되지 않은 요청입니다." });
        return;
      }
    }
  }
  next();
});

router.get("/admin/ip-blocks", async (req, res): Promise<void> => {
  const items = await db.select().from(blockedIpsTable).orderBy(desc(blockedIpsTable.createdAt));
  res.json({ items, currentIp: clientIp(req) || "" });
});

router.post("/admin/ip-blocks", async (req, res): Promise<void> => {
  const ip = typeof req.body?.ip === "string" ? normalizeIp(req.body.ip) : null;
  const rawReason = req.body?.reason;
  if (!ip || (rawReason != null && typeof rawReason !== "string") || (typeof rawReason === "string" && rawReason.length > 300)) {
    res.status(400).json({ error: "올바른 IP 주소와 300자 이하의 사유를 입력해 주세요." });
    return;
  }
  try {
    const [item] = await db.insert(blockedIpsTable)
      .values({ ip, reason: rawReason?.trim() || null }).returning();
    updateBlockedIp(ip, true);
    res.status(201).json(item);
  } catch (error) {
    const dbError = error as { code?: string; cause?: { code?: string } };
    if (dbError.code === "23505" || dbError.cause?.code === "23505") {
      res.status(409).json({ error: "이미 차단된 IP입니다." });
      return;
    }
    throw error;
  }
});

router.delete("/admin/ip-blocks/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) {
    res.status(400).json({ error: "올바른 차단 항목을 선택해 주세요." });
    return;
  }
  const [item] = await db.delete(blockedIpsTable).where(eq(blockedIpsTable.id, id)).returning();
  if (!item) {
    res.status(404).json({ error: "차단 항목을 찾을 수 없습니다." });
    return;
  }
  updateBlockedIp(item.ip, false);
  res.json({ ok: true });
});

export default router;