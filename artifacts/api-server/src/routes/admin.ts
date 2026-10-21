import { canRemoveAdminOrder, canHideAdminOrder, canRemoveAdminChat, canHideAdminChat } from "../lib/admin-removal-policy";
import { changeMemberBalance, removeMember, MemberActionError } from "../lib/admin-member-actions";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, sql, desc, or, inArray, and, isNull } from "drizzle-orm";
import cron from "node-cron";
import { db, usersTable, ordersTable, withdrawalsTable, walletsTable, productsTable, chatRoomsTable, chatMessagesTable } from "@workspace/db";
import type { AuthStates } from "@workspace/db";
import { pushToUser, disconnectSSEClients } from "../lib/sse";
import { invalidateAccountSuspension } from "../lib/account-suspension";
import { logger } from "../lib/logger";
import * as cheerio from "cheerio";
import { fetchProxyPage } from "../lib/proxy";
import { fetchCrawlHtml, fetchDetailHtml, fetchPageHtml, resolveCrawlProvider, scraperFetch, type CrawlProvider } from "../lib/crawl-fetch";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createHmac } from "crypto";
import { getRegistrationPolicy, setRegistrationPolicy } from "../lib/registration-policy";
import multer from "multer";
import { loginLogoStatus, loginLogoBytes, updateLoginLogo, logoImageType, normalizeLoginBrandName, updateLoginBrandName } from "../lib/login-branding";
import bcrypt from "bcryptjs";
import { MemberPasswordError, resetMemberPassword } from "../lib/member-passwords";
import { memberPasswordOriginalsTable } from "@workspace/db";
import { AdminHideOrderParams, AdminHideOrderResponse, AdminHideChatRoomParams, AdminHideChatRoomResponse } from "@workspace/api-zod";
import { AdminRemoveWithdrawalParams, AdminRemoveWithdrawalResponse } from "@workspace/api-zod";
import { AdminHideInactiveProductParams, AdminHideInactiveProductResponse } from "@workspace/api-zod";

// SESSION_SECRET 기반 고정 크롤 키 (재시작해도 동일)
const CRAWL_KEY = createHmac("sha256", process.env.SESSION_SECRET || "itemmania-default")
  .update("crawl-key-v1")
  .digest("hex")
  .slice(0, 32);

const ADMIN_STATIC_DIR = (() => {
  const candidates = [
    join(process.cwd(), "src", "static"),
    join(process.cwd(), "artifacts", "api-server", "src", "static"),
  ];
  return candidates.find(existsSync) ?? candidates[0];
})();

const SNAPSHOT_GAME_MAP: Array<{ file: string; gameId: number; gameName: string }> = [
  { file: "sell-lineage-classic.html", gameId: 5913, gameName: "리니지클래식" },
  { file: "sell-maplestory-world.html", gameId: 5233, gameName: "메이플스토리월드" },
  { file: "sell-maplestory.html", gameId: 138, gameName: "메이플스토리" },
  { file: "sell-odin.html", gameId: 4696, gameName: "오딘" },
  { file: "sell-mabinogi.html", gameId: 155, gameName: "마비노기" },
  { file: "sell-lostark.html", gameId: 2696, gameName: "로스트아크" },
  { file: "sell-lineage-m.html", gameId: 3449, gameName: "리니지M" },
  { file: "sell-geosang.html", gameId: 101, gameName: "거상" },
  { file: "sell-aion2.html", gameId: 5799, gameName: "아이온2" },
  { file: "sell-dnf.html", gameId: 281, gameName: "던전앤파이터" },
  { file: "sell-mapleland.html", gameId: 5990, gameName: "메이플랜드" },
];

const router: IRouter = Router();

router.get("/member-login/logo", async (_req, res): Promise<void> => {
  const logo = await loginLogoBytes();
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  if (!logo) { res.sendStatus(404); return; }
  res.type(logo.mime).send(logo.bytes);
});

// ── 어드민 전역 인증 미들웨어 ─────────────────────────────────────────────
// /admin/ 경로에만 적용 — 다른 라우터 경로(events, games 등)는 즉시 통과
router.use(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // 이 라우터를 경유하는 비어드민 경로는 인증 없이 통과
  if (!req.path.startsWith("/admin/") && req.path !== "/admin") {
    next();
    return;
  }

  // 크롤 키 체크
  const crawlKey = req.headers["x-crawl-key"] as string | undefined;
  if (crawlKey && crawlKey === CRAWL_KEY) { next(); return; }

  // 세션 기반 체크: adminId/adminRole 또는 userRole 있으면 바로 통과
  const hasAdminSession =
    (!!req.session?.adminId && req.session.adminRole === "admin") ||
    (!!req.session?.userId && req.session.userRole === "admin");
  if (hasAdminSession) { next(); return; }

  // userId만 있는 경우 DB에서 role 직접 확인 (세션에 role 필드가 누락된 경우 대비)
  if (req.session?.userId) {
    try {
      const { usersTable: ut } = await import("@workspace/db");
      const { eq: eqFn } = await import("drizzle-orm");
      const [u] = await db.select({ role: ut.role }).from(ut).where(eqFn(ut.id, req.session.userId!));
      if (u?.role === "admin") {
        // 세션에 role 필드 채워서 다음 요청은 DB 조회 없이 통과
        req.session.userRole = "admin";
        req.session.adminId = req.session.userId;
        req.session.adminRole = "admin";
        req.session.save(() => {});
        next();
        return;
      }
    } catch {
      // DB 오류 시 아래 401로 떨어짐
    }
  }

  res.status(401).json({ error: "관리자 로그인이 필요합니다." });
});

// Unlike crawler endpoints, a crawl key must never authorize policy changes.
async function requirePolicyAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const actorId = req.session?.adminId ?? req.session?.userId;
  if (!actorId) { res.status(401).json({ error: "관리자 로그인이 필요합니다." }); return; }
  const [actor] = await db.select({ role: usersTable.role, suspendedAt: usersTable.suspendedAt, deletedAt: usersTable.deletedAt })
    .from(usersTable).where(eq(usersTable.id, actorId));
  if (actor?.role !== "admin" || actor.suspendedAt || actor.deletedAt) {
    res.status(403).json({ error: "관리자만 이 작업을 수행할 수 있습니다." }); return;
  }
  next();
}

router.get("/admin/registration-policy", requirePolicyAdmin, async (req, res): Promise<void> => {
  try { res.json(await getRegistrationPolicy()); }
  catch (error) {
    req.log.error({ err: error }, "가입 차단 설정 조회 실패");
    res.status(503).json({ error: "가입 차단 설정을 불러오지 못했습니다." });
  }
});

router.patch("/admin/registration-policy", requirePolicyAdmin, async (req, res): Promise<void> => {
  if (typeof req.body?.blocked !== "boolean") {
    res.status(400).json({ error: "blocked는 true 또는 false여야 합니다." }); return;
  }
  try {
    const policy = await setRegistrationPolicy(req.body.blocked);
    req.log.info({ blocked: policy.blocked, adminId: req.session.adminId ?? req.session.userId }, "관리자가 신규 가입 차단 설정을 변경했습니다");
    res.json(policy);
  } catch (error) {
    req.log.error({ err: error }, "가입 차단 설정 저장 실패");
    res.status(503).json({ error: "가입 차단 설정을 저장하지 못했습니다." });
  }
});

// ── 백그라운드 크롤 작업 상태 저장소 ─────────────────────────────────────
interface CrawlLog {
  type: string; message: string;
  gameIndex?: number; gameName?: string;
  page?: number; totalPages?: number; pageSaved?: number;
  completedSteps?: number; totalSteps?: number;
  totalSaved?: number; totalFailed?: number; detailFetched?: number; detailFailed?: number;
  ts: number;
}
interface CrawlJob {
  id: string;
  status: "running" | "done" | "failed";
  totalGames: number; totalPages: number; totalSteps: number;
  games: string[];
  completedSteps: number; totalSaved: number; totalFailed: number; detailFetched: number; detailFailed: number;
  logs: CrawlLog[];
  startedAt: number; finishedAt?: number;
}
const crawlJobs = new Map<string, CrawlJob>();

function jobPush(job: CrawlJob, data: Omit<CrawlLog, "ts">) {
  job.logs.push({ ...data, ts: Date.now() });
  if (job.logs.length > 2000) job.logs.splice(0, job.logs.length - 2000);
  if (data.completedSteps != null) job.completedSteps = data.completedSteps;
  if (data.totalSaved != null) job.totalSaved = data.totalSaved;
  if (data.totalFailed != null) job.totalFailed = data.totalFailed;
  if (data.detailFetched != null) job.detailFetched = data.detailFetched;
  if (data.detailFailed != null) job.detailFailed = data.detailFailed;
}

