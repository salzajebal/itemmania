import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const registrationSettingsTable = pgTable("registration_settings", {
  key: text("key").primaryKey(),
  blocked: boolean("blocked").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRegistrationSettingSchema = createInsertSchema(registrationSettingsTable).omit({ updatedAt: true });
export type InsertRegistrationSetting = z.infer<typeof insertRegistrationSettingSchema>;
export type RegistrationSetting = typeof registrationSettingsTable.$inferSelect;