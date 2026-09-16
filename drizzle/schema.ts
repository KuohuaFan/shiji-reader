import { bigint, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const correctionReports = mysqlTable("correction_reports", {
  id: int("id").autoincrement().primaryKey(),
  reportCode: varchar("reportCode", { length: 24 }).notNull().unique(),
  volume: int("volume").notNull(),
  chapterTitle: varchar("chapterTitle", { length: 120 }).notNull(),
  layer: mysqlEnum("layer", ["original", "translation"]).notNull(),
  sectionIndex: int("sectionIndex"),
  blockIndex: int("blockIndex"),
  selectedText: text("selectedText"),
  suggestion: text("suggestion").notNull(),
  reason: mysqlEnum("reason", ["typo", "translation", "omission", "punctuation", "other"]).notNull(),
  evidence: text("evidence"),
  reporterName: varchar("reporterName", { length: 120 }),
  reporterEmail: varchar("reporterEmail", { length: 320 }),
  status: mysqlEnum("status", ["pending", "reviewing", "accepted", "rejected"]).default("pending").notNull(),
  reviewNote: text("reviewNote"),
  reviewedBy: int("reviewedBy"),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  resolvedAt: bigint("resolvedAt", { mode: "number" }),
});

export const chapterReviews = mysqlTable("chapter_reviews", {
  id: int("id").autoincrement().primaryKey(),
  volume: int("volume").notNull(),
  status: mysqlEnum("status", ["pending", "in_review", "reviewed"]).default("pending").notNull(),
  reviewerId: int("reviewerId"),
  reviewerName: varchar("reviewerName", { length: 120 }),
  notes: text("notes"),
  reviewedAt: bigint("reviewedAt", { mode: "number" }),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
}, table => ({
  volumeIndex: uniqueIndex("chapter_review_volume_idx").on(table.volume),
}));

export const translationRevisions = mysqlTable("translation_revisions", {
  id: int("id").autoincrement().primaryKey(),
  volume: int("volume").notNull(),
  sectionIndex: int("sectionIndex").notNull(),
  blockIndex: int("blockIndex").notNull(),
  originalTranslation: text("originalTranslation").notNull(),
  revisedTranslation: text("revisedTranslation").notNull(),
  rationale: text("rationale"),
  reviewerId: int("reviewerId").notNull(),
  reviewerName: varchar("reviewerName", { length: 120 }),
  published: int("published").default(0).notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
}, table => ({
  blockIndex: uniqueIndex("translation_revision_block_idx").on(table.volume, table.sectionIndex, table.blockIndex),
}));

export const eventLedgerAnalyses = mysqlTable("event_ledger_analyses", {
  id: int("id").autoincrement().primaryKey(),
  artifactCode: varchar("artifactCode", { length: 32 }).notNull().unique(),
  title: varchar("title", { length: 240 }).notNull(),
  category: mysqlEnum("category", ["政治", "歷史", "法制", "國際", "社會", "經濟"]).notNull(),
  jurisdiction: varchar("jurisdiction", { length: 120 }).notNull(),
  eventDate: varchar("eventDate", { length: 40 }).notNull(),
  status: mysqlEnum("status", ["ai_draft", "reviewed", "published"]).default("ai_draft").notNull(),
  inputSnapshot: text("inputSnapshot").notNull(),
  outputSnapshot: text("outputSnapshot").notNull(),
  promptSummary: text("promptSummary").notNull(),
  promptHash: varchar("promptHash", { length: 64 }).notNull(),
  sourceSnapshotHash: varchar("sourceSnapshotHash", { length: 64 }).notNull(),
  model: varchar("model", { length: 80 }).notNull(),
  analyzedAt: bigint("analyzedAt", { mode: "number" }).notNull(),
  reviewedBy: int("reviewedBy"),
  reviewNote: text("reviewNote"),
  reviewedAt: bigint("reviewedAt", { mode: "number" }),
  publishedAt: bigint("publishedAt", { mode: "number" }),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
});

export const eventLedgerRevisions = mysqlTable("event_ledger_revisions", {
  id: int("id").autoincrement().primaryKey(),
  analysisId: int("analysisId").notNull(),
  revisionNumber: int("revisionNumber").notNull(),
  contentSnapshot: text("contentSnapshot").notNull(),
  revisionNote: text("revisionNote").notNull(),
  editorId: int("editorId").notNull(),
  editorName: varchar("editorName", { length: 120 }),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
}, table => ({
  analysisRevisionIndex: uniqueIndex("event_ledger_revision_idx").on(table.analysisId, table.revisionNumber),
}));

export const eventLedgerOutcomes = mysqlTable("event_ledger_outcomes", {
  id: int("id").autoincrement().primaryKey(),
  analysisId: int("analysisId").notNull(),
  horizonDays: int("horizonDays").notNull(),
  outcome: mysqlEnum("outcome", ["occurred", "not_occurred", "indeterminate"]).notNull(),
  resolutionNote: text("resolutionNote").notNull(),
  brierScoreMicros: int("brierScoreMicros"),
  resolvedBy: int("resolvedBy").notNull(),
  resolvedAt: bigint("resolvedAt", { mode: "number" }).notNull(),
}, table => ({
  analysisHorizonIndex: uniqueIndex("event_ledger_outcome_idx").on(table.analysisId, table.horizonDays),
}));

export type CorrectionReport = typeof correctionReports.$inferSelect;
export type InsertCorrectionReport = typeof correctionReports.$inferInsert;
export type ChapterReview = typeof chapterReviews.$inferSelect;
export type TranslationRevision = typeof translationRevisions.$inferSelect;
export type EventLedgerAnalysis = typeof eventLedgerAnalyses.$inferSelect;
export type EventLedgerRevision = typeof eventLedgerRevisions.$inferSelect;
export type EventLedgerOutcome = typeof eventLedgerOutcomes.$inferSelect;
