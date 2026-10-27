import { pgTable, serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => accounts.id),
  title: text("title").notNull(),
  // The language the learner is studying in this conversation. Persisted so an
  // old chat still renders and scores in its original language even after the
  // global selection changes. Defaults to "ur" to preserve pre-existing chats.
  language: text("language").notNull().default("ur"),
  // The learner's expertise level this conversation is taught at. Persisted so
  // reopening an old chat keeps its original teaching depth even after the
  // active level changes. Defaults to "beginner".
  level: text("level").notNull().default("beginner"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("conversations_user_idx").on(t.userId)]);

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
