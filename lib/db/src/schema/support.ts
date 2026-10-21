import { pgTable, integer, serial, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const supportConversationsTable = pgTable("support_conversations", {
  userId: integer("user_id").primaryKey().references(() => usersTable.id),
  memberReadId: integer("member_read_id").notNull().default(0),
  adminReadId: integer("admin_read_id").notNull().default(0),
  lastMessageId: integer("last_message_id").notNull().default(0),
  lastMessagePreview: text("last_message_preview").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("support_conversations_latest_idx").on(t.lastMessageId)]);

export const supportMessagesTable = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => supportConversationsTable.userId),
  sender: text("sender").notNull().$type<"member" | "admin">(),
  senderId: integer("sender_id").notNull().references(() => usersTable.id),
  body: text("body").notNull(),
  clientId: text("client_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex("support_messages_request_unique").on(t.userId, t.sender, t.clientId),
  index("support_messages_owner_id_idx").on(t.userId, t.id),
]);
