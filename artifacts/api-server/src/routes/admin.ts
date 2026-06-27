import { Router, type IRouter } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { db, usersTable, ordersTable, withdrawalsTable, walletsTable, productsTable } from "@workspace/db";
import type { AuthStates } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";
import { pushToUser } from "../lib/sse";
import * as cheerio from "cheerio";

const router: IRouter = Router();

// 전체 회원 목록
router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
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
router.get("/admin/orders", requireAdmin, async (req, res): Promise<void> => {
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
router.get("/admin/withdrawals", requireAdmin, async (req, res): Promise<void> => {
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
router.patch("/admin/withdrawals/:id", requireAdmin, async (req, res): Promise<void> => {
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
router.get("/admin/users/:id/auth-states", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [user] = await db.select({ authStates: usersTable.authStates }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "회원을 찾을 수 없습니다." }); return; }
  res.json(user.authStates ?? { excellent: false, phone: false, email: false, ipin: false, withdraw: false });
});

// 인증상태 수정
router.put("/admin/users/:id/auth-states", requireAdmin, async (req, res): Promise<void> => {
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
router.patch("/admin/users/:id/balance", requireAdmin, async (req, res): Promise<void> => {
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
router.patch("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
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
router.delete("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) { res.status(404).json({ error: "회원을 찾을 수 없습니다." }); return; }
  if (target.role === "admin") { res.status(403).json({ error: "관리자 계정은 삭제할 수 없습니다." }); return; }
  await db.delete(walletsTable).where(eq(walletsTable.userId, id));
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

// ── 상품 관리 ──────────────────────────────────────────────────────

// 전체 상품 목록
router.get("/admin/products", requireAdmin, async (req, res): Promise<void> => {
  const products = await db.select().from(productsTable).orderBy(desc(productsTable.createdAt));
  res.json(products.map(p => ({
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
  })));
});

// 상품 등록 (어드민)
router.post("/admin/products", requireAdmin, async (req, res): Promise<void> => {
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
router.patch("/admin/products/:id", requireAdmin, async (req, res): Promise<void> => {
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
router.delete("/admin/products/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!existing) { res.status(404).json({ error: "상품을 찾을 수 없습니다." }); return; }
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.json({ ok: true });
});

// 대시보드 통계
router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
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
  { id: 2696, name: "로스트아크",       slug: "lostark" },
  { id: 138,  name: "메이플스토리",     slug: "maplestory" },
  { id: 281,  name: "던전앤파이터",     slug: "dnf" },
  { id: 5913, name: "리니지 클래식",   slug: "lineage-classic" },
  { id: 5799, name: "아이온2",          slug: "aion2" },
  { id: 155,  name: "마비노기",         slug: "mabinogi" },
  { id: 101,  name: "거상",             slug: "geosang" },
];

async function fetchPageHtml(gameId: number, page: number, scraperApiKey?: string): Promise<string | null> {
  const targetUrl = `https://www.itemmania.com/sell/list.html?search_game=${gameId}&search_goods=all&page=${page}`;
  const fetchUrl = scraperApiKey
    ? `https://api.scraperapi.com/?api_key=${scraperApiKey}&url=${encodeURIComponent(targetUrl)}&render=false`
    : targetUrl;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const resp = await fetch(fetchUrl, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36" },
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseProductsFromHtml(html: string, gameId: number): Array<{
  itemmaniaid: string;
  title: string;
  price: number;
  gameName: string;
  serverName: string;
  category: string;
  itemCategory: string;
  detailUrl: string;
}> {
  const $ = cheerio.load(html);
  const products: ReturnType<typeof parseProductsFromHtml> = [];

  $("li.list_item").each((_i, el) => {
    const tid = $(el).attr("data-tid");
    if (!tid) return;

    const gameName = $(el).find("[data-search=game]").first().text().trim();
    const serverName = $(el).find("[data-search=server]").first().attr("data-title")
      || $(el).find("[data-search=server]").first().text().trim();
    const itemCategory = $(el).find("[data-search=goods]").first().text().trim();
    const title = $(el).find(".kind_title").first().text().trim();
    const priceText = $(el).find(".trade_money").first().text().replace(/[^0-9]/g, "");
    const price = parseInt(priceText, 10) || 0;

    if (!title) return;

    products.push({
      itemmaniaid: tid,
      title,
      price,
      gameName: gameName || GAME_LIST.find(g => g.id === gameId)?.name || "",
      serverName: serverName || "",
      category: "sell",
      itemCategory: itemCategory || "",
      detailUrl: `https://www.itemmania.com/sell/view.html?no=${tid}`,
    });
  });

  return products;
}

// 크롤링 API
router.post("/admin/crawl", requireAdmin, async (req, res): Promise<void> => {
  const { gameIds, pages = 1, scraperApiKey } = req.body as {
    gameIds?: number[];
    pages?: number;
    scraperApiKey?: string;
  };

  const apiKey: string | undefined = scraperApiKey || process.env.SCRAPER_API_KEY;
  const targetGames = gameIds && gameIds.length > 0
    ? GAME_LIST.filter(g => gameIds.includes(g.id))
    : GAME_LIST.slice(0, 3);

  const maxPages = Math.min(Math.max(1, pages), 5);
  let totalUpserted = 0;
  let totalFailed = 0;
  const log: string[] = [];

  for (const game of targetGames) {
    for (let page = 1; page <= maxPages; page++) {
      const html = await fetchPageHtml(game.id, page, apiKey);
      if (!html) {
        log.push(`[실패] ${game.name} ${page}페이지 - HTML 가져오기 실패`);
        totalFailed++;
        continue;
      }

      const products = parseProductsFromHtml(html, game.id);
      if (products.length === 0) {
        log.push(`[경고] ${game.name} ${page}페이지 - 상품 없음`);
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
              status: "active",
              crawledAt: new Date(),
            },
          });
          totalUpserted++;
        } catch {
          totalFailed++;
        }
      }

      log.push(`[완료] ${game.name} ${page}페이지 - ${products.length}개 저장`);

      if (page < maxPages) await new Promise(r => setTimeout(r, 500));
    }
  }

  res.json({ ok: true, upserted: totalUpserted, failed: totalFailed, log });
});

// 크롤링 대상 게임 목록
router.get("/admin/crawl/games", requireAdmin, (_req, res): void => {
  const hasApiKey = !!process.env.SCRAPER_API_KEY;
  res.json({ games: GAME_LIST, hasApiKey });
});

// 로컬 크롤러 스크립트 다운로드
router.get("/admin/crawl/script", requireAdmin, (_req, res): void => {
  const fs = require("node:fs");
  const path = require("node:path");
  const scriptPath = path.join(process.cwd(), "scripts/src/crawl-itemmania.mjs");
  try {
    const content = fs.readFileSync(scriptPath, "utf-8");
    res.set("Content-Type", "application/javascript; charset=utf-8");
    res.set("Content-Disposition", 'attachment; filename="crawl-itemmania.mjs"');
    res.send(content);
  } catch {
    res.status(404).json({ error: "스크립트 파일을 찾을 수 없습니다." });
  }
});

export default router;
