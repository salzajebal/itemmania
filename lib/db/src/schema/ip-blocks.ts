import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const blockedIpsTable = pgTable("blocked_ips", {
  id: serial("id").primaryKey(),
  ip: varchar("ip", { length: 45 }).notNull().unique(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BlockedIp = typeof blockedIpsTable.$inferSelect;