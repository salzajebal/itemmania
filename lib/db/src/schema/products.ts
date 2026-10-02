import { pgTable, text, serial, timestamp, bigint, integer, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productStatusEnum = pgEnum("product_status", ["active", "sold", "inactive"]);

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  itemmaniaid: text("itemmania_id").notNull().unique(),
  title: text("title").notNull(),
  price: bigint("price", { mode: "number" }).notNull(),
  category: text("category"),
  gameName: text("game_name"),
  serverName: text("server_name"),
  sellerId: integer("seller_id"),
  sellerName: text("seller_name"),
  sellerGrade: text("seller_grade"),
  isPremium: boolean("is_premium").notNull().default(false),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  detailUrl: text("detail_url"),
  itemCategory: text("item_category"),
  status: productStatusEnum("status").notNull().default("active"),
  crawledAt: timestamp("crawled_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
