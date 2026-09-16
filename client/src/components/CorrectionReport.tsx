import { CheckCircle2, Loader2, Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { isStaticPagesBuild, officialSiteUrl } from "@/lib/site";

const reasons = [
  ["typo", "原文錯字"],
  ["translation", "白話翻譯"],
  ["omission", "內容遺漏"],
  ["punctuation", "標點斷句"],
  ["other", "其他建議"],
] as const;

interface Props {
  volume: number;
  title: string;
  defaultLayer: "original" | "translation";
  selectedText?: string;
  sectionIndex?: number;
  blockIndex?: number;
  onClose: () => void;
}

export default function CorrectionReport({ volume, title, defaultLayer, selectedText = "", sectionIndex, blockIndex, onClose }: Props) {
  const [layer, setLayer] = useState<"original" | "translation">(defaultLayer);
  const [reason, setReason] = useState<(typeof reasons)[number][0]>(defaultLayer === "translation" ? "translation" : "typo");
  const [quoted, setQuoted] = useState(selectedText);
  const [suggestion, setSuggestion] = useState("");
  const [evidence, setEvidence] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [reportCode, setReportCode] = useState("");
  const [lookupCode, setLookupCode] = useState("");
  const normalizedCode = lookupCode.trim().toUpperCase();
  const status = trpc.editorial.reportStatus.useQuery(
    { reportCode: normalizedCode },
    { enabled: !isStaticPagesBuild && /^SJ-[A-F0-9]{12}$/.test(normalizedCode), retry: false },
  );
  const submit = trpc.editorial.submitReport.useMutation({
    onSuccess: data => setReportCode(data.reportCode),
    onError: error => toast.error(error.message || "回報送出失敗"),
  });

  if (reportCode) {
    return <section className="report-dialog" role="dialog" aria-modal="true" aria-label="錯誤回報完成">
      <header><div><p className="eyebrow">錯誤回報</p><h2>已收到您的建議</h2></div><button className="icon-button" onClick={onClose} aria-label="關閉錯誤回報"><X size={19} /></button></header>
      <div className="report-success"><CheckCircle2 size={30} /><p>編輯者將依原文、版本和三家註覆核，不會自動改動網站內容。</p><label>回報編號</label><strong>{reportCode}</strong><small>請保存此編號，以便日後查詢處理狀態。</small><button onClick={() => navigator.clipboard?.writeText(reportCode)}>複製編號</button></div>
    </section>;
  }

  return <section className="report-dialog" role="dialog" aria-modal="true" aria-label="錯誤回報">
    <header><div><p className="eyebrow">協作校勘</p><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="關閉錯誤回報"><X size={19} /></button></header>
    <p className="report-help">{isStaticPagesBuild ? "GitHub Pages 不保存提交資料；送出時會前往正式全端網站的同篇讀本。" : "提交後先進入待審佇列；只有具管理權限的校訂者核准後，才會成為公開白話修訂。"}</p>
    <details className="report-lookup"><summary>查詢既有回報</summary><label>輸入回報編號<input value={lookupCode} onChange={event => setLookupCode(event.target.value.toUpperCase())} placeholder="SJ-XXXXXXXXXXXX" /></label>{status.isFetching && <small>查詢中……</small>}{status.data && <p><b>{status.data.reportCode}</b><span>{status.data.chapterTitle} · {status.data.status === "pending" ? "待處理" : status.data.status === "reviewing" ? "覆核中" : status.data.status === "accepted" ? "已採納" : "不採納"}</span>{status.data.reviewNote && <em>{status.data.reviewNote}</em>}</p>}{status.error && <small>{status.error.message}</small>}</details>
    <form onSubmit={event => {
      event.preventDefault();
      if (isStaticPagesBuild) {
        window.location.assign(`${officialSiteUrl}/?chapter=${volume}`);
        return;
      }
      submit.mutate({ volume, layer, sectionIndex, blockIndex, selectedText: quoted || undefined, suggestion, reason, evidence: evidence || undefined, reporterName: name || undefined, reporterEmail: email || undefined, website });
    }}>
      <fieldset><legend>建議對象</legend><label><input type="radio" checked={layer === "original"} onChange={() => setLayer("original")} />原文</label><label><input type="radio" checked={layer === "translation"} onChange={() => setLayer("translation")} />白話翻譯</label></fieldset>
      <label>問題類型<select value={reason} onChange={event => setReason(event.target.value as typeof reason)}>{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>原句或選取文字<textarea value={quoted} onChange={event => setQuoted(event.target.value)} maxLength={1200} placeholder="可先在閱讀頁選取文字，再按錯誤回報" /></label>
      <label>修改建議<span>*</span><textarea autoFocus value={suggestion} onChange={event => setSuggestion(event.target.value)} minLength={5} maxLength={4000} required placeholder="請寫出建議改法與理由" /></label>
      <label>版本或文獻依據<textarea value={evidence} onChange={event => setEvidence(event.target.value)} maxLength={4000} placeholder="例如：中華書局點校本、三家註某條；如無可留白" /></label>
      <div className="report-contact"><label>署名（選填）<input value={name} onChange={event => setName(event.target.value)} maxLength={120} /></label><label>電郵（選填）<input type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={320} /></label></div>
      <p className="report-privacy">選填電郵只供編輯者就此回報聯絡，不在公開狀態頁顯示。</p>
      <input className="report-honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={event => setWebsite(event.target.value)} />
      <button className="report-submit" type="submit" disabled={!isStaticPagesBuild && (submit.isPending || suggestion.trim().length < 5)}>{submit.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}{isStaticPagesBuild ? "前往正式站回報" : submit.isPending ? "送出中" : "送出回報"}</button>
    </form>
  </section>;
}
