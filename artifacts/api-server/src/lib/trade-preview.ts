import { createHmac, randomUUID } from "node:crypto";
import { request } from "node:http";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db, pool, usersTable, productsTable, chatRoomsTable, chatMessagesTable } from "@workspace/db";
import { and, eq, or } from "drizzle-orm";
import { createMemberAccount } from "./registration-policy";

// Development-only, isolated synthetic actors. Never borrow a real member's
// session or create demonstration records in the operating database.
let statePromise: Promise<Awaited<ReturnType<typeof seed>>> | null = null;
export const tradePreviewEnabled = () => process.env.NODE_ENV === "development";

async function seed() {
  if (!tradePreviewEnabled()) throw new Error("Preview disabled");
  async function actor(side: "buyer" | "seller") {
    const email = `trade-preview-${side}@itemmania.invalid`;
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existing) {
      if (existing.role !== "user" || existing.deletedAt || existing.suspendedAt) throw new Error("Invalid preview actor");
      return existing;
    }
    return (await createMemberAccount({
      email, nickname: side === "buyer" ? "프리뷰구매자" : "프리뷰판매자",
      name: side === "buyer" ? "구매자(테스트)" : "판매자(테스트)",
      passwordHash: await bcrypt.hash(randomUUID(), 10), role: "user", grade: "bronze",
    })).user;
  }
  const buyer = await actor("buyer"), seller = await actor("seller");
  const title = "[개발 프리뷰] [6억] 6억 메소 삽니다";
  const olderTitle = "[개발 프리뷰] 메이플플래닛 아이템 구매";
  let [product] = await db.select().from(productsTable).where(and(eq(productsTable.sellerId, buyer.id),
    or(eq(productsTable.title, title), eq(productsTable.title, olderTitle))));
  if (!product) [product] = await db.insert(productsTable).values({
    sellerId: buyer.id, category: "buy", title, price: 93000, itemmaniaid: "trade-preview-" + randomUUID(),
    status: "inactive",
    gameName: "메이플스토리월드", serverName: "로나", itemCategory: "게임머니",
    description: "화면 확인을 위한 개발용 거래입니다. 실제 판매 상품이 아닙니다.",
    registeredCharacterName: "구매캐릭터", characterNameInDescription: false,
  }).returning();
  if (product.status === "active" || product.title === olderTitle) {
    await db.update(productsTable).set({ status: "inactive", title, price: 93000,
      gameName: "메이플스토리월드", serverName: "로나", itemCategory: "게임머니" }).where(eq(productsTable.id, product.id));
  }
  let [room] = await db.select().from(chatRoomsTable).where(and(eq(chatRoomsTable.productId, product.id),
    eq(chatRoomsTable.buyerId, buyer.id), eq(chatRoomsTable.sellerId, seller.id)));
  if (!room) {
    [room] = await db.insert(chatRoomsTable).values({
      productId: product.id, buyerId: buyer.id, sellerId: seller.id, status: "active",
      characterName: "판매캐릭터", buyerCharacterName: "구매캐릭터", sellerCharacterName: "판매캐릭터",
    }).returning();
    await db.insert(chatMessagesTable).values([
      { roomId: room.id, senderId: buyer.id, content: "안녕하세요. 구매캐릭터로 거래하겠습니다." },
      { roomId: room.id, senderId: seller.id, content: "네, 판매캐릭터 확인했습니다. 아래에서 실제 메시지를 전송할 수 있습니다." },
    ]);
  }
  const sid = "trade-preview-" + randomUUID();
  await pool.query("INSERT INTO user_sessions(sid,sess,expire) VALUES($1,$2,now()+interval '1 day')", [sid, JSON.stringify({
    cookie: { originalMaxAge: 86400000, expires: new Date(Date.now() + 86400000).toISOString(), httpOnly: true, path: "/", sameSite: "lax", secure: false },
    userId: buyer.id, userRole: "user",
  })]);
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Session configuration missing");
  const signature = createHmac("sha256", secret).update(sid).digest("base64").replace(/=+$/, "");
  const safeBuyer = { id: buyer.id, email: buyer.email, nickname: buyer.nickname, role: buyer.role,
    grade: buyer.grade, creditScore: buyer.creditScore, authStates: buyer.authStates };
  return { buyer: safeBuyer, room, cookie: "connect.sid=" + encodeURIComponent("s:" + sid + "." + signature) };
}

export function getTradePreview() {
  if (!statePromise) statePromise = seed().catch(error => { statePromise = null; throw error; });
  return statePromise;
}

export function previewHtml(html: string) {
  return html.replaceAll("/api/", "/dev-trade-preview/api/")
    .replaceAll("'/api'", "'/dev-trade-preview/api'")
    .replaceAll('"/api"', '"/dev-trade-preview/api"')
    .replaceAll("/myroom/chat/new_chat.html?roomId=", "/dev-trade-preview/chat?roomId=");
}

export async function proxyTradePreview(req: Request, res: Response) {
  if (!tradePreviewEnabled()) { res.sendStatus(404); return; }
  const state = await getTradePreview();
  const path = req.originalUrl.slice("/dev-trade-preview".length);
  const pathname = path.split("?")[0];
  const roomPath = "/api/chat/rooms/" + state.room.id;
  const allowed = (req.method === "GET" && [roomPath, roomPath + "/messages", "/api/events", "/api/users/me",
    "/api/auth/me", "/api/products/my/stats", "/api/games"].includes(pathname)) ||
    (req.method === "POST" && [roomPath + "/messages", roomPath + "/upload"].includes(pathname));
  if (!allowed) { res.status(403).json({ error: "개발 프리뷰에서는 해당 동작을 사용할 수 없습니다." }); return; }
  const json = req.is("application/json") ? JSON.stringify(req.body) : null;
  const headers: Record<string, string> = { cookie: state.cookie };
  if (req.get("content-type")) headers["content-type"] = req.get("content-type")!;
  if (json !== null) headers["content-length"] = String(Buffer.byteLength(json));
  else if (req.get("content-length")) headers["content-length"] = req.get("content-length")!;
  const upstream = request({
    hostname: "127.0.0.1", port: Number(process.env.PORT || 8080), path, method: req.method, headers,
  }, response => {
    res.status(response.statusCode || 502);
    if (response.headers["content-type"]) res.setHeader("Content-Type", response.headers["content-type"]);
    res.setHeader("Cache-Control", "no-store");
    if (pathname === "/api/events") res.setHeader("X-Accel-Buffering", "no");
    response.pipe(res);
  });
  upstream.on("error", () => { if (!res.headersSent) res.status(502).json({ error: "프리뷰 연결을 다시 시도해 주세요." }); else res.end(); });
  res.on("close", () => upstream.destroy());
  if (json !== null) upstream.end(json); else req.pipe(upstream);
}
