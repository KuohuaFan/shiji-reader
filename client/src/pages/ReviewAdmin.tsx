import { ArrowLeft, BookCheck, Check, ClipboardList, Loader2, LogIn, Radar, Save, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import BrandLogo from "@/components/BrandLogo";
import { startLogin } from "@/const";
import { manifest } from "@/lib/content";
import { appHref } from "@/lib/site";
import { trpc } from "@/lib/trpc";

const statusLabels = { pending: "待處理", reviewing: "覆核中", accepted: "已採納", rejected: "不採納" } as const;
const reviewLabels = { pending: "待人工校訂", in_review: "校訂中", reviewed: "已人工覆核" } as const;
type AdminArtifact = { lesson?: string; forecasts?: Array<{ horizonDays: 30 | 90 | 365; proposition: string; probability: number; resolutionCriteria: string }>; audit?: { sourceCount?: number; primarySourceCount?: number } };
type AdminEventItem = {
  id: number; artifactCode: string; title: string; category: string; jurisdiction: string; eventDate: string;
  status: "ai_draft" | "reviewed" | "published"; outputSnapshot: string; reviewNote: string | null;
  analyzedAt: number; updatedAt: number; artifact: AdminArtifact;
  outcomes: Array<{ horizonDays: number; outcome: "occurred" | "not_occurred" | "indeterminate"; resolutionNote: string; brierScoreMicros: number | null }>;
};

export default function ReviewAdmin() {
  const auth = useAuth();
  const [view, setView] = useState<"chapters" | "reports" | "events">("chapters");
  const [volume, setVolume] = useState(1);
  const [query, setQuery] = useState("");
  const utils = trpc.useUtils();
  const overview = trpc.editorial.adminOverview.useQuery(undefined, { enabled: auth.user?.role === "admin" });
  const chapter = trpc.editorial.adminChapter.useQuery({ volume }, { enabled: auth.user?.role === "admin" });
  const eventLedgers = trpc.eventLedger.adminList.useQuery(undefined, { enabled: auth.user?.role === "admin" });
  const saveRevision = trpc.editorial.saveTranslationRevision.useMutation({
    onSuccess: async () => { toast.success("人工修訂已保存"); await chapter.refetch(); },
    onError: error => toast.error(error.message),
  });
  const updateReview = trpc.editorial.updateChapterReview.useMutation({
    onSuccess: async () => { toast.success("篇章校訂狀態已更新"); await overview.refetch(); },
    onError: error => toast.error(error.message),
  });
  const updateReport = trpc.editorial.updateReport.useMutation({
    onSuccess: async () => { toast.success("回報狀態已更新"); await overview.refetch(); },
    onError: error => toast.error(error.message),
  });
  const reviewEvent = trpc.eventLedger.adminReview.useMutation({
    onSuccess: async data => { toast.success(data.status === "published" ? "事件簿已發布" : "事件簿已完成編輯覆核"); await eventLedgers.refetch(); },
    onError: error => toast.error(error.message),
  });
  const resolveEvent = trpc.eventLedger.adminResolveOutcome.useMutation({
    onSuccess: async data => { toast.success(data.brierScore === null ? "結果已標記為無法判定" : `結果已保存；Brier score ${data.brierScore.toFixed(3)}`); await eventLedgers.refetch(); },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "人工學術校訂台｜史記";
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex,nofollow";
    document.head.appendChild(robots);
    return () => {
      document.title = previousTitle;
      robots.remove();
    };
  }, []);

  const reviews = new Map(overview.data?.reviews.map(item => [item.volume, item]) || []);
  const reviewedCount = overview.data?.reviews.filter(item => item.status === "reviewed").length || 0;
  const filteredChapters = manifest.chapters.filter(item => `${item.title}${item.volumeLabel}${item.category}`.includes(query.trim()));
  const revisionMap = useMemo(() => new Map(chapter.data?.revisions.map(item => [`${item.sectionIndex}:${item.blockIndex}`, item]) || []), [chapter.data?.revisions]);

  if (auth.loading) return <div className="admin-gate"><Loader2 className="animate-spin" />載入校訂權限……</div>;
  if (!auth.isAuthenticated) return <div className="admin-gate"><BrandLogo className="brand-logo--admin" /><h1>人工學術校訂台</h1><p>為保護公開文本，只有登入後的管理員可以核准修訂。</p><button onClick={() => startLogin()}><LogIn size={17} />登入校訂</button><a href={appHref()}>返回讀本</a></div>;
  if (auth.user?.role !== "admin") return <div className="admin-gate"><BrandLogo className="brand-logo--admin" /><h1>沒有校訂權限</h1><p>此帳號不是管理員，無法修改公開白話或處理回報。</p><a href={appHref()}>返回讀本</a></div>;

  return <div className="review-admin">
    <header className="review-header"><a href={appHref()}><ArrowLeft size={17} />返回讀本</a><div className="review-brand"><BrandLogo className="brand-logo--compact" /><span><p className="eyebrow">Editorial Review</p><h1>《史記》人工學術校訂台</h1></span></div><span>{auth.user.name || auth.user.email}</span></header>
    <section className="review-summary"><article><b>{reviewedCount}</b><span>已人工覆核篇</span></article><article><b>{130 - reviewedCount}</b><span>待人工覆核篇</span></article><article><b>{overview.data?.reports.filter(item => item.status === "pending").length || 0}</b><span>待處理回報</span></article><article><b>{overview.data?.reports.length || 0}</b><span>全部讀者回報</span></article></section>
    <nav className="review-tabs"><button className={view === "chapters" ? "active" : ""} onClick={() => setView("chapters")}><BookCheck size={17} />逐篇白話校訂</button><button className={view === "reports" ? "active" : ""} onClick={() => setView("reports")}><ClipboardList size={17} />讀者錯誤回報</button><button className={view === "events" ? "active" : ""} onClick={() => setView("events")}><Radar size={17} />事件簿覆核 {eventLedgers.data?.length || 0}</button></nav>

    {view === "chapters" ? <div className="review-workspace">
      <aside className="review-chapters"><label><Search size={14} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="篇名或卷次" /></label>{filteredChapters.map(item => { const review = reviews.get(item.volume); return <button key={item.volume} className={volume === item.volume ? "active" : ""} onClick={() => setVolume(item.volume)}><span>{String(item.volume).padStart(3, "0")}</span><b>{item.title}</b><em className={review?.status || "pending"}>{reviewLabels[review?.status || "pending"]}</em></button>; })}</aside>
      <main className="review-editor">
        {chapter.isLoading || !chapter.data ? <div className="admin-loading"><Loader2 className="animate-spin" />載入篇章……</div> : <>
          <header><div><p className="eyebrow">{chapter.data.chapter.volumeLabel} · {chapter.data.chapter.category}</p><h2>{chapter.data.chapter.title}</h2></div><ChapterReviewControl key={volume} status={reviews.get(volume)?.status || "pending"} notes={reviews.get(volume)?.notes || ""} saving={updateReview.isPending} onSave={(status, notes) => updateReview.mutate({ volume, status, notes: notes || undefined })} /></header>
          <div className="review-guidance">逐段比對原文與 AI 白話。只有按下「保存並公開」的段落會覆寫前台；篇章狀態必須由真人校訂者明確設定，不會自動標記完成。</div>
          {chapter.data.editorial.translations.map(item => {
            const source = chapter.data!.chapter.sections[item.sectionIndex]?.blocks[item.blockIndex];
            if (!source || source.type !== "text") return null;
            const existing = revisionMap.get(`${item.sectionIndex}:${item.blockIndex}`);
            return <TranslationEditor key={`${volume}:${item.sectionIndex}:${item.blockIndex}`} original={source.text} initial={existing?.revisedTranslation || item.text} rationale={existing?.rationale || ""} reviewed={Boolean(existing?.published)} saving={saveRevision.isPending} onSave={(revisedTranslation, reason) => saveRevision.mutate({ volume, sectionIndex: item.sectionIndex, blockIndex: item.blockIndex, originalTranslation: item.text, revisedTranslation, rationale: reason, published: true })} />;
          })}
        </>}
      </main>
    </div> : view === "reports" ? <main className="report-queue">
      {!overview.data?.reports.length && <div className="layer-empty"><span className="seal-outline">報</span><p>目前沒有讀者回報。</p></div>}
      {overview.data?.reports.map(report => <article key={report.id}><header><div><span>{report.reportCode}</span><h3>{report.chapterTitle}</h3><small>{report.layer === "original" ? "原文" : "白話"} · {new Date(report.createdAt).toLocaleString()}</small></div><ReportReviewControl key={`${report.id}-${report.updatedAt}`} status={report.status} note={report.reviewNote || ""} saving={updateReport.isPending} onSave={(status, reviewNote) => updateReport.mutate({ id: report.id, status, reviewNote: reviewNote || undefined })} /></header>{report.selectedText && <blockquote>{report.selectedText}</blockquote>}<p><b>修改建議：</b>{report.suggestion}</p>{report.evidence && <p><b>依據：</b>{report.evidence}</p>}<footer>{report.reporterName || "匿名讀者"}{report.reporterEmail ? ` · ${report.reporterEmail}` : ""}</footer></article>)}
    </main> : <main className="report-queue event-review-queue">
      {!eventLedgers.data?.length && <div className="layer-empty"><span className="seal-outline">事</span><p>目前沒有事件簿 AI 初稿。</p></div>}
      {eventLedgers.data?.map(item => <EventReviewCard
        key={`${item.id}-${item.updatedAt}`}
        item={{ ...item, artifact: item.artifact as AdminArtifact }}
        saving={reviewEvent.isPending || resolveEvent.isPending}
        onReview={(status: "reviewed" | "published", reviewNote: string, contentSnapshot?: string) => reviewEvent.mutate({ id: item.id, status, reviewNote, contentSnapshot })}
        onResolve={(horizonDays: 30 | 90 | 365, outcome: "occurred" | "not_occurred" | "indeterminate", resolutionNote: string) => resolveEvent.mutate({ id: item.id, horizonDays, outcome, resolutionNote })}
      />)}
    </main>}
  </div>;
}

function EventReviewCard({ item, saving, onReview, onResolve }: {
  item: AdminEventItem;
  saving: boolean;
  onReview: (status: "reviewed" | "published", reviewNote: string, contentSnapshot?: string) => void;
  onResolve: (horizonDays: 30 | 90 | 365, outcome: "occurred" | "not_occurred" | "indeterminate", resolutionNote: string) => void;
}) {
  const [snapshot, setSnapshot] = useState(item.outputSnapshot);
  const [note, setNote] = useState(item.reviewNote || "");
  const [outcomeNotes, setOutcomeNotes] = useState<Record<number, string>>({});
  const statusLabel = item.status === "ai_draft" ? "AI 初稿" : item.status === "reviewed" ? "編輯覆核" : "已發布";
  const changed = snapshot.trim() !== item.outputSnapshot.trim();
  const jsonValid = useMemo(() => { try { JSON.parse(snapshot); return true; } catch { return false; } }, [snapshot]);
  return <article className="event-review-card">
    <header><div><span>{item.artifactCode}</span><h3>{item.title}</h3><small>{item.category} · {item.jurisdiction} · 事件日 {item.eventDate} · 分析 {new Date(item.analyzedAt).toLocaleString()}</small></div><b className={`event-review-status ${item.status}`}>{statusLabel}</b></header>
    <p><b>AI 歷史教訓：</b>{item.artifact.lesson || "未提供"}</p>
    <p className="event-review-audit">來源 {item.artifact.audit?.sourceCount || 0} 個 · 一手來源 {item.artifact.audit?.primarySourceCount || 0} 個 · 原始預測於發布後禁止改寫</p>
    {item.status !== "published" && <div className="event-review-editor"><label>事件簿 JSON 快照<textarea aria-label={`${item.artifactCode}覆核內容`} value={snapshot} onChange={event => setSnapshot(event.target.value)} /></label><label>編輯覆核說明<textarea aria-label={`${item.artifactCode}覆核說明`} value={note} onChange={event => setNote(event.target.value)} placeholder="至少10字：來源核對、修改理由、保留爭議與發布判斷" /></label><div>{!jsonValid && <small>JSON 格式不正確，無法保存。</small>}<button disabled={saving || !jsonValid || note.trim().length < 10 || (item.status === "reviewed" && !changed)} onClick={() => onReview("reviewed", note.trim(), snapshot.trim())}><Save size={13} />{item.status === "ai_draft" ? "完成編輯覆核" : "保存新覆核版本"}</button>{item.status === "reviewed" && <button disabled={saving || changed || note.trim().length < 10} onClick={() => onReview("published", note.trim())}><Check size={13} />發布已覆核版本</button>}</div></div>}
    {item.status === "published" && <div className="event-outcome-review"><p>事後驗證只新增結果，不會修改原機率、結果判準或時間戳。</p>{item.artifact.forecasts?.map(forecast => { const existing = item.outcomes.find(outcome => outcome.horizonDays === forecast.horizonDays); const resolutionNote = outcomeNotes[forecast.horizonDays] ?? existing?.resolutionNote ?? ""; return <section key={forecast.horizonDays}><header><b>{forecast.horizonDays} 日 · {forecast.probability}%</b><span>{existing ? `已登錄：${existing.outcome}` : "待到期核對"}</span></header><p>{forecast.proposition}</p><small>判準：{forecast.resolutionCriteria}</small><textarea value={resolutionNote} onChange={event => setOutcomeNotes(values => ({ ...values, [forecast.horizonDays]: event.target.value }))} placeholder="至少10字：實際結果、資料日期與核查來源" /><div>{(["occurred", "not_occurred", "indeterminate"] as const).map(value => <button key={value} disabled={saving || resolutionNote.trim().length < 10} onClick={() => onResolve(forecast.horizonDays, value, resolutionNote.trim())}>{value === "occurred" ? "已發生" : value === "not_occurred" ? "未發生" : "無法判定"}</button>)}</div>{existing?.brierScoreMicros !== null && existing?.brierScoreMicros !== undefined && <em>Brier score {(existing.brierScoreMicros / 1_000_000).toFixed(3)}</em>}</section>; })}</div>}
  </article>;
}

function ChapterReviewControl({ status: initialStatus, notes: initialNotes, saving, onSave }: { status: "pending" | "in_review" | "reviewed"; notes: string; saving: boolean; onSave: (status: "pending" | "in_review" | "reviewed", notes: string) => void }) {
  const [status, setStatus] = useState(initialStatus);
  const [notes, setNotes] = useState(initialNotes);
  return <div className="chapter-review-control"><select aria-label="篇章校訂狀態" value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="pending">待人工校訂</option><option value="in_review">校訂中</option><option value="reviewed">已人工覆核</option></select><textarea aria-label="篇章校訂總評" value={notes} onChange={event => setNotes(event.target.value)} placeholder="校訂總評、採用版本與待查問題" /><button disabled={saving} onClick={() => onSave(status, notes.trim())}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}儲存篇章紀錄</button></div>;
}

