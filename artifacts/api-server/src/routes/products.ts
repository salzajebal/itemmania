import { Router, type IRouter } from "express";
import { eq, ilike, and, sql, desc, asc, count, inArray } from "drizzle-orm";
import { db, productsTable, gamesTable, ordersTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

type ProductRow = {
  id: number; itemmaniaid: string; title: string; price: number;
  category: string | null; itemCategory: string | null;
  gameName: string | null; serverName: string | null;
  sellerId: number | null; sellerName: string | null;
  description: string | null; thumbnailUrl: string | null;
  detailUrl: string | null; status: string | null;
  crawledAt: Date | null; createdAt: Date;
  sellerGrade?: string | null;
};

function formatProduct(p: ProductRow) {
  return {
    id: p.id,
    itemmaniaid: p.itemmaniaid,
    title: p.title,
    price: Number(p.price),
    category: p.category,
    itemCategory: p.itemCategory,
    gameName: p.gameName,
    serverName: p.serverName,
    sellerId: p.sellerId,
    sellerName: p.sellerName,
    sellerGrade: p.sellerGrade ?? null,
    description: p.description,
    thumbnailUrl: p.thumbnailUrl,
    detailUrl: p.detailUrl,
    status: p.status,
    crawledAt: p.crawledAt,
    createdAt: p.createdAt,
  };
}

// 상품 목록 (게임코드 변환 지원)
router.get("/products", async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;
  const { category, itemCategory, gameName, keyword, gameCode, serverName, sort } = req.query;

  const conditions = [eq(productsTable.status, "active")];

  // category: sell/buy 구분 필터
  if (category && typeof category === "string") {
    conditions.push(eq(productsTable.category, category));
  }

  // itemCategory: 게임머니/아이템/계정/기타 필터
  if (itemCategory && typeof itemCategory === "string") {
    conditions.push(eq(productsTable.itemCategory, itemCategory));
  }

  // gameCode → gameName 변환 (itemmania 게임코드를 게임명으로)
  if (gameCode && typeof gameCode === "string" && gameCode.trim()) {
    const [game] = await db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.code, gameCode.trim()))
      .limit(1);
    if (game) {
      conditions.push(eq(productsTable.gameName, game.name));
    }
  } else if (gameName && typeof gameName === "string") {
    conditions.push(eq(productsTable.gameName, gameName));
  }

  if (serverName && typeof serverName === "string") {
    conditions.push(eq(productsTable.serverName, serverName));
  }

  if (keyword && typeof keyword === "string") {
    conditions.push(ilike(productsTable.title, `%${keyword}%`));
  }

  const where = conditions.length > 1 ? and(...conditions) : conditions[0];

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(where);

  const sortOrder = sort === "price_asc"
    ? asc(productsTable.price)
    : sort === "price_desc"
      ? desc(productsTable.price)
      : desc(productsTable.createdAt);

  const items = await db
    .select({
      id: productsTable.id,
      itemmaniaid: productsTable.itemmaniaid,
      title: productsTable.title,
      price: productsTable.price,
      category: productsTable.category,
      itemCategory: productsTable.itemCategory,
      gameName: productsTable.gameName,
      serverName: productsTable.serverName,
      sellerId: productsTable.sellerId,
      sellerName: productsTable.sellerName,
      description: productsTable.description,
      thumbnailUrl: productsTable.thumbnailUrl,
      detailUrl: productsTable.detailUrl,
      status: productsTable.status,
      crawledAt: productsTable.crawledAt,
      createdAt: productsTable.createdAt,
      sellerGrade: usersTable.grade,
    })
    .from(productsTable)
    .leftJoin(usersTable, eq(productsTable.sellerId, usersTable.id))
    .where(where)
    .orderBy(sortOrder)
    .limit(limit)
    .offset(offset);

  res.json({ items: items.map(formatProduct), total: count, page, limit });
});

// 상품 상세
router.get("/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id) || id > 2147483647 || id < 1) { res.status(404).json({ error: "상품을 찾을 수 없습니다." }); return; }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) { res.status(404).json({ error: "상품을 찾을 수 없습니다." }); return; }

  res.json(formatProduct(product));
});

// 상품 등록 (로그인 필요)
router.post("/products", requireAuth, async (req, res): Promise<void> => {
  const { title, price, gameName, serverName, category, itemCategory, description, sellerName } =
    req.body as Record<string, string>;

  if (!title || !price) {
    res.status(400).json({ error: "title과 price는 필수입니다." }); return;
  }

  const priceNum = parseInt(String(price).replace(/,/g, ""), 10);
  if (isNaN(priceNum) || priceNum <= 0) {
    res.status(400).json({ error: "price는 양수 정수여야 합니다." }); return;
  }

  const itemmaniaid = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = req.session.userId!;

  const [inserted] = await db
    .insert(productsTable)
    .values({
      itemmaniaid,
      title: String(title).trim(),
      price: priceNum,
      gameName: gameName ? String(gameName).trim() : null,
      serverName: serverName ? String(serverName).trim() : null,
      category: category ? String(category).trim() : "sell",
      itemCategory: itemCategory ? String(itemCategory).trim() : null,
      sellerId: userId,
      sellerName: sellerName ? String(sellerName).trim() : null,
      description: description ? String(description).trim() : null,
      status: "active",
    })
    .returning();

  res.status(201).json(formatProduct(inserted));
});

// 내 상품 목록 (로그인 필요)
// 나의 거래 현황 통계
router.get("/products/my/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const [sellTotal] = await db
    .select({ cnt: count() })
    .from(productsTable)
    .where(eq(productsTable.sellerId, userId));

  const [sellActive] = await db
    .select({ cnt: count() })
    .from(productsTable)
    .where(and(eq(productsTable.sellerId, userId), eq(productsTable.status, "active")));

  const [sellPending] = await db
    .select({ cnt: count() })
    .from(ordersTable)
    .where(and(eq(ordersTable.sellerId, userId), eq(ordersTable.status, "pending")));

  const [buyTotal] = await db
    .select({ cnt: count() })
    .from(ordersTable)
    .where(eq(ordersTable.buyerId, userId));

  const [buyPending] = await db
    .select({ cnt: count() })
    .from(ordersTable)
    .where(and(eq(ordersTable.buyerId, userId), eq(ordersTable.status, "pending")));

  const [buyProcessing] = await db
    .select({ cnt: count() })
    .from(ordersTable)
    .where(and(eq(ordersTable.buyerId, userId), inArray(ordersTable.status, ["shipped", "confirmed"])));

  res.json({
    sellTotal: Number(sellTotal?.cnt ?? 0),
    sellActive: Number(sellActive?.cnt ?? 0),
    sellPending: Number(sellPending?.cnt ?? 0),
    buyTotal: Number(buyTotal?.cnt ?? 0),
    buyPending: Number(buyPending?.cnt ?? 0),
    buyProcessing: Number(buyProcessing?.cnt ?? 0),
  });
});

router.get("/products/my/list", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const items = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.sellerId, userId))
    .orderBy(desc(productsTable.createdAt));
  res.json(items.map(formatProduct));
});

// 상품 삭제 / 비활성화 (판매자 본인 또는 관리자)
router.delete("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "잘못된 ID" }); return; }
  const userId = req.session.userId!;

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) { res.status(404).json({ error: "상품을 찾을 수 없습니다." }); return; }
  if (product.sellerId !== userId && req.session.userRole !== "admin") {
    res.status(403).json({ error: "권한이 없습니다." }); return;
  }

  await db.update(productsTable).set({ status: "inactive" }).where(eq(productsTable.id, id));
  res.json({ ok: true });
});

export default router;
