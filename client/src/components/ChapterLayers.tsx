import { BookOpenText, Feather, Languages, Network, ScrollText, UsersRound } from "lucide-react";
import type { Chapter, ChapterContext, EditorialLayer, ScholarlyLayer, ScholiumSource } from "@/types/content";
import { Fragment, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { isStaticPagesBuild } from "@/lib/site";

export type ReadingLayer = "original" | "translation" | "scholia" | "critical" | "guide" | "context";

const layerOptions: Array<{ id: ReadingLayer; label: string; icon: typeof ScrollText }> = [
  { id: "original", label: "原文", icon: ScrollText },
  { id: "translation", label: "白話", icon: Languages },
  { id: "scholia", label: "三家註", icon: BookOpenText },
  { id: "critical", label: "校勘", icon: Feather },
  { id: "guide", label: "導讀", icon: UsersRound },
  { id: "context", label: "脈絡", icon: Network },
];

function ChapterTable({ rows, caption = "史記年表" }: { rows: string[][]; caption?: string }) {
  if (!rows.length) return <p className="table-translation-note">本表沒有可顯示的列。</p>;
  const maxColumns = Math.max(...rows.map(row => row.length));
  const [header, ...body] = rows;
  return (
    <div className="table-scroll my-8" tabIndex={0} aria-label="年表，可水平捲動">
      <table className="chapter-table"><caption className="sr-only">{caption}</caption><thead><tr>
        {Array.from({ length: maxColumns }, (_, cellIndex) => <th scope="col" key={cellIndex}>{header?.[cellIndex] || "—"}</th>)}
      </tr></thead><tbody>
        {body.map((row, rowIndex) => <tr key={rowIndex}>{Array.from({ length: maxColumns }, (_, cellIndex) => <td key={cellIndex}>{row[cellIndex] || "—"}</td>)}</tr>)}
      </tbody></table>
    </div>
  );
}

export function LayerTabs({ active, onChange, scholia, editorial, context }: {
  active: ReadingLayer;
  onChange: (layer: ReadingLayer) => void;
  scholia: ScholarlyLayer | null;
  editorial: EditorialLayer | null;
  context: ChapterContext | null;
}) {
  return <nav className="layer-tabs" aria-label="內容層次" role="tablist">
    {layerOptions.map(option => {
      const Icon = option.icon;
      const count = option.id === "scholia" ? scholia?.annotations.length : option.id === "critical" ? scholia?.criticalNotes.length : undefined;
      const unavailable = (["translation", "guide"].includes(option.id) && !editorial) || (option.id === "context" && !context);
      return <button key={option.id} role="tab" aria-selected={active === option.id} aria-controls="reading-layer-panel" className={active === option.id ? "active" : ""} disabled={unavailable} onClick={() => onChange(option.id)}>
        <Icon size={15} /><span>{option.label}</span>{count !== undefined && <small>{count}</small>}
      </button>;
    })}
  </nav>;
}

export function OriginalLayer({ chapter, query, markText }: { chapter: Chapter; query: string; markText: (text: string, query: string) => React.ReactNode }) {
  return <div className="chapter-body" id="reading-layer-panel" role="tabpanel">
    {chapter.sections.map((section, sectionIndex) => <section key={`${section.heading}-${sectionIndex}`} id={`section-${sectionIndex}`}>
      {section.heading && <h2>{section.heading}</h2>}
      {section.blocks.map((block, blockIndex) => block.type === "text"
        ? <p key={blockIndex} data-section-index={sectionIndex} data-block-index={blockIndex}>{markText(block.text, query)}</p>
        : <ChapterTable key={blockIndex} rows={block.rows} caption={`${chapter.title}${section.heading ? `：${section.heading}` : ""}`} />)}
    </section>)}
  </div>;
}

export function TranslationLayer({ chapter, editorial }: { chapter: Chapter; editorial: EditorialLayer }) {
  const lookup = useMemo(() => new Map(editorial.translations.map(item => [`${item.sectionIndex}:${item.blockIndex}`, item.text])), [editorial]);
  const { data: revisions = [] } = trpc.editorial.publishedRevisions.useQuery(
    { volume: chapter.volume },
    { enabled: !isStaticPagesBuild },
  );
  const { data: reviewStatus } = trpc.editorial.chapterReviewStatus.useQuery(
    { volume: chapter.volume },
    { enabled: !isStaticPagesBuild },
  );
  const revisionLookup = useMemo(() => new Map(revisions.map(item => [`${item.sectionIndex}:${item.blockIndex}`, item])), [revisions]);
  const tableLookup = useMemo(() => {
    const byBlock = new Map<string, string[][]>();
    for (const item of editorial.tableTranslations || []) {
      const key = `${item.sectionIndex}:${item.blockIndex}`;
      const rows = byBlock.get(key) || [];
      rows[item.rowIndex] = item.cells;
      byBlock.set(key, rows);
    }
    return byBlock;
  }, [editorial]);
  return <div className="chapter-body translation-layer" id="reading-layer-panel" role="tabpanel">
    <div className="editorial-notice translation-status"><span>AI 輔助白話翻譯 · 逐段對應原文 · 重要研究請回查原典</span><b className={reviewStatus?.status || "pending"}>{isStaticPagesBuild ? "校訂狀態見正式站" : reviewStatus?.status === "reviewed" ? `已人工覆核${reviewStatus.reviewerName ? ` · ${reviewStatus.reviewerName}` : ""}` : reviewStatus?.status === "in_review" ? "人工校訂中" : "待人工校訂"}</b></div>
    {editorial.tableTranslationMethod && <div className="table-method-note">{editorial.tableTranslationMethod}</div>}
    {chapter.sections.map((section, sectionIndex) => <section key={`${section.heading}-${sectionIndex}`}>
      {section.heading && <h2>{section.heading}</h2>}
      {section.blocks.map((block, blockIndex) => block.type === "text"
        ? <Fragment key={blockIndex}>
            <details className="parallel-text">
              <summary>對照原文</summary><p>{block.text}</p>
            </details>
            <p data-section-index={sectionIndex} data-block-index={blockIndex}>{revisionLookup.get(`${sectionIndex}:${blockIndex}`)?.revisedTranslation || lookup.get(`${sectionIndex}:${blockIndex}`) || "本段翻譯待校訂。"}</p>
            {revisionLookup.has(`${sectionIndex}:${blockIndex}`) && <small className="human-reviewed">人工校訂 · {revisionLookup.get(`${sectionIndex}:${blockIndex}`)?.reviewerName || "本站編輯"}</small>}
          </Fragment>
        : (() => {
            const translatedRows = tableLookup.get(`${sectionIndex}:${blockIndex}`);
            return <Fragment key={blockIndex}><p className="table-translation-note">{translatedRows ? "年表已逐格轉為白話；人名、國名、年代及爵位依原表保留。" : "本表逐格白話尚未完成；以下暫顯原表。"}</p><ChapterTable rows={translatedRows || block.rows} caption={`${chapter.title}${section.heading ? `：${section.heading}` : ""}白話`} /></Fragment>;
          })())}
    </section>)}
  </div>;
}

export function ScholiaLayer({ scholia }: { scholia: ScholarlyLayer }) {
  const [sources, setSources] = useState<ScholiumSource[]>(["集解", "索隱", "正義"]);
  const toggle = (source: ScholiumSource) => setSources(current => current.includes(source) ? current.filter(item => item !== source) : [...current, source]);
  const visible = scholia.annotations.map(entry => ({ ...entry, notes: entry.notes.filter(note => sources.includes(note.source)) })).filter(entry => entry.notes.length);
  return <div className="scholia-layer" id="reading-layer-panel" role="tabpanel">
    <div className="scholia-filter"><span>顯示注家</span>{(["集解", "索隱", "正義"] as ScholiumSource[]).map(source => <button key={source} aria-pressed={sources.includes(source)} className={`${source} ${sources.includes(source) ? "active" : ""}`} onClick={() => toggle(source)}>{source}</button>)}</div>
    {!visible.length && <div className="layer-empty"><span className="seal-outline">註</span><p>本卷維基文庫三家註來源沒有可顯示的注釋。</p></div>}
    {visible.map((entry, index) => <details className="scholium-card" key={entry.id} open={index < 2}>
      <summary><span>{entry.anchor || entry.section || "篇題注"}</span><em>{entry.notes.map(note => note.source).join(" · ")}</em></summary>
      <div>{entry.notes.map((note, noteIndex) => <article key={`${note.source}-${noteIndex}`} className={`scholium-note ${note.source}`}><b>{note.source}</b><p>{note.text}</p></article>)}</div>
    </details>)}
    <a className="layer-source-link" href={scholia.sanjiazhuSourceUrl} target="_blank" rel="noreferrer">查看維基文庫三家註原頁 ↗</a>
  </div>;
}

export function CriticalLayer({ scholia }: { scholia: ScholarlyLayer }) {
  return <div className="critical-layer" id="reading-layer-panel" role="tabpanel">
    <div className="editorial-notice">校勘記與註腳是維基文庫編者後加成果，不屬《史記》原文。</div>
    {!scholia.criticalNotes.length && <div className="layer-empty"><span className="seal-outline">校</span><p>本卷來源頁沒有校勘註腳。</p></div>}
    {scholia.criticalNotes.map(note => <article className="critical-card" key={note.id}><span>{note.number}</span><div>{note.anchor && <blockquote>{note.anchor}</blockquote>}<p>{note.text}</p></div></article>)}
    <a className="layer-source-link" href={scholia.originalSourceUrl} target="_blank" rel="noreferrer">查看維基文庫原文與校勘頁 ↗</a>
  </div>;
}

export function GuideLayer({ editorial }: { editorial: EditorialLayer }) {
  return <div className="guide-layer" id="reading-layer-panel" role="tabpanel">
    <div className="editorial-notice">本層由 AI 依原文生成，作為閱讀輔助；不屬原典或三家註。</div>
    <section className="guide-lead"><p className="eyebrow">篇旨</p><h2>{editorial.purpose}</h2></section>
    <div className="guide-grid"><section><h3>內容概述</h3><p>{editorial.overview}</p></section><section><h3>歷史脈絡</h3><p>{editorial.historicalContext}</p></section></div>
    <section className="guide-themes"><h3>閱讀主題</h3><div>{editorial.themes.map(theme => <span key={theme}>{theme}</span>)}</div></section>
    <section className="guide-people"><h3>主要人物</h3>{editorial.people.map(person => <article key={`${person.name}-${person.role}`}><b>{person.name}</b><small>{person.role}</small><p>{person.significance}</p></article>)}</section>
  </div>;
}
