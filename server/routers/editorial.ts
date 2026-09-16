import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createCorrectionReport,
  getChapterReview,
  getCorrectionReportByCode,
  listChapterReviews,
  listCorrectionReports,
  listPublishedTranslationRevisions,
  listTranslationRevisions,
  updateCorrectionReport,
  upsertChapterReview,
  upsertTranslationRevision,
} from "../db";
import { loadShijiLayers } from "../shijiContent";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";

const submissions = new Map<string, number[]>();

function address(req: { headers?: Record<string, unknown>; ip?: string; socket?: { remoteAddress?: string } }) {
  const forwarded = req.headers?.["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : typeof forwarded === "string" ? forwarded.split(",")[0] : "";
  return first.trim() || req.ip || req.socket?.remoteAddress || "anonymous";
}

function enforceSubmissionLimit(key: string) {
  const now = Date.now();
  if (submissions.size > 2_000) {
    submissions.forEach((timestamps, storedKey) => {
      if (!timestamps.some(item => now - item < 60 * 60 * 1000)) submissions.delete(storedKey);
    });
  }
  const recent = (submissions.get(key) || []).filter(item => now - item < 60 * 60 * 1000);
  if (recent.length >= 12) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "一小時內回報次數已達上限，請稍後再試。" });
  recent.push(now);
  submissions.set(key, recent);
}

const reportInput = z.object({
  volume: z.number().int().min(1).max(130),
  layer: z.enum(["original", "translation"]),
  sectionIndex: z.number().int().min(0).max(500).nullable().optional(),
  blockIndex: z.number().int().min(0).max(500).nullable().optional(),
  selectedText: z.string().trim().max(1200).optional(),
  suggestion: z.string().trim().min(5, "建議內容至少需要五個字").max(4000),
  reason: z.enum(["typo", "translation", "omission", "punctuation", "other"]),
  evidence: z.string().trim().max(4000).optional(),
  reporterName: z.string().trim().max(120).optional(),
  reporterEmail: z.string().trim().email().max(320).optional().or(z.literal("")),
  website: z.string().max(0).optional(),
});

export const editorialRouter = router({
  submitReport: publicProcedure.input(reportInput).mutation(async ({ input, ctx }) => {
    if (input.website) throw new TRPCError({ code: "BAD_REQUEST", message: "無法提交此回報。" });
    enforceSubmissionLimit(address(ctx.req));
    const { chapter } = await loadShijiLayers(input.volume);
    const now = Date.now();
    const reportCode = `SJ-${randomBytes(6).toString("hex").toUpperCase()}`;
    await createCorrectionReport({
      reportCode,
      volume: input.volume,
      chapterTitle: chapter.title,
      layer: input.layer,
      sectionIndex: input.sectionIndex ?? null,
      blockIndex: input.blockIndex ?? null,
      selectedText: input.selectedText || null,
      suggestion: input.suggestion,
      reason: input.reason,
      evidence: input.evidence || null,
      reporterName: input.reporterName || null,
      reporterEmail: input.reporterEmail || null,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return { reportCode, status: "pending" as const };
  }),

  reportStatus: publicProcedure
    .input(z.object({ reportCode: z.string().trim().regex(/^SJ-[A-F0-9]{12}$/) }))
    .query(async ({ input }) => {
      const report = await getCorrectionReportByCode(input.reportCode);
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "找不到此回報編號。" });
      return report;
    }),

  publishedRevisions: publicProcedure
    .input(z.object({ volume: z.number().int().min(1).max(130) }))
    .query(({ input }) => listPublishedTranslationRevisions(input.volume)),

  chapterReviewStatus: publicProcedure
    .input(z.object({ volume: z.number().int().min(1).max(130) }))
    .query(async ({ input }) => (await getChapterReview(input.volume)) ?? null),

  adminOverview: adminProcedure.query(async () => {
    const [reports, reviews] = await Promise.all([listCorrectionReports(), listChapterReviews()]);
    return { reports, reviews };
  }),

  adminChapter: adminProcedure
    .input(z.object({ volume: z.number().int().min(1).max(130) }))
    .query(async ({ input }) => {
      const [{ chapter, editorial }, revisions] = await Promise.all([
        loadShijiLayers(input.volume),
        listTranslationRevisions(input.volume),
      ]);
      return { chapter, editorial, revisions };
    }),

  saveTranslationRevision: adminProcedure.input(z.object({
    volume: z.number().int().min(1).max(130),
    sectionIndex: z.number().int().min(0),
    blockIndex: z.number().int().min(0),
    originalTranslation: z.string().trim().min(1).max(20_000),
    revisedTranslation: z.string().trim().min(1).max(20_000),
    rationale: z.string().trim().max(4000).optional(),
    published: z.boolean().default(true),
  })).mutation(async ({ input, ctx }) => {
    const now = Date.now();
    await upsertTranslationRevision({
      ...input,
      rationale: input.rationale || null,
      reviewerId: ctx.user.id,
      reviewerName: ctx.user.name || ctx.user.email || "管理員",
      published: input.published ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    });
    return { success: true } as const;
  }),

  updateChapterReview: adminProcedure.input(z.object({
    volume: z.number().int().min(1).max(130),
    status: z.enum(["pending", "in_review", "reviewed"]),
    notes: z.string().trim().max(10_000).optional(),
  })).mutation(async ({ input, ctx }) => {
    const now = Date.now();
    await upsertChapterReview({
      volume: input.volume,
      status: input.status,
      reviewerId: ctx.user.id,
      reviewerName: ctx.user.name || ctx.user.email || "管理員",
      notes: input.notes || null,
      reviewedAt: input.status === "reviewed" ? now : null,
      createdAt: now,
      updatedAt: now,
    });
    return { success: true } as const;
  }),

  updateReport: adminProcedure.input(z.object({
    id: z.number().int().positive(),
    status: z.enum(["pending", "reviewing", "accepted", "rejected"]),
    reviewNote: z.string().trim().max(4000).optional(),
  })).mutation(async ({ input, ctx }) => {
    const now = Date.now();
    await updateCorrectionReport(input.id, {
      status: input.status,
      reviewNote: input.reviewNote || null,
      reviewedBy: ctx.user.id,
      resolvedAt: ["accepted", "rejected"].includes(input.status) ? now : null,
      updatedAt: now,
    });
    return { success: true } as const;
  }),
});
