import { Router, type IRouter } from "express";
import { eq, sql, desc, or, inArray, and } from "drizzle-orm";
import cron from "node-cron";
import { db, usersTable, ordersTable, withdrawalsTable, walletsTable, productsTable, chatRoomsTable, chatMessagesTable } from "@workspace/db";
import type { AuthStates } from "@workspace/db";
import { pushToUser } from "../lib/sse";
import { logger } from "../lib/logger";
import * as cheerio from "cheerio";
import { fetchProxyPage } from "../lib/proxy";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createHmac } from "crypto";

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
  { file: "sell-maplestory.html", gameId: 8458, gameName: "메이플스토리" },
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

// ── 백그라운드 크롤 작업 상태 저장소 ─────────────────────────────────────
interface CrawlLog {
  type: string; message: string;
  gameIndex?: number; gameName?: string;
  page?: number; totalPages?: number; pageSaved?: number;
  completedSteps?: number; totalSteps?: number;
  totalSaved?: number; totalFailed?: number; detailFetched?: number;
  ts: number;
}
interface CrawlJob {
  id: string;
  status: "running" | "done" | "failed";
  totalGames: number; totalPages: number; totalSteps: number;
  games: string[];
  completedSteps: number; totalSaved: number; totalFailed: number; detailFetched: number;
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
}

async function runCrawlJob(
  job: CrawlJob, gameIds: number[], pages: number,
  apiKey: string, crawlDetail: boolean
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

  const sessionNumber = Math.floor(Math.random() * 9000) + 1000;
  push({ type: "progress", message: `🌐 세션 초기화 중... (session #${sessionNumber})`, completedSteps: 0, totalSteps, totalSaved: 0, totalFailed: 0 });
  try { await initSession(apiKey, sessionNumber); } catch { /* 세션 초기화 실패 시 계속 */ }
  push({ type: "session_ok", message: `✓ 세션 초기화 완료`, completedSteps: 0, totalSteps, totalSaved: 0, totalFailed: 0 });

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

        const { html, error } = await fetchPageHtml(game.id, page, apiKey, sessionNumber, cat);
        if (!html) {
          completedSteps++;
          push({ type: "fail", gameIndex: gi, gameName: game.name, page, totalPages: maxPages,
            completedSteps, totalSteps, totalSaved: totalUpserted, totalFailed: ++totalFailed,
            message: `  ✗ [${catLabel}] ${game.name} ${page}페이지 - 실패 (${error ?? "HTML 없음"})` });
          continue;
        }

        const listItemCount = (html.match(/list_item/g) || []).length;
        const dataTidCount = (html.match(/data-tid=/g) || []).length;
        const products = parseProductsFromHtml(html, game.id, cat);

        if (products.length === 0) {
          completedSteps++;
          push({ type: "warn", gameIndex: gi, gameName: game.name, page, totalPages: maxPages,
            completedSteps, totalSteps, totalSaved: totalUpserted, totalFailed,
            message: `  ⚠ [${catLabel}] ${game.name} ${page}페이지 - 상품 없음 (${html.length}바이트, list_item:${listItemCount}, data-tid:${dataTidCount})` });
          const idx = html.indexOf("data-tid=");
          if (idx >= 0) {
            const snip = html.slice(Math.max(0, idx - 20), idx + 300).replace(/\s+/g, " ");
            push({ type: "debug", message: `  🔍 data-tid 주변: ${snip}`, completedSteps, totalSteps, totalSaved: totalUpserted, totalFailed });
          }
          continue;
        }

        let pageSaved = 0;
        for (const p of products) {
          try {
            await db.insert(productsTable).values({
              itemmaniaid: p.itemmaniaid, title: p.title, price: p.price,
              category: p.category, itemCategory: p.itemCategory,
              gameName: p.gameName, serverName: p.serverName,
              sellerGrade: p.sellerGrade ?? null,
              detailUrl: p.detailUrl, status: "active", crawledAt: new Date(),
              ...(p.originalCreatedAt && { createdAt: p.originalCreatedAt }),
            }).onConflictDoUpdate({
              target: productsTable.itemmaniaid,
              set: { title: p.title, price: p.price, gameName: p.gameName,
                serverName: p.serverName, itemCategory: p.itemCategory,
                sellerGrade: p.sellerGrade ?? null,
                detailUrl: p.detailUrl, status: "active", crawledAt: new Date() },
            });
            totalUpserted++; pageSaved++;
          } catch { totalFailed++; }

          if (crawlDetail) {
            const dhtml = await fetchDetailHtml(p.itemmaniaid, apiKey, sessionNumber);
            if (dhtml) {
              const detail = parseDetailFromHtml(dhtml);
              try {
                await db.update(productsTable)
                  .set({ description: detail.description, thumbnailUrl: detail.thumbnailUrl, sellerName: detail.sellerName })
                  .where(eq(productsTable.itemmaniaid, p.itemmaniaid));
                detailFetched++;
              } catch { detailFailed++; }
            } else { detailFailed++; }
            await new Promise(r => setTimeout(r, 300));
          }
        }

        completedSteps++;
        push({ type: "ok", gameIndex: gi, gameName: game.name, page, totalPages: maxPages,
          pageSaved, completedSteps, totalSteps, totalSaved: totalUpserted, totalFailed, detailFetched,
          message: `  ✓ [${catLabel}] ${game.name} ${page}페이지 - ${pageSaved}개 저장${crawlDetail ? ` (상세 ${detailFetched}개)` : ""}` });

        if (page < maxPages) await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  job.status = "done";
  job.finishedAt = Date.now();
  push({ type: "done", completedSteps: totalSteps, totalSteps,
    totalSaved: totalUpserted, totalFailed, detailFetched,
    message: `✅ 완료! 총 ${totalUpserted}개 저장 / ${totalFailed}개 실패${crawlDetail ? ` / 상세 ${detailFetched}개` : ""}` });
}

