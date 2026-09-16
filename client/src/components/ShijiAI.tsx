import { Bot, Loader2, Send, ShieldCheck, SlidersHorizontal, UserRound, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { isStaticPagesBuild, officialSiteUrl } from "@/lib/site";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  confidence?: "高" | "中" | "低";
  citations?: Array<{ id: string; layer: string; section: string; quote: string }>;
}

const sourceOptions = ["原文", "集解", "索隱", "正義"] as const;
const periodOptions = ["不限", "上古與五帝", "夏商周", "春秋", "戰國", "秦", "楚漢", "西漢前期", "漢武帝時期"] as const;

export default function ShijiAI({ volume, title, onClose }: { volume: number; title: string; onClose: () => void }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sources, setSources] = useState<Array<(typeof sourceOptions)[number]>>([...sourceOptions]);
  const [period, setPeriod] = useState<(typeof periodOptions)[number]>("不限");
  const ask = trpc.shiji.ask.useMutation({
    onSuccess: data => {
      setMessages(current => [
        ...current,
        { role: "assistant", content: data.answer, confidence: data.confidence, citations: data.citations },
      ]);
    },
    onError: error => toast.error(error.message || "問答服務暫時無法使用"),
  });

  const submit = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || ask.isPending) return;
    if (isStaticPagesBuild) {
      const url = new URL(officialSiteUrl);
      url.searchParams.set("prompt", trimmed);
      url.searchParams.set("volume", String(volume));
      if (period !== "不限") url.searchParams.set("period", period);
      window.location.assign(url.toString());
      return;
    }
    const history = messages
      .filter(message => message.role === "user")
      .slice(-6)
      .map(message => ({ role: "user" as const, content: message.content }));
    setMessages(current => [...current, { role: "user", content: trimmed }]);
    setInput("");
    ask.mutate({ volume, question: trimmed, history, sources, period });
  };

  const toggleSource = (source: (typeof sourceOptions)[number]) => {
    setSources(current => current.includes(source)
      ? current.length === 1 ? current : current.filter(item => item !== source)
      : [...current, source]);
  };

  const prompts = ["本篇的核心主旨是什麼？", "三家註有哪些重要歧見？", "列出本篇主要人物及關係。"];

  return (
    <section className="ai-dialog" role="dialog" aria-modal="true" aria-label="史記 AI 問答">
      <header>
        <div><p className="eyebrow">史記問答</p><h2>{title}</h2></div>
        <button className="icon-button" onClick={onClose} aria-label="關閉 AI 問答"><X size={19} /></button>
      </header>
      <div className="ai-notice"><ShieldCheck size={16} /><span>{isStaticPagesBuild ? "GitHub Pages 提供靜態讀本；送出問題後會前往正式全端網站。" : "回答限於本篇原文、三家註、校勘與導讀；每次回答列出實際引用。"}</span></div>
      <details className="ai-filters" open>
        <summary><SlidersHorizontal size={15} />進階篩選</summary>
        <div><span>指定古籍來源</span><div className="ai-source-options">{sourceOptions.map(source => <button type="button" key={source} aria-pressed={sources.includes(source)} className={sources.includes(source) ? "active" : ""} onClick={() => toggleSource(source)}>{source}</button>)}</div></div>
        <label>特定歷史時期<select value={period} onChange={event => setPeriod(event.target.value as typeof period)}>{periodOptions.map(option => <option key={option}>{option}</option>)}</select></label>
      </details>
      <div className="ai-messages" aria-live="polite" aria-busy={ask.isPending}>
        {!messages.length && (
          <div className="ai-empty">
            <span className="seal-outline">問</span>
            <p>可詢問人物、語句、史事脈絡，或比較集解、索隱與正義。</p>
            <div>{prompts.map(prompt => <button key={prompt} onClick={() => submit(prompt)}>{prompt}</button>)}</div>
          </div>
        )}
        {messages.map((message, index) => (
          <article key={index} className={`ai-message ${message.role}`}>
            <span className="ai-avatar">{message.role === "user" ? <UserRound size={15} /> : <Bot size={15} />}</span>
            <div>
              <p>{message.content}</p>
              {message.confidence && <small className={`confidence confidence-${message.confidence}`}>資料支持度：{message.confidence}</small>}
              {message.citations && message.citations.length > 0 && (
                <details className="ai-citations">
                  <summary>查看 {message.citations.length} 則引用</summary>
                  {message.citations.map(citation => (
                    <blockquote key={citation.id}>
                      <b>〔{citation.layer}〕{citation.section}</b>
                      <p>{citation.quote}{citation.quote.length >= 360 ? "……" : ""}</p>
                    </blockquote>
                  ))}
                </details>
              )}
            </div>
          </article>
        ))}
        {ask.isPending && <div className="ai-thinking"><Loader2 size={17} className="animate-spin" /> 正在核對本篇資料……</div>}
      </div>
      <form className="ai-input" onSubmit={event => { event.preventDefault(); submit(input); }}>
        <textarea autoFocus aria-label="向史記助讀提問" value={input} onChange={event => setInput(event.target.value)} placeholder="例如：司馬遷如何評價項羽？" maxLength={500} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(input); } }} />
        <button type="submit" disabled={!input.trim() || ask.isPending} aria-label="送出問題"><Send size={17} /></button>
      </form>
      <footer>AI 可能出錯；重要研究請回查原文與三家註。模型：gpt-5-mini</footer>
    </section>
  );
}
