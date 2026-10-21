import { pool } from "@workspace/db";

export type TradeSide = "buy" | "sell";
export type OngoingTrade = {
  id: number; orderId: number | null; roomId: number | null;
  productId: number | null; productTitle: string; amount: number; status: string; createdAt: Date;
  gameName: string | null; serverName: string | null; itemCategory: string | null; category: string | null;
};

export function ongoingTradeHref(trade: Pick<OngoingTrade, "roomId" | "orderId">, side: TradeSide): string {
  const page = `/myroom/${side}/${side}_ing.html`;
  if (trade.roomId) return `${page}?roomId=${trade.roomId}`;
  if (trade.orderId) return `${page}?orderId=${trade.orderId}`;
  return page;
}

// Application rooms are trades before settlement creates an order. Read both
// sources without creating orders, charging wallets, or rewriting old records.
export async function ongoingTrades(userId: number, side: TradeSide): Promise<OngoingTrade[]> {
  const role = side === "buy" ? "buyer_id" : "seller_id";
  const { rows } = await pool.query(`
    SELECT o.id,o.id AS order_id,
      (SELECT min(c.id) FROM chat_rooms c WHERE c.order_id=o.id
        AND c.buyer_id=o.buyer_id AND c.seller_id=o.seller_id) AS room_id,
      o.product_id,o.product_title,o.amount,o.status::text AS status,o.created_at,
      p.game_name,p.server_name,p.item_category,p.category
    FROM orders o LEFT JOIN products p ON p.id=o.product_id
    WHERE o.${role}=$1 AND o.status IN ('pending','shipped')
    UNION ALL
    SELECT c.id,NULL,c.id,c.product_id,p.title,p.price,c.status,c.created_at,
      p.game_name,p.server_name,p.item_category,p.category
    FROM chat_rooms c JOIN products p ON p.id=c.product_id
    WHERE c.${role}=$1 AND c.order_id IS NULL AND c.status IN ('pending','active','handover')
    ORDER BY created_at DESC,id DESC`, [userId]);
  return rows.map(row => ({
    id: row.id, orderId: row.order_id, roomId: row.room_id,
    productId: row.product_id, productTitle: row.product_title, amount: Number(row.amount),
    status: row.status, createdAt: row.created_at, gameName: row.game_name,
    serverName: row.server_name, itemCategory: row.item_category, category: row.category,
  }));
}
