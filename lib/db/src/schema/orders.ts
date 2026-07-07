import { pgTable, serial, integer, bigint, timestamp, text, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { productsTable } from "./products";

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "shipped",
  "confirmed",
  "completed",
  "cancelled",
  "disputed",
]);

export const escrowTypeEnum = pgEnum("escrow_type", [
  "charge",
  "release",
  "refund",
]);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  buyerId: integer("buyer_id").notNull().references(() => usersTable.id),
  sellerId: integer("seller_id").references(() => usersTable.id),
  productId: integer("product_id").references(() => productsTable.id),
  productTitle: text("product_title").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  feeAmount: bigint("fee_amount", { mode: "number" }).notNull().default(0),
  status: orderStatusEnum("status").notNull().default("pending"),
  cancelReason: text("cancel_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const escrowLedgerTable = pgTable("escrow_ledger", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  type: escrowTypeEnum("type").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type EscrowLedger = typeof escrowLedgerTable.$inferSelect;
