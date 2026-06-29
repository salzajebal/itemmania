import { Router, type IRouter } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { db, usersTable, ordersTable, withdrawalsTable, walletsTable, productsTable } from "@workspace/db";
import type { AuthStates } from "@workspace/db";
import { pushToUser } from "../lib/sse";
import * as cheerio from "cheerio";

const router: IRouter = Router();

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
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) { res.status(404).json({ error: "회원을 찾을 수 없습니다." }); return; }
  if (target.role === "admin") { res.status(403).json({ error: "관리자 계정은 삭제할 수 없습니다." }); return; }
  await db.delete(walletsTable).where(eq(walletsTable.userId, id));
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

// ── 상품 관리 ──────────────────────────────────────────────────────

// 전체 상품 목록
router.get("/admin/products", async (req, res): Promise<void> => {
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
router.delete("/admin/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!existing) { res.status(404).json({ error: "상품을 찾을 수 없습니다." }); return; }
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.json({ ok: true });
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
  { id: 138,  name: "메이플스토리",       slug: "maplestory" },
  { id: 5233, name: "메이플스토리월드",   slug: "maplestory-world" },
  { id: 281,  name: "던전앤파이터",       slug: "dnf" },
  { id: 5913, name: "리니지 클래식",     slug: "lineage-classic" },
  { id: 5799, name: "아이온2",            slug: "aion2" },
  { id: 155,  name: "마비노기",           slug: "mabinogi" },
  { id: 101,  name: "거상",               slug: "geosang" },
];

function scraperUrl(targetUrl: string, apiKey: string, sessionNumber: number): string {
  return `https://api.scraperapi.com/?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}&render=false&country_code=kr&session_number=${sessionNumber}`;
}

async function scraperFetch(url: string, apiKey: string | undefined, sessionNumber: number, timeoutMs = 55000): Promise<{text: string | null; status: number | null; error: string | null}> {
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

async function fetchPageHtml(gameId: number, page: number, apiKey: string | undefined, sessionNumber: number): Promise<{html: string | null; statusCode: number | null; error: string | null}> {
  const url = `https://www.itemmania.com/sell/list.html?search_game=${gameId}&search_goods=all&page=${page}`;
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

function parseProductsFromHtml(html: string, gameId: number): Array<{
  itemmaniaid: string;
  title: string;
  price: number;
  gameName: string;
  serverName: string;
  category: string;
  itemCategory: string;
  detailUrl: string;
  sellerGrade: string | null;
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
    const priceText = $(el).find(".trade_money").first().text().replace(/[^0-9]/g, "")
      || $(el).find(".price").first().text().replace(/[^0-9]/g, "");
    const price = parseInt(priceText, 10) || 0;
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
    products.push({
      itemmaniaid: tid,
      title,
      price,
      gameName: gameName || gameFallbackName,
      serverName: serverName || "",
      category: "sell",
      itemCategory: itemCategory || "",
      detailUrl: `https://www.itemmania.com/sell/application.html?id=${tid}`,
      sellerGrade,
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
          category: "sell",
          itemCategory: String(it["goods_kind"] || it["itemCategory"] || ""),
          detailUrl: `https://www.itemmania.com/sell/application.html?id=${tid}`,
          sellerGrade: null,
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

  const maxPages = Math.min(Math.max(1, pages), 5);
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
router.post("/admin/crawl/stream", async (req, res): Promise<void> => {
  const { gameIds, pages = 1, scraperApiKey, crawlDetail = false } = req.body as {
    gameIds?: number[];
    pages?: number;
    scraperApiKey?: string;
    crawlDetail?: boolean;
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const apiKey: string | undefined = scraperApiKey || process.env.SCRAPER_API_KEY;

  if (!apiKey) {
    send({ type: "fail", message: "❌ ScraperAPI 키가 없습니다. 키를 입력하고 다시 시도하세요." });
    send({ type: "done", upserted: 0, failed: 0, detailFetched: 0, detailFailed: 0, message: "\n✅ 크롤 중단됨 (ScraperAPI 키 없음)" });
    res.end();
    return;
  }

  const sessionNumber = Math.floor(Math.random() * 9000) + 1000;
  const targetGames = gameIds && gameIds.length > 0
    ? GAME_LIST.filter(g => gameIds.includes(g.id))
    : GAME_LIST.slice(0, 3);
  const maxPages = Math.min(Math.max(1, pages), 5);

  let totalUpserted = 0;
  let totalFailed = 0;
  let detailFetched = 0;
  let detailFailed = 0;

  send({ type: "progress", message: `  🌐 세션 초기화 중... (session #${sessionNumber})` });
  await initSession(apiKey, sessionNumber);
  send({ type: "progress", message: `  ✓ 세션 초기화 완료` });

  for (const game of targetGames) {
    send({ type: "game", message: `\n▶ [${game.name}] 시작` });
    for (let page = 1; page <= maxPages; page++) {
      send({ type: "progress", message: `  ${page}/${maxPages}페이지 크롤 중...` });
      const {html, error} = await fetchPageHtml(game.id, page, apiKey, sessionNumber);
      if (!html) {
        send({ type: "fail", message: `  ✗ ${game.name} ${page}페이지 - 실패 (${error ?? "HTML 없음"})` });
        totalFailed++;
        continue;
      }

      const listItemCount = (html.match(/list_item/g) || []).length;
      const hasNextData = html.includes("__NEXT_DATA__");
      const dataTidCount = (html.match(/data-tid=/g) || []).length;
      const apiMatches = (html.match(/["'](\/api\/[^"']{3,60})["']/g) || []).slice(0, 5).join(" | ");
      const products = parseProductsFromHtml(html, game.id);
      if (products.length === 0) {
        send({ type: "warn", message: `  ⚠ ${game.name} ${page}페이지 - 상품 없음 (${html.length}바이트, list_item:${listItemCount}, data-tid:${dataTidCount}, __NEXT_DATA__:${hasNextData})` });
        if (apiMatches) send({ type: "progress", message: `  🔍 API URL 패턴: ${apiMatches}` });
        const dataTidIdx = html.indexOf("data-tid=");
        if (dataTidIdx >= 0) {
          const snippet = html.slice(Math.max(0, dataTidIdx - 20), dataTidIdx + 300).replace(/\s+/g, " ");
          send({ type: "progress", message: `  🔍 data-tid 주변: ${snippet}` });
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
          }).onConflictDoUpdate({
            target: productsTable.itemmaniaid,
            set: {
              title: p.title, price: p.price, gameName: p.gameName,
              serverName: p.serverName, itemCategory: p.itemCategory,
              sellerGrade: p.sellerGrade ?? null,
              detailUrl: p.detailUrl, status: "active", crawledAt: new Date(),
            },
          });
          totalUpserted++;
          pageSaved++;
        } catch {
          totalFailed++;
        }

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

      send({ type: "ok", message: `  ✓ ${game.name} ${page}페이지 - ${pageSaved}개 저장${crawlDetail ? ` (상세 ${detailFetched}개)` : ""}` });
      if (page < maxPages) await new Promise(r => setTimeout(r, 500));
    }
  }

  send({ type: "done", upserted: totalUpserted, failed: totalFailed, detailFetched, detailFailed,
    message: `\n✅ 완료! 총 ${totalUpserted}개 저장 / ${totalFailed}개 실패${crawlDetail ? ` / 상세 ${detailFetched}개` : ""}` });
  res.end();
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
    }>;
  };

  if (!Array.isArray(products) || products.length === 0) {
    res.status(400).json({ error: "products 배열이 필요합니다." });
    return;
  }

  let upserted = 0;
  let failed = 0;

  for (const p of products) {
    if (!p.itemmaniaid || !p.title) { failed++; continue; }
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
        status: "active",
        crawledAt: new Date(),
      }).onConflictDoUpdate({
        target: productsTable.itemmaniaid,
        set: {
          title: p.title,
          price: Number(p.price) || 0,
          gameName: p.gameName || null,
          serverName: p.serverName || null,
          itemCategory: p.itemCategory || null,
          detailUrl: p.detailUrl || null,
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

// 로컬 크롤러 스크립트 다운로드
router.get("/admin/crawl/script", (_req, res): void => {
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
