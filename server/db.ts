import { and, asc, desc, eq, max } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  chapterReviews,
  correctionReports,
  eventLedgerAnalyses,
  eventLedgerOutcomes,
  eventLedgerRevisions,
  InsertCorrectionReport,
  InsertUser,
  translationRevisions,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createCorrectionReport(report: InsertCorrectionReport) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(correctionReports).values(report);
  return report.reportCode;
}

export async function getCorrectionReportByCode(reportCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({
    reportCode: correctionReports.reportCode,
    volume: correctionReports.volume,
    chapterTitle: correctionReports.chapterTitle,
    layer: correctionReports.layer,
    status: correctionReports.status,
    reviewNote: correctionReports.reviewNote,
    createdAt: correctionReports.createdAt,
    updatedAt: correctionReports.updatedAt,
  }).from(correctionReports).where(eq(correctionReports.reportCode, reportCode)).limit(1);
  return rows[0];
}

export async function listCorrectionReports() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(correctionReports).orderBy(desc(correctionReports.createdAt)).limit(500);
}

export async function updateCorrectionReport(
  id: number,
  values: Partial<Pick<typeof correctionReports.$inferInsert, "status" | "reviewNote" | "reviewedBy" | "resolvedAt" | "updatedAt">>,
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(correctionReports).set(values).where(eq(correctionReports.id, id));
}

export async function listChapterReviews() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chapterReviews).orderBy(asc(chapterReviews.volume));
}

export async function getChapterReview(volume: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({
    volume: chapterReviews.volume,
    status: chapterReviews.status,
    reviewerName: chapterReviews.reviewerName,
    reviewedAt: chapterReviews.reviewedAt,
  }).from(chapterReviews).where(eq(chapterReviews.volume, volume)).limit(1);
  return rows[0];
}

export async function upsertChapterReview(values: typeof chapterReviews.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(chapterReviews).values(values).onDuplicateKeyUpdate({
    set: {
      status: values.status,
      reviewerId: values.reviewerId,
      reviewerName: values.reviewerName,
      notes: values.notes,
      reviewedAt: values.reviewedAt,
      updatedAt: values.updatedAt,
    },
  });
}

export async function upsertTranslationRevision(values: typeof translationRevisions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(translationRevisions).values(values).onDuplicateKeyUpdate({
    set: {
      originalTranslation: values.originalTranslation,
      revisedTranslation: values.revisedTranslation,
      rationale: values.rationale,
      reviewerId: values.reviewerId,
      reviewerName: values.reviewerName,
      published: values.published,
      updatedAt: values.updatedAt,
    },
  });
}

export async function listTranslationRevisions(volume: number, publishedOnly = false) {
  const db = await getDb();
  if (!db) return [];
  const condition = publishedOnly
    ? and(eq(translationRevisions.volume, volume), eq(translationRevisions.published, 1))
    : eq(translationRevisions.volume, volume);
  return db.select().from(translationRevisions)
    .where(condition)
    .orderBy(asc(translationRevisions.sectionIndex), asc(translationRevisions.blockIndex));
}

export async function listPublishedTranslationRevisions(volume: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    sectionIndex: translationRevisions.sectionIndex,
    blockIndex: translationRevisions.blockIndex,
    revisedTranslation: translationRevisions.revisedTranslation,
    rationale: translationRevisions.rationale,
    reviewerName: translationRevisions.reviewerName,
    updatedAt: translationRevisions.updatedAt,
  }).from(translationRevisions)
    .where(and(eq(translationRevisions.volume, volume), eq(translationRevisions.published, 1)))
    .orderBy(asc(translationRevisions.sectionIndex), asc(translationRevisions.blockIndex));
}

export async function createEventLedgerAnalysis(values: typeof eventLedgerAnalyses.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(eventLedgerAnalyses).values(values);
  const rows = await db.select({ id: eventLedgerAnalyses.id }).from(eventLedgerAnalyses)
    .where(eq(eventLedgerAnalyses.artifactCode, values.artifactCode)).limit(1);
  return rows[0];
}

export async function listEventLedgerAnalyses() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(eventLedgerAnalyses).orderBy(desc(eventLedgerAnalyses.createdAt)).limit(200);
}

export async function getEventLedgerAnalysis(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(eventLedgerAnalyses).where(eq(eventLedgerAnalyses.id, id)).limit(1);
  return rows[0];
}

export async function getEventLedgerAnalysisBySourceHash(sourceSnapshotHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ id: eventLedgerAnalyses.id, artifactCode: eventLedgerAnalyses.artifactCode, status: eventLedgerAnalyses.status })
    .from(eventLedgerAnalyses).where(eq(eventLedgerAnalyses.sourceSnapshotHash, sourceSnapshotHash)).limit(1);
  return rows[0];
}

export async function getPublishedEventLedgerByCode(artifactCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({
    artifactCode: eventLedgerAnalyses.artifactCode,
    title: eventLedgerAnalyses.title,
    category: eventLedgerAnalyses.category,
    jurisdiction: eventLedgerAnalyses.jurisdiction,
    eventDate: eventLedgerAnalyses.eventDate,
    status: eventLedgerAnalyses.status,
    outputSnapshot: eventLedgerAnalyses.outputSnapshot,
    model: eventLedgerAnalyses.model,
    analyzedAt: eventLedgerAnalyses.analyzedAt,
    reviewNote: eventLedgerAnalyses.reviewNote,
    reviewedAt: eventLedgerAnalyses.reviewedAt,
    publishedAt: eventLedgerAnalyses.publishedAt,
  }).from(eventLedgerAnalyses).where(and(eq(eventLedgerAnalyses.artifactCode, artifactCode), eq(eventLedgerAnalyses.status, "published"))).limit(1);
  return rows[0];
}

export async function updateEventLedgerAnalysis(
  id: number,
  values: Partial<Pick<typeof eventLedgerAnalyses.$inferInsert, "status" | "outputSnapshot" | "reviewedBy" | "reviewNote" | "reviewedAt" | "publishedAt" | "updatedAt">>,
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(eventLedgerAnalyses).set(values).where(eq(eventLedgerAnalyses.id, id));
}

export async function createEventLedgerRevision(values: Omit<typeof eventLedgerRevisions.$inferInsert, "revisionNumber">) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select({ value: max(eventLedgerRevisions.revisionNumber) }).from(eventLedgerRevisions)
    .where(eq(eventLedgerRevisions.analysisId, values.analysisId));
  const revisionNumber = Number(rows[0]?.value || 0) + 1;
  await db.insert(eventLedgerRevisions).values({ ...values, revisionNumber });
  return revisionNumber;
}

export async function upsertEventLedgerOutcome(values: typeof eventLedgerOutcomes.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(eventLedgerOutcomes).values(values).onDuplicateKeyUpdate({
    set: {
      outcome: values.outcome,
      resolutionNote: values.resolutionNote,
      brierScoreMicros: values.brierScoreMicros,
      resolvedBy: values.resolvedBy,
      resolvedAt: values.resolvedAt,
    },
  });
}

export async function listEventLedgerOutcomes(analysisId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(eventLedgerOutcomes).where(eq(eventLedgerOutcomes.analysisId, analysisId)).orderBy(asc(eventLedgerOutcomes.horizonDays));
}