// 전체 회원 목록
router.get("/admin/users", async (req, res): Promise<void> => {
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
      balance: walletsTable.balance,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .leftJoin(walletsTable, eq(usersTable.id, walletsTable.userId))
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
    balance: u.balance !== null ? Number(u.balance) : null,
    createdAt: u.createdAt,
  })));
});

// 전체 주문 목록
router.get("/admin/orders", async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = 50;
  const offset = (page - 1) * limit;
  const { status } = req.query;

  let query = db.select().from(ordersTable).$dynamic();
  if (status && typeof status === "string") {
    query = query.where(eq(ordersTable.status, status as typeof ordersTable.$inferSelect["status"]));
  }
  const orders = await query.limit(limit).offset(offset);

  res.json(orders.map(o => ({
    id: o.id,
    buyerId: o.buyerId,
    sellerId: o.sellerId,
    productId: o.productId,
    productTitle: o.productTitle,
    amount: Number(o.amount),
    status: o.status,
    cancelReason: o.cancelReason,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  })));
});

// 출금 신청 목록
router.get("/admin/withdrawals", async (req, res): Promise<void> => {
  const { status } = req.query;
  let query = db.select().from(withdrawalsTable).$dynamic();
  if (status && typeof status === "string") {
    query = query.where(eq(withdrawalsTable.status, status as typeof withdrawalsTable.$inferSelect["status"]));
  }
  const withdrawals = await query;
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
router.patch("/admin/users/:id/balance", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "잘못된 ID" }); return; }

  const { amount, mode } = req.body as { amount: number; mode: "add" | "set" };
  const amt = Number(amount);
  if (isNaN(amt) || !["add", "set"].includes(mode)) {
    res.status(400).json({ error: "amount(숫자)와 mode(add|set)가 필요합니다." }); return;
  }

  const [existing] = await db.select().from(walletsTable).where(eq(walletsTable.userId, id));
  let newBalance: number;
  if (!existing) {
    newBalance = Math.max(0, mode === "add" ? amt : amt);
    await db.insert(walletsTable).values({ userId: id, balance: newBalance });
  } else {
    const current = Number(existing.balance);
    newBalance = Math.max(0, mode === "add" ? current + amt : amt);
    await db.update(walletsTable).set({ balance: newBalance }).where(eq(walletsTable.userId, id));
  }

  pushToUser(id, "balance", { balance: newBalance });
  res.json({ balance: newBalance });
});

