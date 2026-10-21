type ChatTradeRoom = { id: number; orderId: number | null; createdAt: Date | string };
type LinkedTrade = { createdAt: Date | string };

/** Stable, unique room reference; it is not an order ID or a payment record. */
export function chatTradeReference(roomId: number): string {
  if (!Number.isSafeInteger(roomId) || roomId < 1 || roomId > 2147483647) {
    throw new RangeError("Invalid chat room ID");
  }
  // An odd multiplier is a bijection modulo 2^32: no collisions for stored
  // positive PostgreSQL integer IDs. No randomness, secret or new DB row needed.
  const number = (BigInt(roomId) * 2654435761n) % 4294967296n;
  return `C-${number.toString().padStart(10, "0")}`;
}

function koreanDateTime(value: Date | string | undefined): string {
  if (value === undefined) return "미확인";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "미확인";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(date);
}

/** Keep room/order IDs separate, and never infer a trade date from a listing. */
export function chatTradeInfo(room: ChatTradeRoom, trade?: LinkedTrade | null): string {
  if (room.orderId !== null) {
    return `거래번호 #${room.orderId} | 거래일시 ${koreanDateTime(trade?.createdAt)} | 채팅방 #${room.id}`;
  }
  return `거래참조번호 ${chatTradeReference(room.id)} | 신청일시 ${koreanDateTime(room.createdAt)} | 채팅방 #${room.id}`;
}