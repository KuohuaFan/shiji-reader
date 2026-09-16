import { eq } from "drizzle-orm";
import { eventLedgerAnalyses, eventLedgerOutcomes, eventLedgerRevisions } from "../drizzle/schema";
import { createEventLedgerAnalysis, getDb } from "../server/db";
import { appRouter } from "../server/routers";

const now = Date.now();
const code = `EVT-TEST-${String(now).slice(-8)}`;
const original = {
  lesson: "原始AI初稿",
  forecasts: [30, 90, 365].map(horizonDays => ({ horizonDays, proposition: `${horizonDays}日測試命題`, probability: 60, resolutionCriteria: "官方是否公告" })),
  audit: { status: "AI初稿", sourceCount: 2, primarySourceCount: 1 },
};
const created = await createEventLedgerAnalysis({
  artifactCode: code,
  title: "事件簿稽核流程測試",
  category: "法制",
  jurisdiction: "臺灣",
  eventDate: "2026-09-12",
  status: "ai_draft",
  inputSnapshot: JSON.stringify({ sources: ["official", "independent"] }),
  outputSnapshot: JSON.stringify(original),
  promptSummary: "測試提示摘要",
  promptHash: "a".repeat(64),
  sourceSnapshotHash: "b".repeat(64),
  model: "gpt-5",
  analyzedAt: now,
  createdAt: now,
  updatedAt: now,
});
if (!created) throw new Error("無法建立測試事件簿");

const caller = appRouter.createCaller({
  req: { ip: "127.0.0.41", headers: {}, socket: { remoteAddress: "127.0.0.41" } },
  res: {},
  user: { id: 999999, openId: "event-test-admin", name: "測試管理員", email: null, loginMethod: "test", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
} as never);

try {
  const reviewedSnapshot = JSON.stringify({ ...original, lesson: "人工覆核後的歷史教訓" });
  await caller.eventLedger.adminReview({ id: created.id, status: "reviewed", reviewNote: "已核對兩個來源、史記引文與類比邊界。", contentSnapshot: reviewedSnapshot });
  await caller.eventLedger.adminReview({ id: created.id, status: "published", reviewNote: "確認發布覆核完成版本，不再改寫原預測。" });
  const published = await caller.eventLedger.published({ artifactCode: code });
  if (published?.status !== "published" || !(published.artifact as typeof original).lesson.includes("人工覆核")) throw new Error("公開端點未回傳已發布覆核版本");
  const outcome = await caller.eventLedger.adminResolveOutcome({ id: created.id, horizonDays: 30, outcome: "occurred", resolutionNote: "到期後依官方公告確認命題已發生。" });
  if (outcome.brierScore !== 0.16) throw new Error(`Brier score錯誤：${outcome.brierScore}`);
  await caller.eventLedger.adminReview({ id: created.id, status: "reviewed", reviewNote: "嘗試違規改寫已發布預測。" })
    .then(() => { throw new Error("已發布預測竟可改寫"); })
    .catch(error => { if (!String(error.message).includes("不可改寫")) throw error; });

  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const analyses = await db.select().from(eventLedgerAnalyses).where(eq(eventLedgerAnalyses.id, created.id));
  const revisions = await db.select().from(eventLedgerRevisions).where(eq(eventLedgerRevisions.analysisId, created.id));
  const outcomes = await db.select().from(eventLedgerOutcomes).where(eq(eventLedgerOutcomes.analysisId, created.id));
  if (analyses[0]?.status !== "published") throw new Error("發布狀態未保存");
  if (revisions.length !== 1 || !revisions[0].contentSnapshot.includes("原始AI初稿")) throw new Error("原始預測版本未保留");
  if (outcomes[0]?.brierScoreMicros !== 160000) throw new Error("Brier微分數未保存");
  console.log(JSON.stringify({ status: "ok", state: analyses[0].status, revisions: revisions.length, outcome: outcomes[0].outcome, brierScore: outcomes[0].brierScoreMicros / 1_000_000 }, null, 2));
} finally {
  const db = await getDb();
  if (db) {
    await db.delete(eventLedgerOutcomes).where(eq(eventLedgerOutcomes.analysisId, created.id));
    await db.delete(eventLedgerRevisions).where(eq(eventLedgerRevisions.analysisId, created.id));
    await db.delete(eventLedgerAnalyses).where(eq(eventLedgerAnalyses.id, created.id));
  }
}
process.exit(0);