// 회원 정보 수정 (닉네임, 전화번호, 이메일, 역할)
router.patch("/admin/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "잘못된 ID" }); return; }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) { res.status(404).json({ error: "회원을 찾을 수 없습니다." }); return; }

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
router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "잘못된 ID" }); return; }
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) { res.status(404).json({ error: "회원을 찾을 수 없습니다." }); return; }
  if (target.role === "admin") { res.status(403).json({ error: "관리자 계정은 삭제할 수 없습니다." }); return; }
  try {
    // 1. 이 유저가 참여한 채팅방 목록 조회
    const rooms = await db
      .select({ id: chatRoomsTable.id })
      .from(chatRoomsTable)
      .where(or(eq(chatRoomsTable.buyerId, id), eq(chatRoomsTable.sellerId, id)));
    const roomIds = rooms.map(r => r.id);

    // 2. 채팅 메시지 삭제 (senderId FK + 채팅방 소속 메시지)
    if (roomIds.length > 0) {
      await db.delete(chatMessagesTable).where(inArray(chatMessagesTable.roomId, roomIds));
    }
    await db.delete(chatMessagesTable).where(eq(chatMessagesTable.senderId, id));

    // 3. 채팅방 삭제
    if (roomIds.length > 0) {
      await db.delete(chatRoomsTable).where(inArray(chatRoomsTable.id, roomIds));
    }

    // 4. 주문 삭제 (buyerId / sellerId FK)
    await db.delete(ordersTable).where(or(eq(ordersTable.buyerId, id), eq(ordersTable.sellerId, id)));

    // 5. 출금 신청 삭제
    await db.delete(withdrawalsTable).where(eq(withdrawalsTable.userId, id));

    // 6. 지갑 삭제
    await db.delete(walletsTable).where(eq(walletsTable.userId, id));

    // 7. 유저 삭제
    await db.delete(usersTable).where(eq(usersTable.id, id));

    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "삭제에 실패했습니다: " + msg });
  }
});

// ── 상품 관리 ──────────────────────────────────────────────────────

// 전체 상품 목록
router.get("/admin/products", async (req, res): Promise<void> => {
  const page  = Math.max(1, parseInt(String(req.query.page  ?? "1"),  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10));
  const offset = (page - 1) * limit;
  const category = req.query.category as string | undefined;
  const status   = req.query.status   as string | undefined;

  const where = and(
    category ? eq(productsTable.category, category as "sell" | "buy") : undefined,
    status   ? eq(productsTable.status,   status   as "active" | "sold" | "inactive") : undefined,
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

  const [updated] = await db.update(productsTable).set(updates).where(eq(productsTable.id, id)).returning();
  res.json({ id: updated.id, status: updated.status, title: updated.title });
});

// 상품 삭제
router.delete("/admin/products/no-grade", async (_req, res): Promise<void> => {
  const deleted = await db.delete(productsTable)
    .where(sql`seller_grade IS NULL`)
    .returning({ id: productsTable.id });
  res.json({ ok: true, deleted: deleted.length });
});

router.delete("/admin/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!existing) { res.status(404).json({ error: "상품을 찾을 수 없습니다." }); return; }
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.json({ ok: true });
});

