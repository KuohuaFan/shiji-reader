import {
  ArrowLeft,
  Bot,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  FilePenLine,
  Flag,
  Home,
  Menu,
  Moon,
  Search,
  Settings2,
  Sun,
  Volume2,
  X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import BrandLogo from "@/components/BrandLogo";
import {
  CriticalLayer,
  GuideLayer,
  LayerTabs,
  OriginalLayer,
  ScholiaLayer,
  TranslationLayer,
  type ReadingLayer,
} from "@/components/ChapterLayers";
import ContextLayer from "@/components/ContextLayer";
import CorrectionReport from "@/components/CorrectionReport";
import ShijiAI from "@/components/ShijiAI";
import {
  chapterPlainText,
  formatNumber,
  loadAllChapters,
  loadChapter,
  manifest,
} from "@/lib/content";
import { loadContext, loadEditorial, loadScholia } from "@/lib/layers";
import type { Chapter, ChapterContext, ChapterMeta, EditorialLayer, ScholarlyLayer } from "@/types/content";

interface ReaderProps {
  initialVolume: number;
  onHome: () => void;
}

interface SearchResult {
  volume: number;
  title: string;
  category: string;
  snippet: string;
  count: number;
  query: string;
}

const fontSizes = [18, 21, 24, 27];

function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function markText(text: string, query: string) {
  if (!query.trim()) return text;
  const needle = query.trim();
  const parts = text.split(needle);
  if (parts.length === 1) return text;
  return parts.map((part, index) => (
    <Fragment key={`${part.slice(0, 8)}-${index}`}>
      {part}
      {index < parts.length - 1 && <mark>{needle}</mark>}
    </Fragment>
  ));
}

export default function Reader({ initialVolume, onHome }: ReaderProps) {
  const [volume, setVolume] = useState(initialVolume);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSelection, setReportSelection] = useState<{ selectedText?: string; sectionIndex?: number; blockIndex?: number }>({});
  const [readingLayer, setReadingLayer] = useState<ReadingLayer>("original");
  const [scholia, setScholia] = useState<ScholarlyLayer | null>(null);
  const [editorial, setEditorial] = useState<EditorialLayer | null>(null);
  const [context, setContext] = useState<ChapterContext | null>(null);
  const [tocQuery, setTocQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [fontSize, setFontSize] = useState(() =>
    Number(localStorage.getItem("shiji:font-size")) || 21,
  );
  const [night, setNight] = useState(() => localStorage.getItem("shiji:night") === "1");
  const [wide, setWide] = useState(() => localStorage.getItem("shiji:wide") === "1");
  const [bookmarks, setBookmarks] = useState<number[]>(() =>
    readStoredJson("shiji:bookmarks", []),
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    readStoredJson("shiji:notes", {}),
  );
  const [speaking, setSpeaking] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const searchRequestRef = useRef(0);

  const meta = manifest.chapters[volume - 1];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setChapter(null);
    setScholia(null);
    setEditorial(null);
    setContext(null);
    setReadingLayer("original");
    Promise.allSettled([loadChapter(volume), loadScholia(volume), loadEditorial(volume), loadContext(volume)])
      .then((results) => {
        if (cancelled) return;
        const chapterResult = results[0];
        if (chapterResult.status !== "fulfilled") throw chapterResult.reason;
        const data = chapterResult.value;
        setChapter(data);
        if (results[1].status === "fulfilled") setScholia(results[1].value);
        if (results[2].status === "fulfilled") setEditorial(results[2].value);
        if (results[3].status === "fulfilled") setContext(results[3].value);
        setLoading(false);
        const url = new URL(window.location.href);
        url.searchParams.set("chapter", String(volume));
        window.history.replaceState({}, "", url);
        document.title = `${data.title}｜史記 · 太史公書`;
        localStorage.setItem("shiji:last-volume", String(volume));
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
      })
      .catch((error) => {
        if (cancelled) return;
        setLoading(false);
        toast.error(error instanceof Error ? error.message : "載入失敗");
      });
    return () => {
      cancelled = true;
      window.speechSynthesis?.cancel();
    };
  }, [volume]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, button, [contenteditable='true']")) return;
      if (event.key === "ArrowLeft" && volume > 1) setVolume((v) => v - 1);
      if (event.key === "ArrowRight" && volume < 130) setVolume((v) => v + 1);
      if (event.key === "/") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setSidebarOpen(false);
        setSettingsOpen(false);
        setNotesOpen(false);
        setAiOpen(false);
        setReportOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [volume]);

  const visibleChapters = useMemo(() => {
    const query = tocQuery.trim();
    if (!query) return manifest.chapters;
    return manifest.chapters.filter(
      (item) =>
        item.title.includes(query) ||
        item.category.includes(query) ||
        item.volumeLabel.includes(query),
    );
  }, [tocQuery]);

  const chooseVolume = useCallback((nextVolume: number) => {
    setVolume(nextVolume);
    setSidebarOpen(false);
    setSearchOpen(false);
    setAiOpen(false);
  }, []);

  const toggleBookmark = () => {
    const next = bookmarks.includes(volume)
      ? bookmarks.filter((item) => item !== volume)
      : [...bookmarks, volume].sort((a, b) => a - b);
    setBookmarks(next);
    localStorage.setItem("shiji:bookmarks", JSON.stringify(next));
    toast.success(next.includes(volume) ? "已加入書籤" : "已移除書籤");
  };

  const saveNote = (value: string) => {
    const next = { ...notes, [String(volume)]: value };
    setNotes(next);
    localStorage.setItem("shiji:notes", JSON.stringify(next));
  };

  const updateFontSize = (size: number) => {
    setFontSize(size);
    localStorage.setItem("shiji:font-size", String(size));
  };

  const toggleNight = () => {
    const next = !night;
    setNight(next);
    localStorage.setItem("shiji:night", next ? "1" : "0");
  };

  const toggleWide = () => {
    const next = !wide;
    setWide(next);
    localStorage.setItem("shiji:wide", next ? "1" : "0");
  };

  const searchCorpus = async () => {
    const query = searchQuery.trim();
    if (!query) return;
    const requestId = ++searchRequestRef.current;
    setSearching(true);
    try {
      const all = await loadAllChapters();
      const results: SearchResult[] = [];
      for (const item of all) {
        const text = chapterPlainText(item);
        const count = text.split(query).length - 1;
        const titleHit = item.title.includes(query);
        if (count || titleHit) {
          const index = Math.max(0, text.indexOf(query));
          const start = Math.max(0, index - 34);
          const end = Math.min(text.length, index + query.length + 54);
          results.push({
            volume: item.volume,
            title: item.title,
            category: item.category,
            snippet: `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`,
            count: Math.max(count, titleHit ? 1 : 0),
            query,
          });
        }
      }
      if (requestId !== searchRequestRef.current) return;
      setSearchResults(results.sort((a, b) => b.count - a.count).slice(0, 80));
      setActiveQuery(query);
    } catch (error) {
      if (requestId === searchRequestRef.current) {
        toast.error(error instanceof Error ? error.message : "全文檢索失敗，請重試");
      }
    } finally {
      if (requestId === searchRequestRef.current) setSearching(false);
    }
  };

  const toggleSpeech = () => {
    if (!chapter || !("speechSynthesis" in window)) {
      toast.error("此瀏覽器不支援語音朗讀");
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(chapterPlainText(chapter));
    utterance.lang = "zh-TW";
    utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      toast.error("朗讀已中止，請檢查系統中文語音設定");
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  const goHome = () => {
    window.speechSynthesis?.cancel();
    const url = new URL(window.location.href);
    url.searchParams.delete("chapter");
    window.history.replaceState({}, "", url);
    document.title = "史記 · 太史公書";
    onHome();
  };

  const openReport = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim().slice(0, 1200) || "";
    const node = selection?.anchorNode;
    const element = (node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>("[data-section-index][data-block-index]");
    setReportSelection({
      selectedText,
      sectionIndex: element ? Number(element.dataset.sectionIndex) : undefined,
      blockIndex: element ? Number(element.dataset.blockIndex) : undefined,
    });
    setReportOpen(true);
  };

  return (
    <div className={`reader-shell min-h-screen ${night ? "night" : ""}`}>
      <header className="reader-header">
        <div className="flex min-w-0 items-center gap-3">
          <button className="icon-button mobile-only" onClick={() => setSidebarOpen(true)} aria-label="開啟目錄">
            <Menu size={19} />
          </button>
          <button className="brand-button" onClick={goHome} aria-label="回首頁">
            <BrandLogo className="brand-logo--compact" />
            <span className="hidden sm:inline">史記</span>
          </button>
          <span className="header-divider" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{meta?.title}</div>
            <div className="text-[10px] tracking-[0.15em] text-ink-muted">{meta?.category} · {meta?.volumeLabel}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="header-action" onClick={() => setSearchOpen(true)}>
            <Search size={17} /><span className="hidden sm:inline">檢索</span>
          </button>
          <button className="header-action" onClick={toggleBookmark}>
            {bookmarks.includes(volume) ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
            <span className="hidden sm:inline">書籤</span>
          </button>
          <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="閱讀設定">
            <Settings2 size={18} />
          </button>
        </div>
      </header>

      <div className={`reader-grid ${wide ? "reader-grid-wide" : ""}`}>
        <aside className={`toc-panel ${sidebarOpen ? "mobile-open" : ""}`}>
          <div className="toc-heading">
            <div>
              <p className="eyebrow">目錄</p>
              <h2>一百三十篇</h2>
            </div>
            <button className="icon-button mobile-only" onClick={() => setSidebarOpen(false)} aria-label="關閉目錄"><X size={18} /></button>
          </div>
          <label className="toc-search">
            <Search size={15} />
            <input value={tocQuery} onChange={(event) => setTocQuery(event.target.value)} placeholder="篇名、卷次或體例" />
          </label>
          <nav className="toc-list" aria-label="《史記》篇目">
            {manifest.categories.map((category) => {
              const items = visibleChapters.filter((item) => item.category === category.name);
              if (!items.length) return null;
              return (
                <details key={category.name} open={volume >= category.start && volume <= category.end}>
                  <summary>
                    <span><b>{category.name}</b><small>{category.description}</small></span>
                    <em>{category.count}</em>
                  </summary>
                  <div>
                    {items.map((item) => (
                      <button
                        key={item.id}
                        className={volume === item.volume ? "active" : ""}
                        onClick={() => chooseVolume(item.volume)}
                      >
                        <span className="toc-number">{String(item.volume).padStart(3, "0")}</span>
                        <span>{item.title}</span>
                        {bookmarks.includes(item.volume) && <Bookmark size={11} fill="currentColor" />}
                      </button>
                    ))}
                  </div>
                </details>
              );
            })}
          </nav>
          <div className="toc-foot">← → 切換篇章　/ 開啟檢索</div>
        </aside>

        {sidebarOpen && <button className="drawer-scrim" onClick={() => setSidebarOpen(false)} aria-label="關閉目錄" />}

        <main className="reading-column">
          {loading || !chapter ? (
            <div className="reading-paper loading-paper"><BrandLogo className="brand-logo--compact animate-pulse" decorative /><p>展卷中……</p></div>
          ) : (
            <article ref={articleRef} className="reading-paper" style={{ "--reading-size": `${fontSize}px` } as React.CSSProperties}>
              <div className="chapter-kicker">
                <span>{chapter.category}</span>
                <i />
                <span>第 {chapter.categoryIndex} 篇</span>
              </div>
              <h1>{chapter.title}</h1>
              <div className="chapter-meta">
                <span>{chapter.volumeLabel}</span>
                <span>{formatNumber(chapter.charCount)} 字</span>
                <span>{chapter.sections.length} 節</span>
              </div>
              <div className="chapter-ornament" aria-hidden="true"><span>太史公</span></div>

              <LayerTabs active={readingLayer} onChange={setReadingLayer} scholia={scholia} editorial={editorial} context={context} />

              {activeQuery && readingLayer === "original" && (
                <div className="search-context">
                  正在標示「{activeQuery}」於本篇的結果
                  <button onClick={() => setActiveQuery("")}>清除</button>
                </div>
              )}

              {readingLayer === "original" && <OriginalLayer chapter={chapter} query={activeQuery} markText={markText} />}
              {readingLayer === "translation" && editorial && <TranslationLayer chapter={chapter} editorial={editorial} />}
              {readingLayer === "scholia" && scholia && <ScholiaLayer scholia={scholia} />}
              {readingLayer === "critical" && scholia && <CriticalLayer scholia={scholia} />}
              {readingLayer === "guide" && editorial && <GuideLayer editorial={editorial} />}
              {readingLayer === "context" && context && <ContextLayer context={context} />}
              {((readingLayer === "scholia" || readingLayer === "critical") && !scholia) || ((readingLayer === "translation" || readingLayer === "guide") && !editorial) || (readingLayer === "context" && !context) ? (
                <div className="layer-loading">內容層載入中……</div>
              ) : null}

              <footer className="chapter-source">
                <p>文本來源與授權</p>
                <span>古籍原文與三家古注為公有領域；編排、標點與校勘取自維基文庫並依來源授權。白話與導讀為 AI 輔助內容。</span>
                <a href={chapter.sourceUrl} target="_blank" rel="noreferrer">檢視原始頁面 ↗</a>
                <a href={`https://zh.wikisource.org/zh-hant/史記三家註/卷${String(volume).padStart(3, "0")}`} target="_blank" rel="noreferrer">檢視三家註頁面 ↗</a>
              </footer>
            </article>
          )}

          <nav className="chapter-pager" aria-label="篇章切換">
            <button disabled={volume <= 1} onClick={() => chooseVolume(volume - 1)}>
              <ChevronLeft size={18} />
              <span><small>上一篇</small>{volume > 1 ? manifest.chapters[volume - 2].title : "已至卷首"}</span>
            </button>
            <span>{volume} / 130</span>
            <button disabled={volume >= 130} onClick={() => chooseVolume(volume + 1)}>
              <span><small>下一篇</small>{volume < 130 ? manifest.chapters[volume].title : "已至卷末"}</span>
              <ChevronRight size={18} />
            </button>
          </nav>
        </main>

        <aside className="tool-rail" aria-label="閱讀工具">
          <button onClick={goHome} title="首頁"><Home size={18} /><span>首頁</span></button>
          <button onClick={() => setSearchOpen(true)} title="全文檢索"><Search size={18} /><span>檢索</span></button>
          <button onClick={toggleBookmark} className={bookmarks.includes(volume) ? "active" : ""} title="書籤">
            {bookmarks.includes(volume) ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}<span>書籤</span>
          </button>
          <button onClick={() => setNotesOpen(true)} className={notes[String(volume)] ? "active" : ""} title="讀札"><FilePenLine size={18} /><span>讀札</span></button>
          <button onClick={() => setAiOpen(true)} className={aiOpen ? "active" : ""} title="AI 問答"><Bot size={18} /><span>問答</span></button>
          <button onClick={openReport} className={reportOpen ? "active" : ""} title="錯誤回報"><Flag size={18} /><span>回報</span></button>
          <button onClick={toggleSpeech} className={speaking ? "active" : ""} title="朗讀">
            {speaking ? <CircleStop size={18} /> : <Volume2 size={18} />}<span>{speaking ? "停止" : "朗讀"}</span>
          </button>
          <button onClick={() => setSettingsOpen(true)} title="版面"><Settings2 size={18} /><span>版面</span></button>
        </aside>
      </div>

      {searchOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="全文檢索">
          <button className="modal-scrim" onClick={() => setSearchOpen(false)} aria-label="關閉" />
          <section className="search-dialog">
            <header><div><p className="eyebrow">全文檢索</p><h2>檢索一百三十篇</h2></div><button className="icon-button" aria-label="關閉全文檢索" onClick={() => setSearchOpen(false)}><X size={19} /></button></header>
            <form onSubmit={(event) => { event.preventDefault(); void searchCorpus(); }}>
              <Search size={18} />
              <input autoFocus aria-label="搜尋詞" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="輸入人物、地名或詞句" />
              <button type="submit" disabled={searching}>{searching ? "檢索中" : "檢索"}</button>
            </form>
            <div className="search-results">
              {!searchResults.length && !searching && <div className="search-empty"><span className="seal-outline">索</span><p>可搜尋篇名與全部原文；按「/」亦可開啟。</p></div>}
              {searchResults.map((result) => (
                <button key={result.volume} onClick={() => { setActiveQuery(result.query); chooseVolume(result.volume); }}>
                  <span className="result-index">{String(result.volume).padStart(3, "0")}</span>
                  <span className="result-main"><b>{result.title}</b><small>{markText(result.snippet, searchQuery)}</small></span>
                  <em>{result.count} 處</em>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="閱讀設定">
          <button className="modal-scrim" onClick={() => setSettingsOpen(false)} aria-label="關閉" />
          <section className="side-dialog">
            <header><div><p className="eyebrow">閱讀設定</p><h2>調整版面</h2></div><button className="icon-button" aria-label="關閉閱讀設定" onClick={() => setSettingsOpen(false)}><X size={19} /></button></header>
            <div className="setting-group"><label>字級</label><div className="font-options">{fontSizes.map((size) => <button key={size} className={fontSize === size ? "active" : ""} onClick={() => updateFontSize(size)} style={{ fontSize: `${Math.min(size, 23)}px` }}>字</button>)}</div></div>
            <div className="setting-row"><span><b>夜讀模式</b><small>降低暗處閱讀眩光</small></span><button role="switch" aria-checked={night} aria-label="夜讀模式" className={`switch ${night ? "on" : ""}`} onClick={toggleNight}>{night ? <Moon size={15} /> : <Sun size={15} />}</button></div>
            <div className="setting-row"><span><b>寬幅閱讀</b><small>增加內文與表格寬度</small></span><button role="switch" aria-checked={wide} aria-label="寬幅閱讀" className={`switch ${wide ? "on" : ""}`} onClick={toggleWide}><span /></button></div>
          </section>
        </div>
      )}

      {notesOpen && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="讀札">
          <button className="modal-scrim" onClick={() => setNotesOpen(false)} aria-label="關閉" />
          <section className="side-dialog notes-dialog">
            <header><div><p className="eyebrow">本機讀札</p><h2>{meta.title}</h2></div><button className="icon-button" aria-label="關閉讀札" onClick={() => setNotesOpen(false)}><X size={19} /></button></header>
            <p className="note-help">內容只儲存在此瀏覽器，不會上傳。</p>
            <textarea aria-label="本篇讀札" value={notes[String(volume)] || ""} onChange={(event) => saveNote(event.target.value)} placeholder="記下人物關係、年代疑問或閱讀心得……" />
            <div className="note-status">已自動儲存 · {notes[String(volume)]?.length || 0} 字</div>
          </section>
        </div>
      )}

      {aiOpen && (
        <div className="modal-layer ai-modal-layer">
          <button className="modal-scrim" onClick={() => setAiOpen(false)} aria-label="關閉 AI 問答" />
          <ShijiAI key={volume} volume={volume} title={meta.title} onClose={() => setAiOpen(false)} />
        </div>
      )}
      {reportOpen && (
        <div className="modal-layer report-modal-layer">
          <button className="modal-scrim" onClick={() => setReportOpen(false)} aria-label="關閉錯誤回報" />
          <CorrectionReport
            key={`${volume}-${reportSelection.sectionIndex}-${reportSelection.blockIndex}-${reportSelection.selectedText}`}
            volume={volume}
            title={meta.title}
            defaultLayer={readingLayer === "translation" ? "translation" : "original"}
            selectedText={reportSelection.selectedText}
            sectionIndex={reportSelection.sectionIndex}
            blockIndex={reportSelection.blockIndex}
            onClose={() => setReportOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