export async function runCrawlJob(
  job: CrawlJob, gameIds: number[], pages: number,
  provider: CrawlProvider, crawlDetail: boolean
): Promise<void> {
  const targetGames = gameIds.length > 0
    ? GAME_LIST.filter(g => gameIds.includes(g.id))
    : GAME_LIST.slice(0, 3);
  const maxPages = Math.min(Math.max(1, pages), 20);
  const categories: Array<"sell" | "buy"> = ["sell", "buy"];
  const totalSteps = targetGames.length * maxPages * categories.length;

  Object.assign(job, { totalGames: targetGames.length, totalPages: maxPages, totalSteps,
    games: targetGames.map(g => g.name) });

  let totalUpserted = 0, totalFailed = 0, detailFetched = 0, detailFailed = 0, completedSteps = 0;
  const push = (data: Omit<CrawlLog, "ts">) => jobPush(job, data);

  push({ type: "progress", message: "🌐 목록 수집 시작", completedSteps: 0, totalSteps, totalSaved: 0, totalFailed: 0 });

  for (const cat of categories) {
    const catLabel = cat === "sell" ? "팝니다" : "삽니다";
    push({ type: "progress", message: `── [${catLabel}] 크롤 시작 ──`, completedSteps, totalSteps, totalSaved: totalUpserted, totalFailed });

    for (let gi = 0; gi < targetGames.length; gi++) {
      const game = targetGames[gi];
      push({ type: "game", gameIndex: gi, gameName: game.name, message: `▶ [${catLabel}][${game.name}] 시작`, completedSteps, totalSteps, totalSaved: totalUpserted, totalFailed });

      for (let page = 1; page <= maxPages; page++) {
        push({ type: "progress", gameIndex: gi, gameName: game.name, page, totalPages: maxPages,
          completedSteps, totalSteps, totalSaved: totalUpserted, totalFailed,
          message: `  ${page}/${maxPages}페이지 크롤 중... (${catLabel})` });

        const { html, error } = await fetchPageHtml(game.id, page, provider, cat);
        if (!html) {
          completedSteps++;
          const fetchFailure = error ?? "HTML 없음";
          push({ type: "fail", gameIndex: gi, gameName: game.name, page, totalPages: maxPages,
            completedSteps, totalSteps, totalSaved: totalUpserted, totalFailed: ++totalFailed,
            message: `  ✗ [${catLabel}] ${game.name} ${page}페이지 - 실패 (${fetchFailure})` });
          if (fetchFailure.includes("크레딧 소진")) {
            job.status = "failed";
            job.finishedAt = Date.now();
            push({ type: "fail", completedSteps, totalSteps, totalSaved: totalUpserted, totalFailed,
              message: `${provider.kind === "firecrawl" ? "Firecrawl" : "ScraperAPI"} 크레딧이 소진되어 남은 요청을 중단했습니다.` });
            return;
          }
          continue;
        }

        const listItemCount = (html.match(/list_item/g) || []).length;
        const dataTidCount = (html.match(/data-tid=/g) || []).length;
        const products = parseProductsFromHtml(html, game.id, cat);

        if (products.length === 0) {
          completedSteps++;
          const failureMessage = `  ✗ [${catLabel}] ${game.name} ${page}페이지 - 상품 파싱 실패 (목록 아님/0개, ${html.length}바이트, list_item:${listItemCount}, data-tid:${dataTidCount})`;
          push({ type: "fail", gameIndex: gi, gameName: game.name, page, totalPages: maxPages,
            completedSteps, totalSteps, totalSaved: totalUpserted, totalFailed: ++totalFailed,
            message: failureMessage });
          continue;
        }

        const unclassifiedCount = products.filter(p => p.isPremium === null).length;
        const classifiedProducts = products.filter(p => p.isPremium !== null);
        if (unclassifiedCount > 0) totalFailed += unclassifiedCount;
        if (classifiedProducts.length === 0) {
          completedSteps++;
          push({ type: "fail", gameIndex: gi, gameName: game.name, page, totalPages: maxPages,
            completedSteps, totalSteps, totalSaved: totalUpserted, totalFailed,
            message: `  ✗ [${catLabel}] ${game.name} ${page}페이지 - 목록 구역 판별 실패 (${unclassifiedCount}개 분류 불가, DB 저장 안 함)` });
          continue;
        }
        if (unclassifiedCount > 0) {
          push({ type: "warn", gameIndex: gi, gameName: game.name, page, totalPages: maxPages,
            completedSteps, totalSteps, totalSaved: totalUpserted, totalFailed,
            message: `  ⚠ [${catLabel}] ${game.name} ${page}페이지 - 목록 구역 미분류 ${unclassifiedCount}개 제외` });
        }

        let pageSaved = 0;
        for (const p of classifiedProducts) {
          try {
            await db.insert(productsTable).values({
              itemmaniaid: p.itemmaniaid, title: p.title, price: p.price,
              category: p.category, itemCategory: p.itemCategory,
              gameName: p.gameName, serverName: p.serverName,
              sellerGrade: p.sellerGrade ?? null,
              ...(p.isPremium !== null && { isPremium: p.isPremium }),
              detailUrl: p.detailUrl, status: "active", crawledAt: new Date(),
              ...(p.originalCreatedAt && { createdAt: p.originalCreatedAt }),
            }).onConflictDoUpdate({
              target: productsTable.itemmaniaid,
              set: { title: p.title, price: p.price, gameName: p.gameName,
                serverName: p.serverName, itemCategory: p.itemCategory,
                sellerGrade: p.sellerGrade ?? null,
                ...(p.isPremium !== null && { isPremium: p.isPremium }),
                detailUrl: p.detailUrl, crawledAt: new Date() },
            });
            totalUpserted++; pageSaved++;
          } catch { totalFailed++; }

          if (crawlDetail) {
            const { html: dhtml, error: detailError } = await fetchDetailHtml(p.itemmaniaid, provider, cat);
            if (dhtml) {
              const detail = parseDetailFromHtml(dhtml);
              try {
                await db.update(productsTable)
                  .set({ description: detail.description, thumbnailUrl: detail.thumbnailUrl, sellerName: detail.sellerName })
                  .where(eq(productsTable.itemmaniaid, p.itemmaniaid));
                detailFetched++;
                } catch { detailFailed++; totalFailed++; }
              } else {
                detailFailed++;
                totalFailed++;
                if (detailError?.includes("크레딧 소진")) {
                  job.status = "failed";
                  job.finishedAt = Date.now();
                  push({ type: "fail", completedSteps, totalSteps, totalSaved: totalUpserted,
                    totalFailed, detailFetched, detailFailed,
                    message: `${provider.kind === "firecrawl" ? "Firecrawl" : "ScraperAPI"} 크레딧이 소진되어 상세 수집을 중단했습니다. (${detailError})` });
                  return;
                }
              }
            await new Promise(r => setTimeout(r, 300));
          }
        }

        completedSteps++;
        push({ type: unclassifiedCount > 0 ? "warn" : "ok", gameIndex: gi, gameName: game.name, page, totalPages: maxPages,
          pageSaved, completedSteps, totalSteps, totalSaved: totalUpserted, totalFailed, detailFetched,
          message: `  ${unclassifiedCount > 0 ? "⚠" : "✓"} [${catLabel}] ${game.name} ${page}페이지 - ${pageSaved}개 저장${unclassifiedCount > 0 ? ` / 미분류 ${unclassifiedCount}개 제외` : ""}${crawlDetail ? ` (상세 ${detailFetched}개)` : ""}` });

        if (page < maxPages) await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  job.status = (totalUpserted === 0 && totalFailed > 0) || detailFailed > 0 ? "failed" : "done";
  job.finishedAt = Date.now();
  push({ type: job.status === "failed" ? "fail" : "done", completedSteps: totalSteps, totalSteps,
    totalSaved: totalUpserted, totalFailed, detailFetched, detailFailed,
    message: `${job.status === "failed" ? (totalUpserted === 0 ? "❌ 저장 상품 없이 실패" : "⚠ 일부 상세 수집 실패") : "✅ 완료"} 총 ${totalUpserted}개 저장 / ${totalFailed}개 실패${crawlDetail ? ` / 상세 ${detailFetched}개 성공, ${detailFailed}개 실패` : ""}` });
}

// 전체 회원 목록
router.get("/admin/users", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10)));
  const offset = (page - 1) * limit;

  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      nickname: usersTable.nickname,
      name: usersTable.name,
      phone: usersTable.phone,
      role: usersTable.role,
      grade: usersTable.grade,
      creditScore: usersTable.creditScore,
      signupIp: usersTable.signupIp,
      lastLoginIp: usersTable.lastLoginIp,
      suspendedAt: usersTable.suspendedAt,
      deletedAt: usersTable.deletedAt,
      balance: walletsTable.balance,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .leftJoin(walletsTable, eq(usersTable.id, walletsTable.userId))
    .where(req.query.includeDeleted === "1" ? undefined : isNull(usersTable.deletedAt))
    .orderBy(desc(usersTable.id))
    .limit(limit)
    .offset(offset);

  res.json(users.map(u => ({
    id: u.id,
    email: u.email,
    nickname: u.nickname,
    name: u.name ?? null,
    phone: u.phone,
    role: u.role,
    grade: u.grade ?? null,
    creditScore: u.creditScore ?? 0,
    signupIp: u.signupIp,
    lastLoginIp: u.lastLoginIp,
    suspendedAt: u.suspendedAt,
    deletedAt: u.deletedAt,
    balance: u.balance !== null ? Number(u.balance) : null,
    createdAt: u.createdAt,
  })));
});

// 회원 계정 자체를 차단하거나 해제한다. IP 차단과 별도로 적용된다.
router.patch("/admin/users/:id/suspension", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1 || typeof req.body?.suspended !== "boolean") {
    res.status(400).json({ error: "회원과 차단 상태를 확인해 주세요." });
    return;
  }
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
  const [target] = await db.select({ id: usersTable.id, role: usersTable.role, deletedAt: usersTable.deletedAt })
    .from(usersTable).where(eq(usersTable.id, id));
  if (!target) {
    res.status(404).json({ error: "회원을 찾을 수 없습니다." });
    return;
  }
  if (target.role === "admin") {
    res.status(403).json({ error: "관리자 계정은 차단할 수 없습니다." });
    return;
  }
  if (target.deletedAt) { res.status(409).json({ error: "삭제된 회원은 기록 조회만 가능합니다." }); return; }
  const suspendedAt = req.body.suspended ? new Date() : null;
  await db.update(usersTable).set({ suspendedAt }).where(eq(usersTable.id, id));
  invalidateAccountSuspension(id);
  res.set("Cache-Control", "no-store");
  res.json({ id, suspendedAt });
});

// 전체 주문 목록
router.get("/admin/orders", async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = 50;
  const offset = (page - 1) * limit;
  const { status } = req.query;

  const filters = [isNull(ordersTable.adminHiddenAt)];
  if (req.query.includeDeleted !== "1") filters.push(isNull(ordersTable.adminDeletedAt));
  if (status && typeof status === "string") {
    if (!["pending", "shipped", "confirmed", "completed", "cancelled", "disputed"].includes(status)) {
      res.status(400).json({ error: "올바른 주문 상태가 아닙니다." }); return;
    }
    filters.push(eq(ordersTable.status, status as typeof ordersTable.$inferSelect["status"]));
  }
  const orders = await db.select().from(ordersTable).where(and(...filters))
    .orderBy(desc(ordersTable.id)).limit(limit).offset(offset);

  res.set("Cache-Control", "no-store");
  res.json(orders.map(o => ({
    id: o.id,
    buyerId: o.buyerId,
    sellerId: o.sellerId,
    productId: o.productId,
    productTitle: o.productTitle,
    amount: Number(o.amount),
    feeAmount: Number(o.feeAmount),
    canDelete: canRemoveAdminOrder(o),
    canHide: canHideAdminOrder(o),
    adminDeletedAt: o.adminDeletedAt,
    adminDeletedBy: o.adminDeletedBy,
    status: o.status,
    cancelReason: o.cancelReason,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  })));
});

router.delete("/admin/orders/:id", async (req, res): Promise<void> => {
  const adminSession =
    (!!req.session?.adminId && req.session.adminRole === "admin") ||
    (!!req.session?.userId && req.session.userRole === "admin");
  if (!adminSession) { res.status(403).json({ error: "관리자 로그인이 필요합니다." }); return; }
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: "올바른 주문 ID가 아닙니다." }); return; }
  const actor = req.session.adminId ? `admin:${req.session.adminId}` : `user:${req.session.userId}`;
  try {
    const outcome = await db.transaction(async tx => {
      const [order] = await tx.select().from(ordersTable).where(eq(ordersTable.id, id)).for("update");
      if (!order) return "missing";
      if (order.adminDeletedAt) return "removed";
      if (!canRemoveAdminOrder(order)) return "active";
      await tx.update(ordersTable).set({
        adminDeletedAt: new Date(), adminDeletedBy: actor, updatedAt: sql`${ordersTable.updatedAt}`,
      }).where(eq(ordersTable.id, id));
      return "removed";
    });
    if (outcome === "missing") { res.status(404).json({ error: "주문을 찾을 수 없습니다." }); return; }
    if (outcome === "active") { res.status(409).json({ error: "진행 중인 주문은 삭제할 수 없습니다. 완료 또는 취소 후 삭제해 주세요." }); return; }
    req.log.info({ orderId: id, actor }, "관리자 주문 목록 삭제; 정산 및 연결 기록 보존");
    res.json({ ok: true, preserved: true });
  } catch (error) {
    req.log.error({ err: error, orderId: id }, "관리자 주문 삭제 실패");
    res.status(500).json({ error: "주문을 삭제하지 못했습니다. 다시 시도해 주세요." });
  }
});

// Second-stage admin list cleanup never deletes the underlying order/evidence.
router.delete("/admin/orders/:id/list-entry", async (req, res): Promise<void> => {
  const adminSession =
    (!!req.session?.adminId && req.session.adminRole === "admin") ||
    (!!req.session?.userId && req.session.userRole === "admin");
  if (!adminSession) { res.status(403).json({ error: "관리자 로그인이 필요합니다." }); return; }
  const params = AdminHideOrderParams.safeParse(req.params);
  if (!params.success || !Number.isSafeInteger(params.data.id) || params.data.id < 1) {
    res.status(400).json({ error: "올바른 주문 ID가 아닙니다." }); return;
  }
  const id = params.data.id;
  const actor = req.session.adminId ? `admin:${req.session.adminId}` : `user:${req.session.userId}`;
  try {
    const outcome = await db.transaction(async tx => {
      const [order] = await tx.select().from(ordersTable).where(eq(ordersTable.id, id)).for("update");
      if (!order) return "missing";
      if (order.adminHiddenAt) return "hidden";
      if (!canHideAdminOrder(order)) return "protected";
      await tx.update(ordersTable).set({
        adminHiddenAt: new Date(), adminHiddenBy: actor, updatedAt: sql`${ordersTable.updatedAt}`,
      }).where(eq(ordersTable.id, id));
      return "hidden";
    });
    if (outcome === "missing") { res.status(404).json({ error: "주문을 찾을 수 없습니다." }); return; }
    if (outcome === "protected") {
      res.status(409).json({ error: "완료 또는 취소 후 이미 삭제된 주문만 목록에서 제거할 수 있습니다." }); return;
    }
    req.log.info({ orderId: id, actor }, "관리자 삭제 주문 목록에서 제거; 주문 및 정산·대화 기록 보존");
    res.set("Cache-Control", "no-store");
    res.json(AdminHideOrderResponse.parse({ ok: true, preserved: true }));
  } catch (error) {
    req.log.error({ err: error, orderId: id }, "관리자 삭제 주문 목록 제거 실패");
    res.status(500).json({ error: "주문을 목록에서 제거하지 못했습니다. 다시 시도해 주세요." });
  }
});