function ReportReviewControl({ status: initialStatus, note: initialNote, saving, onSave }: { status: keyof typeof statusLabels; note: string; saving: boolean; onSave: (status: keyof typeof statusLabels, note: string) => void }) {
  const [status, setStatus] = useState(initialStatus);
  const [note, setNote] = useState(initialNote);
  return <div className="report-review-control"><select aria-label="回報處理狀態" value={status} onChange={event => setStatus(event.target.value as typeof status)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input aria-label="覆核說明" value={note} onChange={event => setNote(event.target.value)} placeholder="給回報者的覆核說明" /><button disabled={saving} onClick={() => onSave(status, note.trim())}>{saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}儲存處理結果</button></div>;
}

function TranslationEditor({ original, initial, rationale, reviewed, saving, onSave }: { original: string; initial: string; rationale: string; reviewed: boolean; saving: boolean; onSave: (value: string, rationale: string) => void }) {
  const [value, setValue] = useState(initial);
  const [note, setNote] = useState(rationale);
  const changed = value.trim() !== initial.trim() || note.trim() !== rationale.trim();
  return <article className={`translation-review-card ${reviewed ? "reviewed" : ""}`}><div><span>原文</span><p>{original}</p></div><div><span>白話校訂</span><textarea value={value} onChange={event => setValue(event.target.value)} /><input value={note} onChange={event => setNote(event.target.value)} placeholder="校訂理由或版本依據（建議填寫）" /><button disabled={saving || !value.trim() || (!changed && reviewed)} onClick={() => onSave(value.trim(), note.trim())}>{reviewed && !changed ? <><Check size={15} />已公開</> : <><Save size={15} />保存並公開</>}</button></div></article>;
}
