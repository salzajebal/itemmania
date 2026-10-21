/** Always display Korean time, independently of server/browser timezone. */
export function listingTimeMarkup(value: unknown, seconds = true, mobile = false): string {
  if (!(value instanceof Date) && typeof value !== "string" && typeof value !== "number") return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const koreanTime = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}),
    hourCycle: "h23",
  }).format(date);
  return `<span${mobile ? ' class="msd-date"' : ""} data-listing-created-at="${date.toISOString()}" data-listing-time-seconds="${seconds ? "1" : "0"}" title="한국 시간 (KST, UTC+9)">${koreanTime}</span>`;
}