// 출금 신청 목록
router.get("/admin/withdrawals", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const { status } = req.query;
  const conditions = [isNull(withdrawalsTable.adminDeletedAt)];
  if (status && typeof status === "string") {
    if (!["pending", "approved", "rejected"].includes(status)) {
      res.status(400).json({ error: "올바르지 않은 출금 상태입니다." }); return;
    }
    conditions.push(eq(withdrawalsTable.status, status as typeof withdrawalsTable.$inferSelect["status"]));
  }
  const withdrawals = await db.select().from(withdrawalsTable).where(and(...conditions));
  res.json(withdrawals.map(w => ({
    id: w.id,
    userId: w.userId,
    amount: Number(w.amount),
    method: w.method,
    bankName: w.bankName,
    accountNumber: w.accountNumber,
    accountHolder: w.accountHolder,
    phoneNumber: w.phoneNumber,
    status: w.status,
    adminNote: w.adminNote,
    processedAt: w.processedAt,
    createdAt: w.createdAt,
  })));
});

router.delete("/admin/withdrawals/:id", requirePolicyAdmin, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  if (req.headers["sec-fetch-site"] === "cross-site") {
    res.status(403).json({ error: "다른 사이트에서는 삭제할 수 없습니다." }); return;
  }
  const parsed = AdminRemoveWithdrawalParams.safeParse(req.params);
  if (!parsed.success || !Number.isSafeInteger(parsed.data.id)) {
    res.status(400).json({ error: "올바른 출금 ID가 아닙니다." }); return;
  }
  const id = parsed.data.id;
  const actor = req.session.adminId ? `admin:${req.session.adminId}` : `user:${req.session.userId}`;
  try {
    const outcome = await db.transaction(async tx => {
      const [withdrawal] = await tx.select().from(withdrawalsTable)
        .where(eq(withdrawalsTable.id, id)).for("update");
      if (!withdrawal) return "missing";
      if (withdrawal.status !== "approved" && withdrawal.status !== "rejected") return "pending";
      if (withdrawal.adminDeletedAt) return "removed";
      await tx.update(withdrawalsTable).set({
        adminDeletedAt: new Date(), adminDeletedBy: actor,
        updatedAt: sql`${withdrawalsTable.updatedAt}`,
      }).where(eq(withdrawalsTable.id, id));
      return "removed";
    });
    if (outcome === "missing") { res.status(404).json({ error: "출금 신청을 찾을 수 없습니다." }); return; }
    if (outcome === "pending") {
      res.status(409).json({ error: "대기 중인 출금은 삭제할 수 없습니다. 승인 또는 거절 처리 후 삭제해 주세요." }); return;
    }
    req.log.info({ withdrawalId: id, actor }, "관리자 출금 목록 삭제; 회원 내역 및 금액 보존");
    res.json(AdminRemoveWithdrawalResponse.parse({ ok: true, preserved: true }));
  } catch {
    req.log.error({ withdrawalId: id }, "관리자 출금 목록 삭제 실패");
    res.status(500).json({ error: "목록에서 삭제하지 못했습니다. 다시 시도해 주세요." });
  }
});

// 출금 처리 (승인/거절)
router.patch("/admin/withdrawals/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { status, adminNote } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "status는 approved 또는 rejected여야 합니다." });
    return;
  }

  const [withdrawal] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, id));
  if (!withdrawal) {
    res.status(404).json({ error: "출금 신청을 찾을 수 없습니다." });
    return;
  }
  if (withdrawal.status !== "pending") {
    res.status(400).json({ error: "이미 처리된 출금 신청입니다." });
    return;
  }

  const updated = await db.transaction(async (tx) => {
    const [w] = await tx
      .update(withdrawalsTable)
      .set({ status, adminNote: adminNote ?? null, processedAt: new Date() })
      .where(eq(withdrawalsTable.id, id))
      .returning();

    // 거절 시 잔액 환불
    if (status === "rejected") {
      await tx
        .update(walletsTable)
        .set({ balance: sql`${walletsTable.balance} + ${Number(withdrawal.amount)}` })
        .where(eq(walletsTable.userId, withdrawal.userId));
    }

    return w;
  });

  res.json({
    id: updated.id,
    userId: updated.userId,
    amount: Number(updated.amount),
    bankName: updated.bankName,
    accountNumber: updated.accountNumber,
    accountHolder: updated.accountHolder,
    status: updated.status,
    adminNote: updated.adminNote,
    processedAt: updated.processedAt,
    createdAt: updated.createdAt,
  });
});

// 인증상태 조회
router.get("/admin/users/:id/auth-states", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [user] = await db.select({ authStates: usersTable.authStates }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "회원을 찾을 수 없습니다." }); return; }
  res.json(user.authStates ?? { excellent: false, phone: false, email: false, ipin: false, withdraw: false });
});

// 인증상태 수정
router.put("/admin/users/:id/auth-states", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [target] = await db.select({ deletedAt: usersTable.deletedAt }).from(usersTable).where(eq(usersTable.id, id));
  if (!target) { res.status(404).json({ error: "회원을 찾을 수 없습니다." }); return; }
  if (target.deletedAt) { res.status(409).json({ error: "삭제된 회원은 기록 조회만 가능합니다." }); return; }
  const { excellent, phone, email, ipin, withdraw } = req.body as Record<string, boolean>;
  const authStates: AuthStates = {
    excellent: !!excellent,
    phone: !!phone,
    email: !!email,
    ipin: !!ipin,
    withdraw: !!withdraw,
  };
  const [updated] = await db
    .update(usersTable)
    .set({ authStates })
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id });
  if (!updated) { res.status(404).json({ error: "회원을 찾을 수 없습니다." }); return; }
  res.json(authStates);
});

// 마일리지(잔액) 수정
router.patch("/admin/users/:id/balance", requirePolicyAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: "잘못된 ID" }); return; }
  try {
    const balance = await changeMemberBalance(id, req.body);
    pushToUser(id, "balance", { balance });
    res.json({ balance });
  } catch (error) {
    if (error instanceof MemberActionError) { res.status(error.status).json({ error: error.message }); return; }
    req.log.error({ err: error }, "마일리지 수정 실패");
    res.status(500).json({ error: "마일리지 수정에 실패했습니다. 다시 시도해 주세요." });
  }
});

// 회원 정보 수정 (닉네임, 전화번호, 이메일, 역할)
router.post("/admin/users/:id/password-view", requirePolicyAdmin, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const id = Number(req.params.id);
  const adminPassword = req.body?.adminPassword;
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
    res.status(400).json({ error: "잘못된 회원 ID입니다." }); return;
  }
  if (typeof adminPassword !== "string" || !adminPassword || adminPassword.length > 128) {
    res.status(400).json({ error: "관리자 본인의 비밀번호를 입력하세요." }); return;
  }
  const actorId = req.session.adminId ?? req.session.userId!;
  try {
    const [actor] = await db.select({ passwordHash: usersTable.passwordHash })
      .from(usersTable).where(eq(usersTable.id, actorId));
    if (!actor || !(await bcrypt.compare(adminPassword, actor.passwordHash))) {
      res.status(403).json({ error: "관리자 비밀번호가 올바르지 않습니다." }); return;
    }
    const [target] = await db.select({ role: usersTable.role, deletedAt: usersTable.deletedAt })
      .from(usersTable).where(eq(usersTable.id, id));
    if (!target) { res.status(404).json({ error: "회원을 찾을 수 없습니다." }); return; }
    if (target.role === "admin" || target.deletedAt) {
      res.status(403).json({ error: "관리자 또는 삭제된 회원의 비밀번호는 조회할 수 없습니다." }); return;
    }
    const [original] = await db.select({ password: memberPasswordOriginalsTable.password })
      .from(memberPasswordOriginalsTable).where(eq(memberPasswordOriginalsTable.userId, id));
    req.log.info({ adminId: actorId, memberId: id }, "관리자가 회원 비밀번호를 조회했습니다");
    res.json({ userId: id, password: original?.password ?? null });
  } catch {
    req.log.error({ adminId: actorId, memberId: id }, "회원 비밀번호 조회 실패");
    res.status(500).json({ error: "비밀번호를 조회하지 못했습니다." });
  }
});

router.post("/admin/users/:id/password-reset", requirePolicyAdmin, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const id = Number(req.params.id);
  const { identityVerified, adminPassword } = req.body ?? {};
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
    res.status(400).json({ error: "잘못된 회원 ID입니다." }); return;
  }
  if (identityVerified !== true) {
    res.status(400).json({ error: "회원 본인 확인 후 재설정해 주세요." }); return;
  }
  if (typeof adminPassword !== "string" || !adminPassword || adminPassword.length > 128) {
    res.status(400).json({ error: "관리자 본인의 비밀번호를 입력하세요." }); return;
  }
  const actorId = req.session.adminId ?? req.session.userId!;
  try {
    const [actor] = await db.select({ passwordHash: usersTable.passwordHash })
      .from(usersTable).where(eq(usersTable.id, actorId));
    if (!actor || !(await bcrypt.compare(adminPassword, actor.passwordHash))) {
      res.status(403).json({ error: "관리자 비밀번호가 올바르지 않습니다." }); return;
    }
    const temporaryPassword = await resetMemberPassword(id);
    disconnectSSEClients(id);
    req.log.info({ adminId: actorId, memberId: id }, "관리자가 회원 임시 비밀번호를 발급했습니다");
    res.json({ userId: id, temporaryPassword });
  } catch (error) {
    if (error instanceof MemberPasswordError) {
      res.status(error.status).json({ error: error.message }); return;
    }
    // SQL errors can include parameter values: do not log the error or response payload.
    req.log.error({ adminId: actorId, memberId: id }, "회원 비밀번호 재설정 실패");
    res.status(500).json({ error: "비밀번호를 재설정하지 못했습니다." });
  }
});

router.patch("/admin/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "잘못된 ID" }); return; }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) { res.status(404).json({ error: "회원을 찾을 수 없습니다." }); return; }
  if (target.deletedAt) { res.status(409).json({ error: "삭제된 회원은 기록 조회만 가능합니다." }); return; }

  const { nickname, name, phone, email, role, grade, creditScore } = req.body as Record<string, string>;
  const updates: Partial<typeof usersTable.$inferInsert> = {};

  if (nickname !== undefined) updates.nickname = String(nickname).trim();
  if (name !== undefined) updates.name = name ? String(name).trim() : null;
  if (phone !== undefined) updates.phone = phone ? String(phone).trim() : null;
  if (email !== undefined && email.trim()) updates.email = String(email).trim();
  if (role !== undefined && ["user", "admin"].includes(role)) {
    updates.role = role as "user" | "admin";
  }
  if (grade !== undefined) {
    const VALID_GRADES = ["vip", "platinum", "gold", "silver", "bronze"];
    updates.grade = (grade && VALID_GRADES.includes(grade)) ? grade : null;
  }
  if (creditScore !== undefined) {
    const score = parseInt(String(creditScore), 10);
    updates.creditScore = isNaN(score) ? 0 : Math.max(0, score);
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "수정할 필드가 없습니다." }); return;
  }

  try {
    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, id))
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        nickname: usersTable.nickname,
        name: usersTable.name,
        phone: usersTable.phone,
        role: usersTable.role,
        grade: usersTable.grade,
      creditScore: usersTable.creditScore,
      });
    pushToUser(id, "nickname", { nickname: updated.nickname });
    pushToUser(id, "grade", { grade: updated.grade ?? null });
    pushToUser(id, "credit_score", { score: updated.creditScore ?? 0 });
    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique")) {
      res.status(409).json({ error: "이미 사용 중인 이메일입니다." });
    } else {
      res.status(500).json({ error: "수정에 실패했습니다." });
    }
  }
});

