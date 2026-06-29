import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botKvTable = pgTable("bot_kv", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activityTrackerTable = pgTable("activity_tracker", {
  userId: text("user_id").primaryKey(),
  lastMessage: timestamp("last_message", { withTimezone: true }),
  lastVoice: timestamp("last_voice", { withTimezone: true }),
  totalMessages: integer("total_messages").notNull().default(0),
});

export const authBackupsTable = pgTable("auth_backups", {
  userId: text("user_id").notNull(),
  guildId: text("guild_id").notNull().default(""),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiry: timestamp("token_expiry", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).defaultNow(),
});

export const insertBotKvSchema = createInsertSchema(botKvTable);
export const selectBotKvSchema = createSelectSchema(botKvTable);
export type BotKv = z.infer<typeof selectBotKvSchema>;
export type InsertBotKv = z.infer<typeof insertBotKvSchema>;

export const insertActivitySchema = createInsertSchema(activityTrackerTable);
export const selectActivitySchema = createSelectSchema(activityTrackerTable);
export type Activity = z.infer<typeof selectActivitySchema>;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export const insertAuthBackupSchema = createInsertSchema(authBackupsTable);
export const selectAuthBackupSchema = createSelectSchema(authBackupsTable);
export type AuthBackup = z.infer<typeof selectAuthBackupSchema>;
export type InsertAuthBackup = z.infer<typeof insertAuthBackupSchema>;
