import { and, eq } from "drizzle-orm";
import { appRouter } from "../server/routers";
import { getDb } from "../server/db";
import { chapterReviews, correctionReports, translationRevisions } from "../drizzle/schema";
import type { TrpcContext } from "../server/_core/context";

const makeContext = (admin = false): TrpcContext => ({
  user: admin ? {
    id: 999999,
    openId: "editorial-test-admin",
    email: "test@example.invalid",
    name: "校訂測試",
    loginMethod: "test",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } : null,
  req: { headers: { "x-forwarded-for": "127.0.0.77" }, ip: "127.0.0.77", socket: { remoteAddress: "127.0.0.77" } } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

const publicCaller = appRouter.createCaller(makeContext(false));
const adminCaller = appRouter.createCaller(makeContext(true));
const submitted = await publicCaller.editorial.submitReport({
  volume: 1,
  layer: "translation",
  sectionIndex: 0,
  blockIndex: 0,
  selectedText: "黃帝者，少典之子",
  suggestion: "端到端測試用建議，完成後刪除。",
  reason: "translation",
  evidence: "自動化測試",
  reporterName: "測試者",
  reporterEmail: "test@example.invalid",
  website: "",
});
const firstStatus = await publicCaller.editorial.reportStatus({ reportCode: submitted.reportCode });
if (firstStatus.status !== "pending") throw new Error("New report was not pending");
const overview = await adminCaller.editorial.adminOverview();
const report = overview.reports.find(item => item.reportCode === submitted.reportCode);
if (!report) throw new Error("Admin could not see submitted report");
await adminCaller.editorial.updateReport({ id: report.id, status: "accepted", reviewNote: "測試通過" });
const finalStatus = await publicCaller.editorial.reportStatus({ reportCode: submitted.reportCode });
if (finalStatus.status !== "accepted") throw new Error("Report status update failed");
await adminCaller.editorial.saveTranslationRevision({
  volume: 1,
  sectionIndex: 0,
  blockIndex: 0,
  originalTranslation: "測試原譯",
  revisedTranslation: "測試人工修訂",
  rationale: "端到端測試",
  published: true,
});
const revisions = await publicCaller.editorial.publishedRevisions({ volume: 1 });
if (!revisions.some(item => item.revisedTranslation === "測試人工修訂")) throw new Error("Published revision was not visible");
await adminCaller.editorial.updateChapterReview({ volume: 1, status: "reviewed", notes: "端到端測試" });
const reviewed = await adminCaller.editorial.adminOverview();
if (!reviewed.reviews.some(item => item.volume === 1 && item.status === "reviewed")) throw new Error("Chapter review status failed");
const publicReviewStatus = await publicCaller.editorial.chapterReviewStatus({ volume: 1 });
if (publicReviewStatus?.status !== "reviewed") throw new Error("Public review status was not visible");

const db = await getDb();
if (!db) throw new Error("Database unavailable for cleanup");
await db.delete(correctionReports).where(eq(correctionReports.reportCode, submitted.reportCode));
await db.delete(translationRevisions).where(and(eq(translationRevisions.volume, 1), eq(translationRevisions.sectionIndex, 0), eq(translationRevisions.blockIndex, 0)));
await db.delete(chapterReviews).where(eq(chapterReviews.volume, 1));

console.log(JSON.stringify({ reportCode: submitted.reportCode, pending: firstStatus.status, final: finalStatus.status, revisionVisible: true, reviewWorkflow: true, publicReviewStatus: true, cleanup: true }, null, 2));
process.exit(0);