// 회원 삭제
router.delete("/admin/users/:id", requirePolicyAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: "잘못된 ID" }); return; }
  try {
    await removeMember(id, (req.session.adminId ?? req.session.userId)!);
    invalidateAccountSuspension(id);
    disconnectSSEClients(id);
    res.json({ ok: true, archived: true, message: "회원이 삭제되었습니다. 잔액·정산·거래·대화 기록은 보존됩니다." });
  } catch (error) {
    if (error instanceof MemberActionError) { res.status(error.status).json({ error: error.message }); return; }
    req.log.error({ err: error }, "회원 삭제 실패");
    res.status(500).json({ error: "회원 삭제에 실패했습니다. 기록은 변경되지 않았습니다." });
  }
});

// ── 상품 관리 ──────────────────────────────────────────────────────

// 전체 상품 목록
router.get("/admin/products", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const page  = Math.max(1, parseInt(String(req.query.page  ?? "1"),  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10));
  const offset = (page - 1) * limit;
  const category = req.query.category as string | undefined;
  const status   = req.query.status   as string | undefined;

  const where = and(
    isNull(productsTable.adminHiddenAt),
    category ? eq(productsTable.category, category as "sell" | "buy") : undefined,
    // Archived trade listings remain available under the explicit inactive filter
    // for audit/history, but should disappear from the normal admin list.
    status   ? eq(productsTable.status, status as "active" | "sold" | "inactive")
             : sql`${productsTable.status} <> 'inactive'`,
  );

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(where);

  const rows = await db
    .select()
    .from(productsTable)
    .where(where)
    .orderBy(desc(productsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({
    products: rows.map(p => ({
      id: p.id,
      itemmaniaid: p.itemmaniaid,
      title: p.title,
      price: Number(p.price),
      category: p.category,
      gameName: p.gameName,
      sellerName: p.sellerName,
      description: p.description,
      status: p.status,
      createdAt: p.createdAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// 상품 등록 (어드민)
router.post("/admin/products", async (req, res): Promise<void> => {
  const { title, price, gameName, category, description, sellerName } = req.body as Record<string, string>;
  if (!title || !price) {
    res.status(400).json({ error: "title과 price는 필수입니다." });
    return;
  }
  const priceNum = parseInt(String(price), 10);
  if (isNaN(priceNum) || priceNum <= 0) {
    res.status(400).json({ error: "price는 양수여야 합니다." });
    return;
  }
  const itemmaniaid = `admin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const [inserted] = await db.insert(productsTable).values({
    itemmaniaid,
    title: String(title).trim(),
    price: priceNum,
    gameName: gameName ? String(gameName).trim() : null,
    category: category ? String(category).trim() : "sell",
    sellerName: sellerName ? String(sellerName).trim() : null,
    description: description ? String(description).trim() : null,
    status: "active",
  }).returning();
  res.status(201).json({ id: inserted.id, itemmaniaid: inserted.itemmaniaid, title: inserted.title });
});

// 상품 상태 변경 / 수정
router.patch("/admin/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const { status, title, price, gameName, category, description, sellerName } = req.body as Record<string, string>;

  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!existing) { res.status(404).json({ error: "상품을 찾을 수 없습니다." }); return; }

  const updates: Partial<typeof productsTable.$inferInsert> = {};
  if (status && ["active","sold","inactive"].includes(status)) updates.status = status as "active"|"sold"|"inactive";
  if (title) updates.title = String(title).trim();
  if (price) { const n = parseInt(String(price), 10); if (!isNaN(n) && n > 0) updates.price = n; }
  if (gameName !== undefined) updates.gameName = gameName ? String(gameName).trim() : null;
  if (category) updates.category = String(category).trim();
  if (description !== undefined) updates.description = description ? String(description).trim() : null;
  if (sellerName !== undefined) updates.sellerName = sellerName ? String(sellerName).trim() : null;

  const [updated] = await db.update(productsTable).set(updates)
    .where(and(eq(productsTable.id, id), isNull(productsTable.adminHiddenAt))).returning();
  if (!updated) { res.status(404).json({ error: "상품을 찾을 수 없거나 관리자 목록에서 삭제된 상품입니다." }); return; }
  res.json({ id: updated.id, status: updated.status, title: updated.title });
});

// 상품 삭제
const productHasTradeHistory = sql`(
  EXISTS (SELECT 1 FROM chat_rooms WHERE chat_rooms.product_id = ${productsTable.id})
  OR EXISTS (SELECT 1 FROM orders WHERE orders.product_id = ${productsTable.id})
)`;

router.delete("/admin/products/no-grade", async (_req, res): Promise<void> => {
  try {
    const result = await db.transaction(async tx => {
      // Product locks serialize this cleanup against chat/order creation.
      await tx.select({ id: productsTable.id }).from(productsTable)
        .where(and(sql`${productsTable.sellerGrade} IS NULL`, isNull(productsTable.adminHiddenAt))).for("update");
      const archived = await tx.update(productsTable).set({ status: "inactive" })
        .where(and(sql`${productsTable.sellerGrade} IS NULL`, isNull(productsTable.adminHiddenAt), productHasTradeHistory))
        .returning({ id: productsTable.id });
      const deleted = await tx.delete(productsTable)
        .where(and(sql`${productsTable.sellerGrade} IS NULL`, isNull(productsTable.adminHiddenAt), sql`NOT ${productHasTradeHistory}`))
        .returning({ id: productsTable.id });
      return { deleted: deleted.length, archived: archived.length };
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    logger.error({ err: error }, "등급 없는 상품 삭제 실패");
    res.status(500).json({ error: "상품을 삭제하지 못했습니다. 다시 시도해 주세요." });
  }
});

router.delete("/admin/products/:id/list-entry", requirePolicyAdmin, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  if (req.headers["sec-fetch-site"] === "cross-site") {
    res.status(403).json({ error: "다른 사이트에서는 삭제할 수 없습니다." }); return;
  }
  const parsed = AdminHideInactiveProductParams.safeParse(req.params);
  if (!parsed.success || !Number.isSafeInteger(parsed.data.id)) {
    res.status(400).json({ error: "올바른 상품 ID가 아닙니다." }); return;
  }
  const id = parsed.data.id;
  const actor = req.session.adminId ? `admin:${req.session.adminId}` : `user:${req.session.userId}`;
  try {
    const outcome = await db.transaction(async tx => {
      const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, id)).for("update");
      if (!product) return "missing";
      if (product.adminHiddenAt) return "hidden";
      if (product.status !== "inactive") return "active";
      await tx.update(productsTable).set({
        adminHiddenAt: new Date(), adminHiddenBy: actor, updatedAt: sql`${productsTable.updatedAt}`,
      }).where(eq(productsTable.id, id));
      return "hidden";
    });
    if (outcome === "missing") { res.status(404).json({ error: "상품을 찾을 수 없습니다." }); return; }
    if (outcome === "active") {
      res.status(409).json({ error: "비활성 상품만 목록에서 삭제할 수 있습니다. 상품 상태를 확인해 주세요." }); return;
    }
    req.log.info({ productId: id, actor }, "비활성 상품 관리자 목록 삭제; 상품 및 거래 기록 보존");
    res.json(AdminHideInactiveProductResponse.parse({ ok: true, hidden: true, preserved: true }));
  } catch {
    req.log.error({ productId: id }, "비활성 상품 관리자 목록 삭제 실패");
    res.status(500).json({ error: "상품을 목록에서 삭제하지 못했습니다. 다시 시도해 주세요." });
  }
});

router.delete("/admin/products/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    res.status(400).json({ error: "올바른 상품 ID가 아닙니다." });
    return;
  }
  try {
    const result = await db.transaction(async tx => {
      const [product] = await tx.select({ id: productsTable.id, adminHiddenAt: productsTable.adminHiddenAt })
        .from(productsTable).where(eq(productsTable.id, id)).for("update");
      if (!product) return null;
      if (product.adminHiddenAt) return { archived: true, hidden: true };
      const [linkedChat] = await tx.select({ id: chatRoomsTable.id }).from(chatRoomsTable)
        .where(eq(chatRoomsTable.productId, id)).limit(1);
      const [linkedOrder] = await tx.select({ id: ordersTable.id }).from(ordersTable)
        .where(eq(ordersTable.productId, id)).limit(1);
      if (linkedChat || linkedOrder) {
        await tx.update(productsTable).set({ status: "inactive" }).where(eq(productsTable.id, id));
        return { archived: true };
      }
      await tx.delete(productsTable).where(eq(productsTable.id, id));
      return { archived: false };
    });
    if (!result) {
      res.status(404).json({ error: "상품을 찾을 수 없습니다." });
      return;
    }
    res.json({ ok: true, ...result });
  } catch (error) {
    logger.error({ err: error, productId: id }, "상품 삭제 실패");
    res.status(500).json({ error: "상품을 삭제하지 못했습니다. 다시 시도해 주세요." });
  }
});

// 전체 채팅 거래 내역
router.get("/admin/chat-rooms", async (req, res): Promise<void> => {
  const rooms = await db
    .select({
      id: chatRoomsTable.id,
      orderId: chatRoomsTable.orderId,
      adminDeletedAt: chatRoomsTable.adminDeletedAt,
      adminDeletedBy: chatRoomsTable.adminDeletedBy,
      adminHiddenAt: chatRoomsTable.adminHiddenAt,
      sellerId: chatRoomsTable.sellerId,
      buyerId: chatRoomsTable.buyerId,
      productId: chatRoomsTable.productId,
      status: chatRoomsTable.status,
      createdAt: chatRoomsTable.createdAt,
      sellerNickname: sql<string>`(SELECT nickname FROM users WHERE id = ${chatRoomsTable.sellerId})`,
      buyerNickname:  sql<string>`(SELECT nickname FROM users WHERE id = ${chatRoomsTable.buyerId})`,
      productTitle:   sql<string>`(SELECT title FROM products WHERE id = ${chatRoomsTable.productId})`,
      amount:         sql<number>`(SELECT price FROM products WHERE id = ${chatRoomsTable.productId})`,
    })
    .from(chatRoomsTable)
    .where(and(
      isNull(chatRoomsTable.adminHiddenAt),
      req.query.includeDeleted === "1" ? undefined : isNull(chatRoomsTable.adminDeletedAt),
    ))
    .orderBy(desc(chatRoomsTable.createdAt));

  res.set("Cache-Control", "no-store");
  res.json(rooms.map(r => ({
    id: r.id,
    orderId: r.orderId,
    canDelete: canRemoveAdminChat(r),
    canHide: canHideAdminChat(r),
    adminDeletedAt: r.adminDeletedAt,
    adminDeletedBy: r.adminDeletedBy,
    sellerId: r.sellerId,
    buyerId: r.buyerId,
    sellerNickname: r.sellerNickname ?? null,
    buyerNickname:  r.buyerNickname  ?? null,
    productTitle:   r.productTitle   ?? null,
    amount:         r.amount ? Number(r.amount) : null,
    status:         r.status,
    createdAt:      r.createdAt,
  })));
});

// Admin list removal is separate from member dismissal and financial state.
router.delete("/admin/chat-rooms/:id", async (req, res): Promise<void> => {
  // The shared admin guard also permits the crawler key; it must not authorize
  // irreversible deletion.
  const adminSession =
    (!!req.session?.adminId && req.session.adminRole === "admin") ||
    (!!req.session?.userId && req.session.userRole === "admin");
  if (!adminSession) {
    res.status(403).json({ error: "관리자 로그인이 필요합니다." });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    res.status(400).json({ error: "올바른 채팅방 ID가 아닙니다." });
    return;
  }
  const actor = req.session.adminId ? `admin:${req.session.adminId}` : `user:${req.session.userId}`;
  try {
    const outcome = await db.transaction(async tx => {
      // Serialize against checkout/completion without modifying its lifecycle.
      const [room] = await tx.select()
        .from(chatRoomsTable).where(eq(chatRoomsTable.id, id)).for("update");
      if (!room) return "missing";
      if (room.adminDeletedAt) return "deleted";
      if (!canRemoveAdminChat(room)) return "active";
      await tx.update(chatRoomsTable).set({ adminDeletedAt: new Date(), adminDeletedBy: actor })
        .where(eq(chatRoomsTable.id, id));
      return "deleted";
    });
    if (outcome === "missing") {
      res.status(404).json({ error: "이미 삭제되었거나 존재하지 않는 채팅방입니다." });
    } else if (outcome === "active") {
      res.status(409).json({ error: "진행 중인 주문에 연결된 채팅은 삭제할 수 없습니다. 거래 종료 후 삭제해 주세요." });
    } else {
      req.log.info({ chatRoomId: id, actor }, "관리자 채팅 목록 삭제; 대화 및 정산 기록 보존");
      res.json({ ok: true, preserved: true });
    }
  } catch (error) {
    req.log.error({ err: error, chatRoomId: id }, "채팅방 삭제 실패");
    res.status(500).json({ error: "채팅방을 삭제하지 못했습니다. 다시 시도해 주세요." });
  }
});

// Explicit second-stage visibility cleanup, never physical conversation removal.
router.delete("/admin/chat-rooms/:id/list-entry", async (req, res): Promise<void> => {
  const adminSession =
    (!!req.session?.adminId && req.session.adminRole === "admin") ||
    (!!req.session?.userId && req.session.userRole === "admin");
  if (!adminSession) { res.status(403).json({ error: "관리자 로그인이 필요합니다." }); return; }
  const params = AdminHideChatRoomParams.safeParse(req.params);
  if (!params.success || !Number.isSafeInteger(params.data.id) || params.data.id < 1) {
    res.status(400).json({ error: "올바른 채팅방 ID가 아닙니다." }); return;
  }
  const id = params.data.id;
  const actor = req.session.adminId ? `admin:${req.session.adminId}` : `user:${req.session.userId}`;
  try {
    const outcome = await db.transaction(async tx => {
      const [room] = await tx.select().from(chatRoomsTable)
        .where(eq(chatRoomsTable.id, id)).for("update");
      if (!room) return "missing";
      if (room.adminHiddenAt) return "hidden";
      if (!canHideAdminChat(room)) return "protected";
      await tx.update(chatRoomsTable).set({ adminHiddenAt: new Date(), adminHiddenBy: actor })
        .where(eq(chatRoomsTable.id, id));
      return "hidden";
    });
    if (outcome === "missing") { res.status(404).json({ error: "채팅방을 찾을 수 없습니다." }); return; }
    if (outcome === "protected") {
      res.status(409).json({ error: "종료 후 이미 삭제된 채팅거래만 목록에서 제거할 수 있습니다." }); return;
    }
    req.log.info({ chatRoomId: id, actor }, "관리자 삭제 채팅 목록에서 제거; 대화·거래·정산 보존");
    res.set("Cache-Control", "no-store");
    res.json(AdminHideChatRoomResponse.parse({ ok: true, preserved: true }));
  } catch (error) {
    req.log.error({ err: error, chatRoomId: id }, "관리자 채팅 목록 제거 실패");
    res.status(500).json({ error: "채팅거래를 목록에서 제거하지 못했습니다. 다시 시도해 주세요." });
  }
});

// 대시보드 통계
router.get("/admin/stats", async (_req, res): Promise<void> => {
  const [[userCount], [productCount], [orderCount], [pendingOrderCount], [totalRevenue]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(isNull(usersTable.deletedAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(eq(productsTable.status, "active")),
    db.select({ count: sql<number>`count(*)::int` }).from(ordersTable),
    db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(eq(ordersTable.status, "pending")),
    db.select({ total: sql<number>`coalesce(sum(amount),0)::bigint` }).from(ordersTable).where(eq(ordersTable.status, "completed")),
  ]);

  res.json({
    users: userCount.count,
    products: productCount.count,
    orders: orderCount.count,
    pendingOrders: pendingOrderCount.count,
    revenue: Number(totalRevenue.total),
  });
});

// ─── 크롤러 설정 ───────────────────────────────────────────────────────────────
const GAME_LIST: { id: number; name: string; slug: string }[] = [
  { id: 2696, name: "로스트아크",         slug: "lostark" },
  { id: 138,  name: "메이플스토리",       slug: "maplestory" },
  { id: 5233, name: "메이플스토리월드",   slug: "maplestory-world" },
  { id: 281,  name: "던전앤파이터",       slug: "dnf" },
  { id: 5913, name: "리니지클래식",       slug: "lineage-classic" },
  { id: 3449, name: "리니지M",            slug: "lineage-m" },
  { id: 4696, name: "오딘",               slug: "odin" },
  { id: 5799, name: "아이온2",            slug: "aion2" },
  { id: 155,  name: "마비노기",           slug: "mabinogi" },
  { id: 101,  name: "거상",               slug: "geosang" },
  { id: 5990, name: "메이플랜드",         slug: "mapleland" },
];

function parseDetailFromHtml(html: string): {
  description: string | null;
  thumbnailUrl: string | null;
  sellerName: string | null;
} {
  let description: string | null = null;
  let thumbnailUrl: string | null = null;

  const ldBlocks = html.match(/<script type=application\/ld\+json>([\s\S]*?)<\/script>/g) || [];
  for (const block of ldBlocks) {
    try {
      const inner = block.replace(/<script type=application\/ld\+json>/, "").replace(/<\/script>/, "");
      const data = JSON.parse(inner) as Record<string, unknown>;
      const graph = data["@graph"] as Array<Record<string, unknown>> | undefined;
      if (!graph) continue;
      const product = graph.find(n => n["@type"] === "Product");
      if (!product) continue;

      if (typeof product["description"] === "string") {
        description = product["description"].trim() || null;
      }
      const img = typeof product["image"] === "string" ? product["image"] : null;
      if (img && !img.includes("/common/") && !img.includes("og_")) {
        thumbnailUrl = img;
      }
      break;
    } catch {
      // ignore parse errors
    }
  }

  const $ = cheerio.load(html);
  const sellerEl = $(".user_nick").first().text().trim()
    || $(".user_info strong:not(.vip_txt)").first().text().trim()
    || null;
  const sellerName = sellerEl || null;

  return { description, thumbnailUrl, sellerName };
}

const KST_OFFSET_MS = 9 * 3600000; // KST = UTC + 9h

function parseRegDate(txt: string): Date | null {
  if (!txt) return null;
  txt = txt.trim();
  const now = Date.now();
  let m: RegExpMatchArray | null;
  if ((m = txt.match(/^(\d+)초\s*전$/))) return new Date(now - parseInt(m[1]) * 1000);
  if ((m = txt.match(/^(\d+)분\s*전$/))) return new Date(now - parseInt(m[1]) * 60000);
  if ((m = txt.match(/^(\d+)시간\s*전$/))) return new Date(now - parseInt(m[1]) * 3600000);
  if ((m = txt.match(/^(\d{1,2}):(\d{2})$/))) {
    // itemmania 시간은 KST → UTC로 변환해서 저장
    const kstNow = new Date(now + KST_OFFSET_MS);
    // KST 기준 오늘 날짜에 해당 시각(HH:MM KST)의 UTC 타임스탬프
    const utcMs = Date.UTC(
      kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(),
      parseInt(m[1]), parseInt(m[2]), 0, 0
    ) - KST_OFFSET_MS;
    if (utcMs > now) return new Date(utcMs - 86400000); // 아직 안 온 시각이면 어제
    return new Date(utcMs);
  }
  if ((m = txt.match(/^(\d{1,2})\/(\d{1,2})$/))) {
    // MM/DD는 KST 날짜 기준, 시각은 KST 자정(00:00)으로 처리
    const kstNow = new Date(now + KST_OFFSET_MS);
    const utcMs = Date.UTC(kstNow.getUTCFullYear(), parseInt(m[1]) - 1, parseInt(m[2]), 0, 0, 0, 0) - KST_OFFSET_MS;
    if (utcMs > now) return new Date(Date.UTC(kstNow.getUTCFullYear() - 1, parseInt(m[1]) - 1, parseInt(m[2]), 0, 0, 0, 0) - KST_OFFSET_MS);
    return new Date(utcMs);
  }
  return null;
}

function parseProductsFromHtml(html: string, gameId: number, category: "sell" | "buy" = "sell"): Array<{
  itemmaniaid: string;
  title: string;
  price: number;
  gameName: string;
  serverName: string;
  category: string;
  itemCategory: string;
  detailUrl: string;
  sellerGrade: string | null;
  isPremium: boolean | null;
  description: string | null;
  originalCreatedAt: Date | null;
}> {
  const $ = cheerio.load(html);
  const products: ReturnType<typeof parseProductsFromHtml> = [];
  const seenIds = new Set<string>();
  const gameFallbackName = GAME_LIST.find(g => g.id === gameId)?.name || "";
  const GRADE_CLASS_MAP: Record<string, string> = {
    vip: "vip", platinum: "platinum", gold: "gold", silver: "silver", bronze: "bronze",
  };

  // 전략 1: li[data-tid] — 실제 data-tid 속성이 있는 모든 요소
  $("[data-tid]").each((_i, el) => {
    const tid = $(el).attr("data-tid");
    if (!tid || seenIds.has(tid) || $(el).hasClass("skeleton-item") || $(el).hasClass("block_item") || $(el).closest(".block_item").length) return;
    const gameName = $(el).find("[data-search=game]").first().text().trim();
    const serverName = $(el).find("[data-search=server]").first().attr("data-title")
      || $(el).find("[data-search=server]").first().text().trim();
    const itemCategory = $(el).find("[data-search=goods]").first().text().trim();
    const title = $(el).find(".kind_title").first().text().trim()
      || $(el).find(".tit").first().text().trim()
      || $(el).find("strong").first().text().trim();
    // 가격: "500원 (100만당)" / "10,000원" 등에서 첫 번째 숫자 덩어리만 추출
    const priceRaw = $(el).find(".trade_money").first().text().trim()
      || $(el).find(".price").first().text().trim();
    const priceMatch = priceRaw.match(/^([0-9,]+)/);
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ""), 10) : 0;
    if (!title) return;
    const premiumSection = $(el).closest(".search_list_premium").length > 0;
    const normalSection = $(el).closest(".search_list_normal").length > 0;
    // 판매자 등급 파싱: credit_mark_new 클래스에서 추출
    let sellerGrade: string | null = null;
    const markEl = $(el).find(".credit_mark_new, .credit_mark").first();
    if (markEl.length) {
      const cls = (markEl.attr("class") || "").split(/\s+/);
      for (const c of cls) {
        if (GRADE_CLASS_MAP[c]) { sellerGrade = GRADE_CLASS_MAP[c]; break; }
      }
    }
    // 수량 범위 파싱: .col.quantity 또는 .quantity_box 등
    const quantityText = $(el).find(".col.quantity, .quantity_box, .trade_quantity").first().text().trim() || null;
    // 원본 등록 시간 파싱
    const regDateText = $(el).find(".col.reg_date, .reg_date").first().text().trim();
    const originalCreatedAt = parseRegDate(regDateText);
    seenIds.add(tid);
    products.push({
      itemmaniaid: tid,
      title,
      price,
      gameName: gameFallbackName || gameName,
      serverName: serverName || "",
      category: category,
      itemCategory: itemCategory || "",
      detailUrl: `https://www.itemmania.com/${category}/application.html?id=${tid}`,
      sellerGrade,
      isPremium: premiumSection ? true : normalSection ? false : null,
      description: quantityText,
      originalCreatedAt,
    });
  });

  if (products.length > 0) return products;

  // 전략 2: __NEXT_DATA__ embedded JSON 파싱
  const nextDataEl = $("script#__NEXT_DATA__").first().html();
  if (nextDataEl) {
    try {
      const nextData = JSON.parse(nextDataEl);
      // 상품 목록이 있을 수 있는 경로들 탐색
      const lists: unknown[] = [];
      const search = (obj: unknown) => {
        if (!obj || typeof obj !== "object") return;
        if (Array.isArray(obj)) {
          if (obj.length > 0 && typeof obj[0] === "object" && obj[0] !== null) {
            const first = obj[0] as Record<string, unknown>;
            if ("tid" in first || "id" in first || "title" in first || "price" in first) {
              lists.push(...obj);
            }
          }
          obj.forEach(search);
        } else {
          Object.values(obj).forEach(search);
        }
      };
      search(nextData);
      for (const item of lists) {
        if (!item || typeof item !== "object") continue;
        const it = item as Record<string, unknown>;
        const tid = String(it["tid"] || it["id"] || it["sell_id"] || "");
        const title = String(it["title"] || it["name"] || it["goods_name"] || "");
        if (!tid || !title) continue;
        const price = parseInt(String(it["price"] || it["sell_price"] || 0), 10) || 0;
        products.push({
          itemmaniaid: tid,
          title,
          price,
          gameName: gameFallbackName || String(it["game_name"] || it["gameName"] || ""),
          serverName: String(it["server_name"] || it["serverName"] || ""),
          category: category,
          itemCategory: String(it["goods_kind"] || it["itemCategory"] || ""),
          detailUrl: `https://www.itemmania.com/${category}/application.html?id=${tid}`,
          sellerGrade: null,
          isPremium: null,
          description: null,
          originalCreatedAt: null,
        });
      }
    } catch { /* ignore */ }
  }

  return products;
}

// 크롤링 API
router.post("/admin/crawl", async (req, res): Promise<void> => {
  const { gameIds, pages = 1, scraperApiKey, crawlDetail = false } = req.body as {
    gameIds?: number[];
    pages?: number;
    scraperApiKey?: string;
    crawlDetail?: boolean;
  };

  const provider = resolveCrawlProvider(scraperApiKey);
  if (!provider) {
    res.status(400).json({ error: "Firecrawl 연결이 없습니다. FIRECRAWL_API_KEY를 Secrets에 등록하세요." });
    return;
  }
  const job: CrawlJob = {
    id: `sync_${Date.now()}`, status: "running",
    totalGames: 0, totalPages: 0, totalSteps: 1,
    games: [], completedSteps: 0, totalSaved: 0, totalFailed: 0,
    detailFetched: 0, detailFailed: 0, logs: [], startedAt: Date.now(),
  };
  await runCrawlJob(job, gameIds ?? [], pages, provider, crawlDetail);
  res.json({
    ok: job.status === "done" && job.totalFailed === 0,
    upserted: job.totalSaved, failed: job.totalFailed,
    detailFetched: job.detailFetched, detailFailed: job.detailFailed,
    log: job.logs.map(entry => entry.message),
  });
});

// 크롤링 SSE 스트리밍 (실시간 진행상황)
// 크롤링 백그라운드 작업 시작
router.post("/admin/crawl/start", async (req, res): Promise<void> => {
  const { gameIds = [], pages = 1, scraperApiKey, crawlDetail = false } = req.body as {
    gameIds?: number[]; pages?: number; scraperApiKey?: string; crawlDetail?: boolean;
  };
  const provider = resolveCrawlProvider(scraperApiKey);
  if (!provider) {
    res.status(400).json({ error: "Firecrawl 연결이 없습니다. FIRECRAWL_API_KEY를 Secrets에 등록하세요." });
    return;
  }
  const jobId = `crawl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const job: CrawlJob = {
    id: jobId, status: "running",
    totalGames: 0, totalPages: 0, totalSteps: 1,
    games: [], completedSteps: 0, totalSaved: 0, totalFailed: 0, detailFetched: 0, detailFailed: 0,
    logs: [], startedAt: Date.now(),
  };
  crawlJobs.set(jobId, job);
  // 백그라운드 실행 (await 없음 — 연결과 무관하게 계속 실행)
  runCrawlJob(job, gameIds, pages, provider, crawlDetail).catch(err => {
    job.status = "failed";
    job.finishedAt = Date.now();
    jobPush(job, { type: "fail", message: `❌ 치명적 오류: ${err?.message ?? err}`, completedSteps: job.completedSteps, totalSteps: job.totalSteps, totalSaved: job.totalSaved, totalFailed: job.totalFailed });
  });
  res.json({ jobId });
});

// 크롤링 작업 상태 polling
router.get("/admin/crawl/status/:jobId", (req, res): void => {
  const job = crawlJobs.get(req.params.jobId);
  if (!job) { res.status(404).json({ error: "작업을 찾을 수 없습니다 (만료되었거나 존재하지 않음)" }); return; }
  const since = parseInt(String(req.query.since ?? "0"), 10);
  const newLogs = since > 0 ? job.logs.filter(l => l.ts > since) : job.logs;
  res.json({
    id: job.id, status: job.status,
    totalGames: job.totalGames, totalPages: job.totalPages, totalSteps: job.totalSteps,
    games: job.games,
    completedSteps: job.completedSteps, totalSaved: job.totalSaved,
    totalFailed: job.totalFailed, detailFetched: job.detailFetched, detailFailed: job.detailFailed,
    startedAt: job.startedAt, finishedAt: job.finishedAt,
    logs: newLogs,
  });
});


// itemmania.com AJAX API 자동 탐지
router.get("/admin/crawl/discover", async (req, res): Promise<void> => {
  const scraperApiKey = String(req.query.scraperApiKey ?? "");
  const gameId = parseInt(String(req.query.gameId ?? "138"), 10);
  const provider = resolveCrawlProvider(scraperApiKey);
  if (!provider) {
    res.status(400).json({ error: "Firecrawl 연결이 없습니다" });
    return;
  }

  const listUrl = `https://www.itemmania.com/sell/list.html?search_game=${gameId}&search_goods=all&page=1`;
  const { text: html, error } = await fetchCrawlHtml(listUrl, provider);

  if (!html) {
    res.status(500).json({ error: `HTML 가져오기 실패: ${error}` });
    return;
  }

  // script src URL 추출
  const allSrcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
  const externalSrcs = allSrcs.filter(s => s.includes("itemmania.com") || (s.startsWith("/") && !s.startsWith("//")));

  // HTML 자체에서 URL 패턴 탐색
  const ajaxInHtml = [...html.matchAll(/["'](\/?[a-zA-Z0-9_\-/]+(?:\.php|\.ajax|ajax|list|goods)[^"']{0,80})["']/g)]
    .map(m => m[1])
    .filter(u => u.length > 4 && !u.includes(" ") && (u.includes("list") || u.includes("ajax") || u.includes(".php")))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 20);

  // JS 파일 가져와서 API 패턴 탐색
  const jsFindings: Array<{ url: string; patterns: string[] }> = [];
  for (const src of (provider.kind === "scraperapi" ? externalSrcs.slice(0, 4) : [])) {
    const jsUrl = src.startsWith("http") ? src : `https://www.itemmania.com${src}`;
    const { text: jsText } = await scraperFetch(jsUrl, provider.key, 20000);
    if (!jsText || jsText.length < 100) continue;

    const patterns = [
      ...[...jsText.matchAll(/["'](\/?[a-zA-Z0-9_\-/]+(?:list|goods|sell|ajax|\.php)[a-zA-Z0-9_\-/?=&.]{0,80})["']/g)].map(m => m[1]),
      ...[...jsText.matchAll(/url\s*[=:]\s*["']([^"']+)["']/gi)].map(m => m[1]).filter(u => u.includes("itemmania") || u.startsWith("/")),
    ]
      .filter(u => u.length > 5 && !u.includes(" "))
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 25);

    if (patterns.length > 0) jsFindings.push({ url: src, patterns });
  }

  res.json({
    htmlSize: html.length,
    listItemCount: (html.match(/list_item/g) ?? []).length,
    dataTidCount: (html.match(/data-tid=/g) ?? []).length,
    hasNextData: html.includes("__NEXT_DATA__"),
    scriptSrcs: externalSrcs,
    ajaxInHtml,
    jsFindings,
  });
});

// 크롤링 대상 게임 목록
router.get("/admin/crawl/games", (_req, res): void => {
  const provider = resolveCrawlProvider();
  res.json({ games: GAME_LIST, hasApiKey: !!provider, provider: provider?.kind ?? null });
});

// 로컬 크롤러 배치 upsert (itemmaniaid 기준 중복 방지)
router.post("/admin/crawl/batch", async (req, res): Promise<void> => {
  // X-Crawl-Key 헤더 또는 어드민 세션 인증
  const crawlKey = req.headers["x-crawl-key"] as string | undefined;
  const isAdmin = req.session?.userRole === "admin";
  if (!crawlKey && !isAdmin) { res.status(401).json({ error: "인증 필요" }); return; }
  if (crawlKey && crawlKey !== CRAWL_KEY) { res.status(401).json({ error: "CRAWL_KEY가 올바르지 않습니다" }); return; }

  const { products } = req.body as {
    products?: Array<{
      itemmaniaid: string;
      title: string;
      price: number;
      gameName?: string;
      serverName?: string;
      itemCategory?: string;
      category?: string;
      detailUrl?: string;
      description?: string;
      thumbnailUrl?: string;
      sellerName?: string;
      sellerGrade?: string;
      isPremium?: boolean | null;
      originalCreatedAt?: string;
    }>;
  };

  if (!Array.isArray(products) || products.length === 0) {
    res.json({ ok: true, upserted: 0, failed: 0 });
    return;
  }

  let upserted = 0;
  let failed = 0;

  for (const p of products) {
    // Batch imports are external Itemmania listings, never local user_ listings.
    if (!/^\d+$/.test(p.itemmaniaid) || !p.title) { failed++; continue; }
    if (p.isPremium === null) {
      const [existing] = await db.select({ id: productsTable.id }).from(productsTable)
        .where(eq(productsTable.itemmaniaid, p.itemmaniaid)).limit(1);
      if (!existing) { failed++; continue; }
    }
    const createdAt = p.originalCreatedAt ? new Date(p.originalCreatedAt) : undefined;
    const validCreatedAt = createdAt && !isNaN(createdAt.getTime()) ? createdAt : undefined;
    try {
      await db.insert(productsTable).values({
        itemmaniaid: p.itemmaniaid,
        title: p.title,
        price: Number(p.price) || 0,
        gameName: p.gameName || null,
        serverName: p.serverName || null,
        itemCategory: p.itemCategory || null,
        category: p.category || "sell",
        detailUrl: p.detailUrl || null,
        description: p.description || null,
        thumbnailUrl: p.thumbnailUrl || null,
        sellerName: p.sellerName || null,
        sellerGrade: p.sellerGrade || null,
        ...(p.isPremium !== undefined && p.isPremium !== null && { isPremium: p.isPremium }),
        status: "active",
        crawledAt: new Date(),
        ...(validCreatedAt && { createdAt: validCreatedAt }),
      }).onConflictDoUpdate({
        target: productsTable.itemmaniaid,
        set: {
          title: p.title,
          price: Number(p.price) || 0,
          gameName: p.gameName || null,
          serverName: p.serverName || null,
          itemCategory: p.itemCategory || null,
          detailUrl: p.detailUrl || null,
          sellerGrade: p.sellerGrade || null,
          ...(p.isPremium !== undefined && p.isPremium !== null && { isPremium: p.isPremium }),
          ...(p.description !== undefined && { description: p.description }),
          ...(p.thumbnailUrl !== undefined && { thumbnailUrl: p.thumbnailUrl }),
          ...(p.sellerName !== undefined && { sellerName: p.sellerName }),
          crawledAt: new Date(),
        },
      });
      upserted++;
    } catch {
      failed++;
    }
  }

  res.json({ ok: true, upserted, failed });
});

// ── 실시간 아이템매니아 상품 목록 (5분 인메모리 캐시) ────────────────────────
interface LiveListItem {
  tid: string;
  dbId?: number;
  isPremium: boolean | null;
  title: string;
  price: number;
  gameName: string;
  serverName: string;
  itemCategory: string;
  sellerGrade: string | null;
  description: string | null;
  timestamp: number;
}
interface LiveListCacheEntry {
  items: LiveListItem[];
  premiumItems: LiveListItem[];
  total: number;
  expireAt: number;
}
const liveListCache = new Map<string, LiveListCacheEntry>();

function parseLiveItemsFromHtml(html: string, gameId: number): LiveListItem[] {
  const $ = cheerio.load(html);
  const results: LiveListItem[] = [];
  const seenIds = new Set<string>();
  const gameFallbackName = GAME_LIST.find(g => g.id === gameId)?.name ?? "";
  const GRADE_CLASS_MAP: Record<string, string> = {
    vip: "vip", platinum: "platinum", gold: "gold", silver: "silver", bronze: "bronze",
  };

  $("[data-tid]").each((_i, el) => {
    const tid = $(el).attr("data-tid");
    if (!tid || seenIds.has(tid) || $(el).hasClass("skeleton-item")) return;
    const premiumSection = $(el).closest(".search_list_premium").length > 0;
    const normalSection = $(el).closest(".search_list_normal").length > 0;
    const gameName = $(el).find("[data-search=game]").first().text().trim() || gameFallbackName;
    const serverName = $(el).find("[data-search=server]").first().attr("data-title")
      || $(el).find("[data-search=server]").first().text().trim()
      || "";
    const itemCategory = $(el).find("[data-search=goods]").first().text().trim() || "";
    const title = $(el).find(".kind_title").first().text().trim()
      || $(el).find(".tit").first().text().trim()
      || $(el).find("strong").first().text().trim();
    if (!title) return;
    const priceRaw = $(el).find(".trade_money").first().text().trim()
      || $(el).find(".price").first().text().trim();
    const priceMatch = priceRaw.match(/^([0-9,]+)/);
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ""), 10) : 0;
    let sellerGrade: string | null = null;
    const markEl = $(el).find(".credit_mark_new, .credit_mark").first();
    if (markEl.length) {
      const cls = (markEl.attr("class") || "").split(/\s+/);
      for (const c of cls) {
        if (GRADE_CLASS_MAP[c]) { sellerGrade = GRADE_CLASS_MAP[c]; break; }
      }
    }
    const regDateText = $(el).find(".col.reg_date, .reg_date").first().text().trim();
    const originalCreatedAt = parseRegDate(regDateText);
    const timestamp = originalCreatedAt ? originalCreatedAt.getTime() : 0;
    const quantityText = $(el).find(".col.quantity, .quantity_box, .trade_quantity").first().text().trim() || null;
    seenIds.add(tid);
    results.push({
      tid, title, price, gameName, serverName, itemCategory, sellerGrade,
      isPremium: premiumSection ? true : normalSection ? false : null,
      description: quantityText, timestamp,
    });
  });

  return results;
}

router.get("/admin/live-list", async (req, res): Promise<void> => {
  const gameCode = String(req.query.gameCode ?? "");
  const type = req.query.type === "buy" ? "buy" : "sell";
  const page = Math.max(1, Math.min(5, parseInt(String(req.query.page ?? "1"), 10)));

  if (!gameCode) {
    res.json({ items: [], premiumItems: [], total: 0, error: "gameCode 필요" });
    return;
  }

  const gameId = parseInt(gameCode, 10);
  if (isNaN(gameId)) {
    res.json({ items: [], premiumItems: [], total: 0, error: "잘못된 gameCode" });
    return;
  }

  const cacheKey = `${gameCode}-${type}-${page}`;
  const cached = liveListCache.get(cacheKey);
  if (cached && cached.expireAt > Date.now()) {
    const ids = [...cached.items, ...cached.premiumItems]
      .map(item => item.dbId)
      .filter((id): id is number => typeof id === "number");
    const activeRows = ids.length ? await db.select({ id: productsTable.id })
      .from(productsTable)
      .where(and(inArray(productsTable.id, ids), eq(productsTable.status, "active"))) : [];
    const activeIds = new Set(activeRows.map(row => row.id));
    res.json({
      items: cached.items.filter(item => item.dbId && activeIds.has(item.dbId)),
      premiumItems: cached.premiumItems.filter(item => item.dbId && activeIds.has(item.dbId)),
      total: cached.total,
    });
    return;
  }

  const path = `/${type}/list.html?search_game=${gameId}&search_goods=all&page=${page}`;
  const result = await fetchProxyPage(path, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

  if (!result) {
    res.json({ items: [], premiumItems: [], total: 0, error: "itemmania fetch 실패" });
    return;
  }

  const html = result.html;
  const $c = cheerio.load(html);
  if (!$c(".search_list_premium, .search_list_normal").length) {
    res.json({ items: [], premiumItems: [], total: 0, error: "반환 HTML에 상품 목록 영역이 없습니다." });
    return;
  }
  const countText = $c("#premium_count").text().trim();
  const total = parseInt(countText.replace(/[^0-9]/g, ""), 10) || 0;

  const parsed = parseLiveItemsFromHtml(html, gameId);
  const classifiedItems = parsed.filter(p => p.isPremium !== null);
  if (classifiedItems.length === 0) {
    res.json({ items: [], premiumItems: [], total, error: "목록 구역이 확인되지 않아 상품을 분류할 수 없습니다." });
    return;
  }

  // live-list 항목을 DB에 upsert → dbId 매핑 확보
  const tidToDbId = new Map<string, number>();
  for (const p of classifiedItems) {
    try {
      const [row] = await db.insert(productsTable).values({
        itemmaniaid: p.tid,
        title: p.title,
        price: p.price,
        category: type,
        gameName: p.gameName,
        serverName: p.serverName,
        itemCategory: p.itemCategory,
        sellerGrade: p.sellerGrade ?? null,
        ...(p.isPremium !== null && { isPremium: p.isPremium }),
        description: p.description ?? null,
        status: "active",
        crawledAt: new Date(),
        ...(p.timestamp > 0 && { createdAt: new Date(p.timestamp) }),
      }).onConflictDoUpdate({
        target: productsTable.itemmaniaid,
        set: {
          title: p.title, price: p.price, gameName: p.gameName,
          serverName: p.serverName, itemCategory: p.itemCategory,
          sellerGrade: p.sellerGrade ?? null,
          ...(p.isPremium !== null && { isPremium: p.isPremium }),
          crawledAt: new Date(),
        },
      }).returning({ id: productsTable.id, status: productsTable.status });
      if (row?.status === "active") tidToDbId.set(p.tid, row.id);
    } catch { /* 저장 실패해도 계속 */ }
  }

  const withDbId = parsed.filter(p => tidToDbId.has(p.tid))
    .map(p => ({ ...p, dbId: tidToDbId.get(p.tid) }));
  const premiumItems = withDbId.filter(p => p.isPremium === true);
  const normalItems = withDbId.filter(p => p.isPremium === false);

  const entry: LiveListCacheEntry = { items: normalItems, premiumItems, total, expireAt: Date.now() + 5 * 60 * 1000 };
  liveListCache.set(cacheKey, entry);

  res.json({ items: normalItems, premiumItems, total });
});

// 로컬 크롤러 스크립트 다운로드
router.get("/admin/crawl/script", (_req, res): void => {
  const scriptPath = join(process.cwd(), "../../scripts/src/crawl-itemmania.mjs");
  try {
    const content = readFileSync(scriptPath, "utf-8");
    res.set("Content-Type", "application/javascript; charset=utf-8");
    res.set("Content-Disposition", 'attachment; filename="crawl-itemmania.mjs"');
    res.send(content);
  } catch {
    res.status(404).json({ error: "스크립트 파일을 찾을 수 없습니다." });
  }
});

// 자동 수집기 스크립트 다운로드 (SITE_URL / CRAWL_KEY 자동 주입)
router.get("/admin/crawl/auto-script", (req, res): void => {
  const scriptPath = join(process.cwd(), "../../scripts/src/auto-crawl.mjs");
  try {
    let content = readFileSync(scriptPath, "utf-8");

    // 배포 도메인 우선, 없으면 요청 host 사용
    const domains = process.env.REPLIT_DOMAINS ?? "";
    const firstDomain = domains.split(",")[0]?.trim();
    const host = firstDomain
      ? `https://${firstDomain}`
      : `${req.protocol}://${req.get("host")}`;

    content = content
      .replace("'https://YOUR_SITE.replit.app'", `'${host}'`)
      .replace("'YOUR_CRAWL_KEY'", `'${CRAWL_KEY}'`);

    res.set("Content-Type", "application/javascript; charset=utf-8");
    res.set("Content-Disposition", 'attachment; filename="auto-crawl.mjs"');
    res.send(content);
  } catch {
    res.status(404).json({ error: "스크립트 파일을 찾을 수 없습니다." });
  }
});

// ── 스냅샷 파일로부터 즉시 상품 가져오기 ──────────────────────────────────
router.post("/admin/crawl/from-snapshots", async (req, res): Promise<void> => {
  const results: Array<{ gameName: string; parsed: number; saved: number; failed?: number; error?: string }> = [];
  let totalSaved = 0;

  for (const entry of SNAPSHOT_GAME_MAP) {
    const filePath = join(ADMIN_STATIC_DIR, entry.file);
    if (!existsSync(filePath)) {
      results.push({ gameName: entry.gameName, parsed: 0, saved: 0, error: "파일 없음" });
      continue;
    }
    try {
      const html = readFileSync(filePath, "utf-8");
      const $ = cheerio.load(html);
      const items: Array<{ itemmaniaid: string; title: string; price: number; gameName: string; serverName: string; itemCategory: string; detailUrl: string; isPremium: boolean | null }> = [];
      const seenIds = new Set<string>();

      $("[data-tid]").each((_i, el) => {
        const tid = $(el).attr("data-tid");
        if (!tid || seenIds.has(tid) || $(el).hasClass("skeleton-item")) return;
        const premiumSection = $(el).closest(".search_list_premium").length > 0;
        const normalSection = $(el).closest(".search_list_normal").length > 0;
        const gName = $(el).find("[data-search=game]").first().text().trim() || entry.gameName;
        const sName = $(el).find("[data-search=server]").first().attr("data-title")
          || $(el).find("[data-search=server]").first().text().trim() || "";
        const iCat = $(el).find("[data-search=goods]").first().text().trim() || "";
        const title = $(el).find(".kind_title").first().text().trim()
          || $(el).find(".tit").first().text().trim()
          || $(el).find("strong").first().text().trim();
        if (!title) return;
        const priceRaw = $(el).find(".trade_money").first().text().trim()
          || $(el).find(".price").first().text().trim();
        const priceMatch = priceRaw.match(/^([0-9,]+)/);
        const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ""), 10) : 0;
        seenIds.add(tid);
        items.push({
          itemmaniaid: tid,
          title,
          price,
          gameName: gName,
          serverName: sName,
          itemCategory: iCat,
          detailUrl: `https://www.itemmania.com/sell/application.html?id=${tid}`,
          isPremium: premiumSection ? true : normalSection ? false : null,
        });
      });

      const classifiedItems = items.filter(p => p.isPremium !== null);
      const unclassifiedCount = items.length - classifiedItems.length;
      if (classifiedItems.length === 0) {
        results.push({ gameName: entry.gameName, parsed: items.length, saved: 0, failed: unclassifiedCount,
          error: "목록 구역을 판별할 수 없어 신규 상품 저장을 건너뛰었습니다." });
        continue;
      }

      let saved = 0;
      let failed = unclassifiedCount;
      for (const p of classifiedItems) {
        try {
          await db.insert(productsTable).values({
            itemmaniaid: p.itemmaniaid,
            title: p.title,
            price: p.price,
            gameName: p.gameName,
            serverName: p.serverName,
            itemCategory: p.itemCategory,
            category: "sell",
            detailUrl: p.detailUrl,
            ...(p.isPremium !== null && { isPremium: p.isPremium }),
            status: "active",
            crawledAt: new Date(),
          }).onConflictDoUpdate({
            target: productsTable.itemmaniaid,
            set: {
              title: p.title,
              price: p.price,
              gameName: p.gameName,
              serverName: p.serverName,
              itemCategory: p.itemCategory,
              detailUrl: p.detailUrl,
              ...(p.isPremium !== null && { isPremium: p.isPremium }),
              crawledAt: new Date(),
            },
          });
          saved++;
        } catch { failed++; }
      }
      totalSaved += saved;
      results.push({
        gameName: entry.gameName,
        parsed: items.length,
        saved,
        failed,
        ...(unclassifiedCount > 0 && { error: "분류되지 않은 행은 저장하지 않았습니다." }),
      });
    } catch (e) {
      results.push({ gameName: entry.gameName, parsed: 0, saved: 0, error: String(e) });
    }
  }

  res.json({ totalSaved, results });
});

// ── 로컬 크롤러: HTML 업로드 → 파싱 → DB 저장 ────────────────────────────
// PC에서 auto-crawl.mjs 스크립트가 직접 itemmania HTML을 가져와 이 엔드포인트로 POST
// 크롤 키 조회 (어드민 전용)
router.get("/admin/crawl-key", async (req, res): Promise<void> => {
  const isAdmin = req.session?.userRole === "admin" || req.session?.adminRole === "admin";
  if (!isAdmin) { res.status(403).json({ error: "권한 없음" }); return; }
  res.json({ key: CRAWL_KEY });
});

// 크롤 스크립트 다운로드 (어드민 전용) — SITE_URL·CRAWL_KEY 자동 삽입
router.get("/admin/crawl-script", async (req, res): Promise<void> => {
  const headerKey = req.headers["x-crawl-key"] as string | undefined;
  const isAdmin = req.session?.userRole === "admin" || req.session?.adminRole === "admin";
  const keyOk = headerKey === CRAWL_KEY;
  if (!isAdmin && !keyOk) { res.status(403).json({ error: "권한 없음" }); return; }

  const scriptPath = join(process.cwd(), "scripts", "src", "auto-crawl.mjs");
  const altPath = join(process.cwd(), "..", "..", "scripts", "src", "auto-crawl.mjs");
  const finalPath = existsSync(scriptPath) ? scriptPath : altPath;

  let script = readFileSync(finalPath, "utf8");

  const domains = (process.env.REPLIT_DOMAINS || "").split(",").map(d => d.trim()).filter(Boolean);
  const siteUrl = domains.length > 0 ? `https://${domains[0]}` : "https://YOUR_SITE.replit.app";

  script = script
    .replace("'https://YOUR_SITE.replit.app'", `'${siteUrl}'`)
    .replace("'YOUR_CRAWL_KEY'", `'${CRAWL_KEY}'`);

  res.set({
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="auto-crawl.mjs"`,
    "Cache-Control": "no-store",
  });
  res.send(script);
});

const loginLogoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } }).single("logo");
function brandingAdmin(req: Request, res: Response, next: NextFunction) {
  if (!(req.session?.adminId && req.session.adminRole === "admin") &&
      !(req.session?.userId && req.session.userRole === "admin")) {
    res.status(401).json({ error: "관리자 로그인이 필요합니다." }); return;
  }
  if (req.method !== "GET" && req.get("origin")) {
    let host = "";
    try { host = new URL(req.get("origin")!).host; } catch {}
    const allowed = [req.get("host"), req.get("x-forwarded-host")?.split(",")[0].trim()];
    if (!allowed.includes(host)) { res.status(403).json({ error: "허용되지 않은 요청입니다." }); return; }
  }
  next();
}
router.get("/admin/login-branding", brandingAdmin, async (_req, res): Promise<void> => {
  res.set("Cache-Control", "no-store").json(await loginLogoStatus());
});
router.put("/admin/login-branding/name", brandingAdmin, async (req, res): Promise<void> => {
  let brandName: string;
  try { brandName = normalizeLoginBrandName(req.body?.brandName); }
  catch (error) { res.status(400).json({ error: (error as Error).message }); return; }
  res.set("Cache-Control", "no-store").json(await updateLoginBrandName(brandName));
});
router.post("/admin/login-branding/logo", brandingAdmin, (req, res, next) => {
  loginLogoUpload(req, res, error => {
    if (error) { res.status(400).json({ error: "이미지 파일 한 개만, 최대 2MB까지 업로드할 수 있습니다." }); return; }
    next();
  });
}, async (req, res): Promise<void> => {
  if (!req.file || !logoImageType(req.file.buffer)) {
    res.status(400).json({ error: "PNG, JPG, WEBP 이미지 파일을 선택하세요." }); return;
  }
  res.json(await updateLoginLogo(req.file.buffer));
});
router.delete("/admin/login-branding/logo", brandingAdmin, async (_req, res): Promise<void> => {
  res.json(await updateLoginLogo(null));
});

router.post("/admin/crawl/upload-html", async (req, res): Promise<void> => {
  // X-Crawl-Key 헤더 또는 어드민 세션 인증
  const crawlKey = req.headers["x-crawl-key"] as string | undefined;
  const isAdmin = req.session?.userRole === "admin";
  if (!crawlKey && !isAdmin) { res.status(401).json({ error: "인증 필요 (X-Crawl-Key 헤더 또는 어드민 세션)" }); return; }
  if (crawlKey && crawlKey !== CRAWL_KEY) { res.status(401).json({ error: "CRAWL_KEY가 올바르지 않습니다" }); return; }

  const { html, gameId, category = "sell", gameName: overrideName } = req.body as {
    html?: string;
    gameId?: number;
    category?: "sell" | "buy";
    gameName?: string;
  };

  if (!html || typeof html !== "string") {
    res.status(400).json({ error: "html 필드가 필요합니다" });
    return;
  }
  if (typeof gameId !== "number") {
    res.status(400).json({ error: "gameId 필드가 필요합니다" });
    return;
  }

  const $ = cheerio.load(html);
  const dataTidCount = $("[data-tid]").length;
  const hasNextData = $("script#__NEXT_DATA__").length > 0;
  const htmlSnippet = html.slice(0, 300).replace(/\s+/g, " ");
  // JS 내 API 엔드포인트 패턴 탐색
  const scriptText = $("script:not([src])").map((_i, el) => $(el).html() || "").get().join("\n");
  const apiMatches = [...new Set((scriptText.match(/["'`][^"'`]*(?:\/api\/|\/goods\/|\/item\/|\/product\/|\/list\/|\/trade\/)[^"'`]{3,80}["'`]/g) || []))].slice(0, 10);
  const fetchUrls = [...new Set((scriptText.match(/fetch\s*\(\s*["'`][^"'`]{5,100}["'`]/g) || []))].slice(0, 10);
  const scriptSrcs = $("script[src]").map((_i, el) => $(el).attr("src") || "").get().filter(s => s.includes("itemmania") || s.includes("list") || s.includes("goods")).slice(0, 5);

  const products = parseProductsFromHtml(html, gameId, category);
  if (products.length === 0) {
    res.status(422).json({ error: "상품 목록을 찾지 못했습니다. 원본 HTML의 게임/목록 영역을 확인하세요.", parsed: 0 });
    return;
  }
  const classifiedProducts = products.filter(p => p.isPremium !== null);
  const unclassifiedCount = products.length - classifiedProducts.length;
  if (classifiedProducts.length === 0) {
    res.status(422).json({
      error: "상품 목록 구역을 판별할 수 없습니다. 신규 상품은 저장하지 않았습니다.",
      parsed: products.length,
      failed: unclassifiedCount,
    });
    return;
  }

  // gameName 오버라이드 (클라이언트가 게임명을 명시한 경우)
  if (overrideName) {
    for (const p of products) {
      if (!p.gameName) p.gameName = overrideName;
    }
  }

  let saved = 0;
  let failed = unclassifiedCount;
  for (const p of classifiedProducts) {
    try {
      await db.insert(productsTable).values({
        itemmaniaid: p.itemmaniaid,
        title: p.title,
        price: p.price,
        category: p.category,
        itemCategory: p.itemCategory,
        gameName: p.gameName,
        serverName: p.serverName,
        sellerGrade: p.sellerGrade ?? null,
        ...(p.isPremium !== null && { isPremium: p.isPremium }),
        detailUrl: p.detailUrl,
        status: "active",
        crawledAt: new Date(),
        ...(p.originalCreatedAt && { createdAt: p.originalCreatedAt }),
      }).onConflictDoUpdate({
        target: productsTable.itemmaniaid,
        set: {
          title: p.title, price: p.price,
          gameName: p.gameName, serverName: p.serverName,
          itemCategory: p.itemCategory, sellerGrade: p.sellerGrade ?? null,
          ...(p.isPremium !== null && { isPremium: p.isPremium }),
          detailUrl: p.detailUrl, crawledAt: new Date(),
        },
      });
      saved++;
    } catch { failed++; }
  }

  res.json({ parsed: products.length, classified: classifiedProducts.length, saved, failed, debug: { dataTidCount, hasNextData, htmlLen: html.length, htmlSnippet, apiMatches, fetchUrls, scriptSrcs } });
});

// ── 자동 크롤 스케줄러 ──────────────────────────────────────────────────────
// Firecrawl 무료 요금제 기본값: 하루 한 번, 11개 게임 양쪽 목록 1페이지씩(월 약 660페이지).
// 명시적 AUTO_CRAWL_SCHEDULE / AUTO_CRAWL_PAGES 설정은 이 기본값을 덮어쓴다.
let _schedulerTask: ReturnType<typeof cron.schedule> | null = null;
let _schedulerRunning = false;

export function startAutoScheduler(): void {
  if (process.env.AUTO_CRAWL_ENABLED === "0") {
    logger.info("AUTO_CRAWL: 설정에 따라 자동 크롤 비활성화");
    return;
  }
  const provider = resolveCrawlProvider();
  if (!provider) {
    logger.info("AUTO_CRAWL: 수집 공급자 연결 없음 — 자동 크롤 비활성화");
    return;
  }

  const schedule = process.env.AUTO_CRAWL_SCHEDULE ?? (provider.kind === "firecrawl" ? "0 1 * * *" : "*/30 * * * *");
  const pages = Math.max(1, parseInt(process.env.AUTO_CRAWL_PAGES ?? (provider.kind === "firecrawl" ? "1" : "10"), 10));
  const scheduledGameIds = provider.kind === "firecrawl" ? GAME_LIST.map(game => game.id) : [];

  if (_schedulerTask) _schedulerTask.stop();

  _schedulerTask = cron.schedule(schedule, async () => {
    if (_schedulerRunning) {
      logger.info("AUTO_CRAWL: 이전 크롤이 아직 실행 중 — 스킵");
      return;
    }
    _schedulerRunning = true;
    logger.info({ schedule, pages, provider: provider.kind }, "AUTO_CRAWL: 크롤 시작");

    const jobId = `auto_${Date.now()}`;
    const job: CrawlJob = {
      id: jobId, status: "running",
      totalGames: 0, totalPages: 0, totalSteps: 1,
      games: [], completedSteps: 0, totalSaved: 0, totalFailed: 0, detailFetched: 0, detailFailed: 0,
      logs: [], startedAt: Date.now(),
    };
    crawlJobs.set(jobId, job);

    try {
      await runCrawlJob(job, scheduledGameIds, pages, provider, false);
      logger.info({ saved: job.totalSaved, failed: job.totalFailed }, "AUTO_CRAWL: 완료");
    } catch (err) {
      logger.error({ err }, "AUTO_CRAWL: 치명적 오류");
    } finally {
      _schedulerRunning = false;
      // 메모리 절약: 완료된 자동 작업 로그 30분 후 삭제
      setTimeout(() => crawlJobs.delete(jobId), 30 * 60 * 1000);
    }
  });

  logger.info({ schedule, pages, provider: provider.kind }, "AUTO_CRAWL: 스케줄러 등록 완료");
}

export default router;
