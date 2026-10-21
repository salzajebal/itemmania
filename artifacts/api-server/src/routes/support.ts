import { Router, type Request, type Response, type NextFunction } from "express";
import { pool } from "@workspace/db";
import { SupportError, supportId, sendSupportMessage, supportSummary, supportHistory,
  readSupport, supportConversations, deleteSupportConversation } from "../lib/support-chat";
import { emitSupport, supportStream } from "../lib/support-realtime";

const router = Router();
async function authenticate(req: Request, res: Response, next: NextFunction, admin: boolean) {
  const id = admin ? req.session?.adminId : req.session?.userId;
  if (!id || (admin && req.session.adminRole !== "admin")) {
    res.status(401).json({ error: admin ? "관리자 로그인이 필요합니다." : "로그인 후 1:1 문의를 이용해 주세요." }); return;
  }
  try {
    const { rows: [user] } = await pool.query("SELECT role,deleted_at,suspended_at FROM users WHERE id=$1", [id]);
    if (!user || user.deleted_at || user.suspended_at || (admin && user.role !== "admin")) {
      res.status(403).json({ error: "이 계정으로 문의 기능을 이용할 수 없습니다." }); return;
    }
    res.set("Cache-Control", "no-store");
    next();
  } catch { res.status(503).json({ error: "문의 서비스 연결에 실패했습니다. 잠시 후 다시 시도해 주세요." }); }
}
router.use("/support", (req, res, next) => { void authenticate(req, res, next, false); });
router.use("/admin/support", (req, res, next) => { void authenticate(req, res, next, true); });

function handler(fn: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try { await fn(req, res); }
    catch (error) {
      if (error instanceof SupportError) { res.status(error.status).json({ error: error.message }); return; }
      req.log.error("고객센터 문의 처리 실패"); // Do not log private message bodies or credentials.
      res.status(500).json({ error: "문의 처리에 실패했습니다. 다시 시도해 주세요." });
    }
  };
}
function cursors(req: Request) {
  const after = req.query.afterId === undefined ? undefined : supportId(req.query.afterId, true);
  const before = req.query.beforeId === undefined ? undefined : supportId(req.query.beforeId);
  if (after !== undefined && before !== undefined) throw new SupportError(400, "조회 방향은 하나만 선택해 주세요.");
  return { after, before };
}
router.get("/support/summary", handler(async (req, res) => {
  res.json(await supportSummary(req.session.userId!, "member"));
}));
router.get("/support/events", (req, res) => supportStream(req, res, req.session.userId!, false));
router.get("/admin/support/events", (req, res) => supportStream(req, res, req.session.adminId!, true));
router.get("/support/messages", handler(async (req, res) => {
  const { after, before } = cursors(req);
  res.json(await supportHistory(req.session.userId!, "member", after, before));
}));
router.post("/support/messages", handler(async (req, res) => {
  if (req.body?.expectedUserId !== undefined && supportId(req.body.expectedUserId) !== req.session.userId) {
    throw new SupportError(409, "로그인 계정이 변경되었습니다. 문의창을 다시 열어 주세요.");
  }
  const message = await sendSupportMessage(req.session.userId!, req.session.userId!, "member", req.body);
  emitSupport(message.userId, message.id, "member");
  res.json({ message });
}));
router.post("/support/read", handler(async (req, res) => {
  const id = supportId(req.body?.messageId, true);
  if (await readSupport(req.session.userId!, "member", id)) emitSupport(req.session.userId!, id);
  res.json({ ok: true });
}));
router.get("/admin/support/conversations", handler(async (req, res) => {
  const limit = req.query.limit === undefined ? 50 : Math.min(100, supportId(req.query.limit));
  const before = req.query.beforeId === undefined ? undefined : supportId(req.query.beforeId);
  res.json(await supportConversations(limit, before));
}));
router.get("/admin/support/:userId/messages", handler(async (req, res) => {
  const id = supportId(req.params.userId), { after, before } = cursors(req);
  res.json(await supportHistory(id, "admin", after, before));
}));
router.delete("/admin/support/:userId", handler(async (req, res) => {
  const owner = supportId(req.params.userId);
  const result = await deleteSupportConversation(owner, req.session.adminId!, supportId(req.body?.lastMessageId, true));
  emitSupport(owner, 0, "deleted");
  res.json(result);
}));
router.post("/admin/support/:userId/messages", handler(async (req, res) => {
  const message = await sendSupportMessage(supportId(req.params.userId), req.session.adminId!, "admin", req.body);
  emitSupport(message.userId, message.id, "admin");
  res.json({ message });
}));
router.post("/admin/support/:userId/read", handler(async (req, res) => {
  const owner = supportId(req.params.userId), id = supportId(req.body?.messageId, true);
  if (await readSupport(owner, "admin", id)) emitSupport(owner, id);
  res.json({ ok: true });
}));
export default router;
