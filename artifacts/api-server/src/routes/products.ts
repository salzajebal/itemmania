import { Router, type IRouter } from "express";
import { eq, like, and, sql } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";

const router: IRouter = Router();

function formatProduct(p: typeof productsTable.$inferSelect) {
  return {
    id: p.id,
    itemmaniaid: p.itemmaniaid,
    title: p.title,
    price: Number(p.price),
    category: p.category,
    gameName: p.gameName,
    sellerName: p.sellerName,
    description: p.description,
    thumbnailUrl: p.thumbnailUrl,
    detailUrl: p.detailUrl,
    status: p.status,
    crawledAt: p.crawledAt,
  };
}

// 상품 목록
router.get("/products", async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;
  const { category, gameName, keyword } = req.query;

  const conditions = [eq(productsTable.status, "active")];
  if (category && typeof category === "string") {
    conditions.push(eq(productsTable.category, category));
  }
  if (gameName && typeof gameName === "string") {
    conditions.push(eq(productsTable.gameName, gameName));
  }
  if (keyword && typeof keyword === "string") {
    conditions.push(like(productsTable.title, `%${keyword}%`));
  }

  const where = conditions.length > 1 ? and(...conditions) : conditions[0];

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(where);
  const items = await db.select().from(productsTable).where(where).limit(limit).offset(offset);

  res.json({
    items: items.map(formatProduct),
    total: count,
    page,
    limit,
  });
});

// 상품 상세
router.get("/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) {
    res.status(404).json({ error: "상품을 찾을 수 없습니다." });
    return;
  }

  res.json(formatProduct(product));
});

export default router;
