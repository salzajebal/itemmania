import { pgTable, text, serial, timestamp, pgEnum, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export type AuthStates = {
  excellent: boolean;
  phone: boolean;
  email: boolean;
  ipin: boolean;
  withdraw: boolean;
};

export const DEFAULT_AUTH_STATES: AuthStates = {
  excellent: false,
  phone: false,
  email: false,
  ipin: false,
  withdraw: false,
};

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  nickname: text("nickname").notNull(),
  name: text("name"),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("user"),
  authStates: jsonb("auth_states").$type<AuthStates>().notNull().default(DEFAULT_AUTH_STATES),
  grade: text("grade").default("gold"),
  creditScore: integer("credit_score").default(220),
  signupIp: text("signup_ip"),
  lastLoginIp: text("last_login_ip"),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: text("deleted_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
