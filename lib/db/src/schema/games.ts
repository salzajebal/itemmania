import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const gamesTable = pgTable("games", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameServersTable = pgTable("game_servers", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => gamesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type Game = typeof gamesTable.$inferSelect;
export type GameServer = typeof gameServersTable.$inferSelect;
