import { pgTable, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Bank details are private self-service data, never part of public user models.
export const memberProfilesTable = pgTable("member_profiles", {
  userId: integer("user_id").primaryKey().references(() => usersTable.id),
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),
  bankAccountHolder: text("bank_account_holder"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