// 전체 채팅 거래 내역
router.get("/admin/chat-rooms", async (_req, res): Promise<void> => {
  const rooms = await db
    .select({
      id: chatRoomsTable.id,
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
    .orderBy(desc(chatRoomsTable.createdAt));

  res.json(rooms.map(r => ({
    id: r.id,
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

// 대시보드 통계
router.get("/admin/stats", async (_req, res): Promise<void> => {
  const [[userCount], [productCount], [orderCount], [pendingOrderCount], [totalRevenue]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(usersTable),
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
  { id: 8458, name: "메이플스토리",       slug: "maplestory" },
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

function scraperUrl(targetUrl: string, apiKey: string, sessionNumber: number): string {
  return `https://api.scraperapi.com/?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}&render=true&premium=true&country_code=kr&session_number=${sessionNumber}`;
}

async function scraperFetch(url: string, apiKey: string | undefined, sessionNumber: number, timeoutMs = 90000): Promise<{text: string | null; status: number | null; error: string | null}> {
  const fetchUrl = apiKey ? scraperUrl(url, apiKey, sessionNumber) : url;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(fetchUrl, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
        "Referer": "https://www.itemmania.com/",
      },
    });
    if (!resp.ok) return {text: null, status: resp.status, error: `HTTP ${resp.status}`};
    const text = await resp.text();
    if (!text || text.trim().length < 200) return {text: null, status: resp.status, error: `빈 응답 (${text.trim().length}바이트)`};
    return {text, status: resp.status, error: null};
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const isTimeout = msg.includes("abort") || msg.includes("timeout");
    return {text: null, status: null, error: isTimeout ? "타임아웃" : msg.slice(0, 80)};
  } finally {
    clearTimeout(timer);
  }
}

async function initSession(apiKey: string, sessionNumber: number): Promise<void> {
  await scraperFetch("https://www.itemmania.com/", apiKey, sessionNumber, 30000);
}

async function fetchPageHtml(gameId: number, page: number, apiKey: string | undefined, sessionNumber: number, category: "sell" | "buy" = "sell"): Promise<{html: string | null; statusCode: number | null; error: string | null}> {
  const url = `https://www.itemmania.com/${category}/list.html?search_game=${gameId}&search_goods=all&page=${page}`;
  const {text, status, error} = await scraperFetch(url, apiKey, sessionNumber);
  return {html: text, statusCode: status, error};
}

async function fetchDetailHtml(tid: string, apiKey: string | undefined, sessionNumber: number): Promise<string | null> {
  const url = `https://www.itemmania.com/sell/application.html?id=${tid}`;
  const {text} = await scraperFetch(url, apiKey, sessionNumber);
  return text;
}

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
  description: string | null;
  originalCreatedAt: Date | null;
}> {
  const $ = cheerio.load(html);
  const products: ReturnType<typeof parseProductsFromHtml> = [];
  const gameFallbackName = GAME_LIST.find(g => g.id === gameId)?.name || "";
  const GRADE_CLASS_MAP: Record<string, string> = {
    vip: "vip", platinum: "platinum", gold: "gold", silver: "silver", bronze: "bronze",
  };

  // 전략 1: li[data-tid] — 실제 data-tid 속성이 있는 모든 요소
  $("[data-tid]").each((_i, el) => {
    const tid = $(el).attr("data-tid");
    if (!tid || $(el).hasClass("skeleton-item")) return;
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
    products.push({
      itemmaniaid: tid,
      title,
      price,
      gameName: gameName || gameFallbackName,
      serverName: serverName || "",
      category: category,
      itemCategory: itemCategory || "",
      detailUrl: `https://www.itemmania.com/${category}/application.html?id=${tid}`,
      sellerGrade,
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
          gameName: String(it["game_name"] || it["gameName"] || gameFallbackName),
          serverName: String(it["server_name"] || it["serverName"] || ""),
          category: category,
          itemCategory: String(it["goods_kind"] || it["itemCategory"] || ""),
          detailUrl: `https://www.itemmania.com/${category}/application.html?id=${tid}`,
          sellerGrade: null,
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

  const apiKey: string | undefined = scraperApiKey || process.env.SCRAPER_API_KEY;
  const sessionNumber = Math.floor(Math.random() * 9000) + 1000;
  const targetGames = gameIds && gameIds.length > 0
    ? GAME_LIST.filter(g => gameIds.includes(g.id))
    : GAME_LIST.slice(0, 3);

  const maxPages = Math.min(Math.max(1, pages), 20);
  let totalUpserted = 0;
  let totalFailed = 0;
  let detailFetched = 0;
  let detailFailed = 0;
  const log: string[] = [];

  if (apiKey) await initSession(apiKey, sessionNumber);

  for (const game of targetGames) {
    for (let page = 1; page <= maxPages; page++) {
      const {html, error} = await fetchPageHtml(game.id, page, apiKey, sessionNumber);
      if (!html) {
        log.push(`[실패] ${game.name} ${page}페이지 - ${error ?? "HTML 없음"}`);
        totalFailed++;
        continue;
      }

      const products = parseProductsFromHtml(html, game.id);
      if (products.length === 0) {
        log.push(`[경고] ${game.name} ${page}페이지 - 상품 없음 (HTML ${html.length}바이트, list_item: ${(html.match(/list_item/g) || []).length}개)`);
        continue;
      }

      for (const p of products) {
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
            detailUrl: p.detailUrl,
            status: "active",
            crawledAt: new Date(),
            ...(p.originalCreatedAt && { createdAt: p.originalCreatedAt }),
          }).onConflictDoUpdate({
            target: productsTable.itemmaniaid,
            set: {
              title: p.title,
              price: p.price,
              gameName: p.gameName,
              serverName: p.serverName,
              itemCategory: p.itemCategory,
              sellerGrade: p.sellerGrade ?? null,
              detailUrl: p.detailUrl,
              status: "active",
              crawledAt: new Date(),
            },
          });
          totalUpserted++;
        } catch {
          totalFailed++;
          continue;
        }

        if (crawlDetail) {
          const detailHtml = await fetchDetailHtml(p.itemmaniaid, apiKey, sessionNumber);
          if (detailHtml) {
            const detail = parseDetailFromHtml(detailHtml);
            try {
              await db.update(productsTable)
                .set({
                  description: detail.description,
                  thumbnailUrl: detail.thumbnailUrl,
                  sellerName: detail.sellerName,
                })
                .where(eq(productsTable.itemmaniaid, p.itemmaniaid));
              detailFetched++;
            } catch {
              detailFailed++;
            }
          } else {
            detailFailed++;
          }
          await new Promise(r => setTimeout(r, 300));
        }
      }

      log.push(`[완료] ${game.name} ${page}페이지 - ${products.length}개 저장${crawlDetail ? ` (상세 ${detailFetched}개)` : ""}`);

      if (page < maxPages) await new Promise(r => setTimeout(r, 500));
    }
  }

  res.json({ ok: true, upserted: totalUpserted, failed: totalFailed, detailFetched, detailFailed, log });
});

// 크롤링 SSE 스트리밍 (실시간 진행상황)
// 크롤링 백그라운드 작업 시작
router.post("/admin/crawl/start", async (req, res): Promise<void> => {
  const { gameIds = [], pages = 1, scraperApiKey, crawlDetail = false } = req.body as {
    gameIds?: number[]; pages?: number; scraperApiKey?: string; crawlDetail?: boolean;
  };
  const apiKey: string | undefined = scraperApiKey || process.env.SCRAPER_API_KEY;
  if (!apiKey) {
    res.status(400).json({ error: "ScraperAPI 키가 없습니다. 키를 입력하거나 환경변수 SCRAPER_API_KEY를 설정하세요." });
    return;
  }
  const jobId = `crawl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const job: CrawlJob = {
    id: jobId, status: "running",
    totalGames: 0, totalPages: 0, totalSteps: 1,
    games: [], completedSteps: 0, totalSaved: 0, totalFailed: 0, detailFetched: 0,
    logs: [], startedAt: Date.now(),
  };
  crawlJobs.set(jobId, job);
  // 백그라운드 실행 (await 없음 — 연결과 무관하게 계속 실행)
  runCrawlJob(job, gameIds, pages, apiKey, crawlDetail).catch(err => {
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
    totalFailed: job.totalFailed, detailFetched: job.detailFetched,
    startedAt: job.startedAt, finishedAt: job.finishedAt,
    logs: newLogs,
  });
});


// itemmania.com AJAX API 자동 탐지
router.get("/admin/crawl/discover", async (req, res): Promise<void> => {
  const scraperApiKey = String(req.query.scraperApiKey ?? "");
  const gameId = parseInt(String(req.query.gameId ?? "138"), 10);
  const apiKey = scraperApiKey || process.env.SCRAPER_API_KEY;

  if (!apiKey) {
    res.status(400).json({ error: "ScraperAPI 키가 없습니다" });
    return;
  }

  const sessionNumber = Math.floor(Math.random() * 9000) + 1000;
  const listUrl = `https://www.itemmania.com/sell/list.html?search_game=${gameId}&search_goods=all&page=1`;
  const { text: html, error } = await scraperFetch(listUrl, apiKey, sessionNumber);

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
  for (const src of externalSrcs.slice(0, 4)) {
    const jsUrl = src.startsWith("http") ? src : `https://www.itemmania.com${src}`;
    const { text: jsText } = await scraperFetch(jsUrl, apiKey, sessionNumber, 20000);
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
  const hasApiKey = !!process.env.SCRAPER_API_KEY;
  res.json({ games: GAME_LIST, hasApiKey });
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
    if (!p.itemmaniaid || !p.title) { failed++; continue; }
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
          ...(p.description !== undefined && { description: p.description }),
          ...(p.thumbnailUrl !== undefined && { thumbnailUrl: p.thumbnailUrl }),
          ...(p.sellerName !== undefined && { sellerName: p.sellerName }),
          status: "active",
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
  const gameFallbackName = GAME_LIST.find(g => g.id === gameId)?.name ?? "";
  const GRADE_CLASS_MAP: Record<string, string> = {
    vip: "vip", platinum: "platinum", gold: "gold", silver: "silver", bronze: "bronze",
  };

  $("[data-tid]").each((_i, el) => {
    const tid = $(el).attr("data-tid");
    if (!tid || $(el).hasClass("skeleton-item")) return;
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
    results.push({ tid, title, price, gameName, serverName, itemCategory, sellerGrade, description: quantityText, timestamp });
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
    res.json({ items: cached.items, premiumItems: cached.premiumItems, total: cached.total });
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
  const countText = $c("#premium_count").text().trim();
  const total = parseInt(countText.replace(/[^0-9]/g, ""), 10) || 0;

  const parsed = parseLiveItemsFromHtml(html, gameId);
  const PREMIUM_GRADES = new Set(["vip", "platinum"]);
  const premiumItems = parsed.filter(p => p.sellerGrade !== null && PREMIUM_GRADES.has(p.sellerGrade));
  const normalItems  = parsed.filter(p => p.sellerGrade === null || !PREMIUM_GRADES.has(p.sellerGrade));

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
  const results: Array<{ gameName: string; parsed: number; saved: number; error?: string }> = [];
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
      const items: Array<{ itemmaniaid: string; title: string; price: number; gameName: string; serverName: string; itemCategory: string; detailUrl: string }> = [];

      $("[data-tid]").each((_i, el) => {
        const tid = $(el).attr("data-tid");
        if (!tid || $(el).hasClass("skeleton-item")) return;
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
        items.push({
          itemmaniaid: tid,
          title,
          price,
          gameName: gName,
          serverName: sName,
          itemCategory: iCat,
          detailUrl: `https://www.itemmania.com/sell/application.html?id=${tid}`,
        });
      });

      let saved = 0;
      for (const p of items) {
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
              status: "active",
              crawledAt: new Date(),
            },
          });
          saved++;
        } catch { /* skip */ }
      }
      totalSaved += saved;
      results.push({ gameName: entry.gameName, parsed: items.length, saved });
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

  // gameName 오버라이드 (클라이언트가 게임명을 명시한 경우)
  if (overrideName) {
    for (const p of products) {
      if (!p.gameName) p.gameName = overrideName;
    }
  }

  let saved = 0;
  let failed = 0;
  for (const p of products) {
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
          detailUrl: p.detailUrl, status: "active", crawledAt: new Date(),
        },
      });
      saved++;
    } catch { failed++; }
  }

  res.json({ parsed: products.length, saved, failed, debug: { dataTidCount, hasNextData, htmlLen: html.length, htmlSnippet, apiMatches, fetchUrls, scriptSrcs } });
});

// ── 자동 크롤 스케줄러 ──────────────────────────────────────────────────────
// SCRAPER_API_KEY 환경변수가 있을 때만 활성화됨.
// AUTO_CRAWL_SCHEDULE: cron 표현식 (기본 "*/30 * * * *" = 30분마다)
// AUTO_CRAWL_PAGES   : 페이지 수 (기본 2)
let _schedulerTask: ReturnType<typeof cron.schedule> | null = null;
let _schedulerRunning = false;

export function startAutoScheduler(): void {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) {
    logger.info("AUTO_CRAWL: SCRAPER_API_KEY 없음 — 자동 크롤 비활성화");
    return;
  }

  const schedule = process.env.AUTO_CRAWL_SCHEDULE ?? "*/30 * * * *";
  const pages    = Math.max(1, parseInt(process.env.AUTO_CRAWL_PAGES ?? "2", 10));

  if (_schedulerTask) _schedulerTask.stop();

  _schedulerTask = cron.schedule(schedule, async () => {
    if (_schedulerRunning) {
      logger.info("AUTO_CRAWL: 이전 크롤이 아직 실행 중 — 스킵");
      return;
    }
    _schedulerRunning = true;
    logger.info({ schedule, pages }, "AUTO_CRAWL: 크롤 시작");

    const jobId = `auto_${Date.now()}`;
    const job: CrawlJob = {
      id: jobId, status: "running",
      totalGames: 0, totalPages: 0, totalSteps: 1,
      games: [], completedSteps: 0, totalSaved: 0, totalFailed: 0, detailFetched: 0,
      logs: [], startedAt: Date.now(),
    };
    crawlJobs.set(jobId, job);

    try {
      await runCrawlJob(job, [], pages, apiKey, false);
      logger.info({ saved: job.totalSaved, failed: job.totalFailed }, "AUTO_CRAWL: 완료");
    } catch (err) {
      logger.error({ err }, "AUTO_CRAWL: 치명적 오류");
    } finally {
      _schedulerRunning = false;
      // 메모리 절약: 완료된 자동 작업 로그 30분 후 삭제
      setTimeout(() => crawlJobs.delete(jobId), 30 * 60 * 1000);
    }
  });

  logger.info({ schedule, pages }, "AUTO_CRAWL: 스케줄러 등록 완료");
}

export default router;
