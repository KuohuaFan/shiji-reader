import {
  Activity,
  AlertTriangle,
  ArrowDown,
  Archive,
  BookOpen,
  Bot,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileSearch,
  Fingerprint,
  FolderKanban,
  GitCompareArrows,
  History,
  House,
  Landmark,
  Library,
  ListTree,
  Loader2,
  Menu,
  PanelLeftClose,
  PanelRightClose,
  Plus,
  Radar,
  Scale,
  ScrollText,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import BrandLogo from "@/components/BrandLogo";
import { manifest } from "@/lib/content";
import { appHref, chapterHref, isStaticPagesBuild, officialSiteUrl, reviewHref } from "@/lib/site";
import { trpc } from "@/lib/trpc";

const sourceOptions = ["原文", "集解", "索隱", "正義"] as const;
const periodOptions = ["不限", "上古與五帝", "夏商周", "春秋", "戰國", "秦", "楚漢", "西漢前期", "漢武帝時期"] as const;
const gateDefinitions = [
  { id: "facts", label: "當代事實", icon: FileSearch, help: "至少兩個獨立來源，其中至少一個是一手來源。" },
  { id: "shiji", label: "史記證據", icon: ScrollText, help: "每項歷史類比必須附篇名、原文引句與資料層。" },
  { id: "boundary", label: "類比邊界", icon: GitCompareArrows, help: "並列相似、差異與反例，不把古今制度直接等同。" },
  { id: "forecast", label: "情境推演", icon: Activity, help: "輸出30／90／365日可否證情境，而非必然預言。" },
  { id: "trace", label: "可追溯性", icon: Fingerprint, help: "保存模型、時間、來源快照雜湊及提示摘要。" },
  { id: "outcome", label: "事後驗證", icon: Target, help: "先定義結果判準，日後另行標記結果並計算Brier分數。" },
  { id: "disclosure", label: "法律政治揭露", icon: Scale, help: "歷史比較研究，不是法律意見、投資建議或選舉宣傳。" },
] as const;

type GateId = (typeof gateDefinitions)[number]["id"];
type RightPanel = "chapters" | "books" | "event" | "gates" | "artifact" | null;
type Mode = "chat" | "event";

type Citation = { id: string; layer: string; section: string; quote: string };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; confidence?: "高" | "中" | "低"; citations?: Citation[]; kind?: "chat" | "event" };
type ContemporarySource = { title: string; url: string; publisher: string; publishedAt: string; kind: "primary" | "independent"; excerpt: string };
type EventArtifact = {
  verifiedFacts: Array<{ claim: string; sourceIndexes: number[] }>;
  disputedFacts: string[];
  lesson: string;
  analogy: { citationIds: string[]; similarities: string[]; differences: string[]; counterexample: string };
  forecasts: Array<{ horizonDays: 30 | 90 | 365; proposition: string; probability: number; leadingIndicators: string[]; invalidationConditions: string[]; resolutionCriteria: string }>;
  legalPoliticalDisclosure: string;
  citations: Array<Citation & { volume: number; title: string }>;
  audit: { status: "AI初稿"; artifactCode?: string; analyzedAt: string; model: string; jurisdiction: string; eventDate: string; promptSummary: string; promptHash: string; sourceSnapshotHash: string; sourceCount: number; primarySourceCount: number };
  sources: Array<ContemporarySource & { index: number }>;
  outcomes?: Partial<Record<"30" | "90" | "365", 0 | 1>>;
};
type Session = { id: string; title: string; updatedAt: number; starred: boolean; project: string; volume: number; mode: Mode; messages: ChatMessage[]; artifact?: EventArtifact };

const projects = [
  { name: "通古今", description: "跨篇閱讀與制度比較" },
  { name: "人物與權力", description: "人物抉擇、組織與權力關係" },
  { name: "法制變遷", description: "刑名、官制與法律思想" },
  { name: "事件簿研究", description: "當代事件與歷史情境推演" },
];

const books = [
  { title: "《史記》原文", author: "司馬遷", kind: "本站全文", source: "原文" as const },
  { title: "《史記集解》", author: "裴駰", kind: "本站全文", source: "集解" as const },
  { title: "《史記索隱》", author: "司馬貞", kind: "本站全文", source: "索隱" as const },
  { title: "《史記正義》", author: "張守節", kind: "本站全文", source: "正義" as const },
  { title: "《史記志疑》", author: "梁玉繩", kind: "外部書目", url: "https://zh.wikisource.org/wiki/史記志疑" },
  { title: "《史記探源》", author: "崔適", kind: "外部書目", url: "https://books.google.com/books/about/史記探源.html?id=8ZXL_2SLBjkC" },
  { title: "《史記會注考證》", author: "瀧川龜太郎", kind: "外部館藏", url: "https://taiwanebook.ncl.edu.tw/zh-tw/book/NTUL-0272410" },
];

const emptySource = (): ContemporarySource => ({ title: "", url: "", publisher: "", publishedAt: "", kind: "independent", excerpt: "" });
const makeId = () => crypto.randomUUID();
const newSession = (): Session => ({ id: makeId(), title: "新的史記對話", updatedAt: Date.now(), starred: false, project: "通古今", volume: 0, mode: "chat", messages: [] });
function readSessions(): Session[] {
  try {
    const raw = localStorage.getItem("shiji:workbench-sessions");
    const parsed = raw ? JSON.parse(raw) as Session[] : [];
    return parsed.slice(0, 30);
  } catch {
    return [];
  }
}
function dateLabel(value: number) {
  return new Date(value).toLocaleDateString("zh-Hant", { month: "short", day: "numeric" });
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function TypewriterText({ text, active, reducedMotion, onProgress, onComplete }: {
  text: string;
  active: boolean;
  reducedMotion: boolean;
  onProgress: () => void;
  onComplete: () => void;
}) {
  const [visibleLength, setVisibleLength] = useState(active && !reducedMotion ? 0 : text.length);
  const progressRef = useRef(onProgress);
  const completeRef = useRef(onComplete);
  progressRef.current = onProgress;
  completeRef.current = onComplete;

  useEffect(() => {
    if (!active || reducedMotion) {
      setVisibleLength(text.length);
      if (active) queueMicrotask(() => completeRef.current());
      return;
    }

    let cancelled = false;
    let timer = 0;
    const batchSize = Math.max(1, Math.ceil(text.length / 220));
    setVisibleLength(0);

    const reveal = (from: number) => {
      if (cancelled) return;
      const next = Math.min(text.length, from + batchSize);
      setVisibleLength(next);
      progressRef.current();
      if (next >= text.length) {
        completeRef.current();
        return;
      }
      const last = text[next - 1];
      const pause = last === "\n" ? 92 : "。！？；".includes(last) ? 72 : "，、：".includes(last) ? 42 : 20;
      timer = window.setTimeout(() => reveal(next), pause);
    };

    timer = window.setTimeout(() => reveal(0), 90);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active, reducedMotion, text]);

  const finish = () => {
    setVisibleLength(text.length);
    progressRef.current();
    completeRef.current();
  };

  return (
    <p className={active ? "typewriter-paragraph active" : "typewriter-paragraph"}>
      {active && <span className="sr-only">{text}</span>}
      <span className="typewriter-text" aria-hidden={active || undefined}>{text.slice(0, visibleLength)}</span>
      {active && visibleLength < text.length && <>
        <span className="typewriter-cursor" aria-hidden="true" />
        <button className="typewriter-skip" type="button" onClick={finish}>顯示全文</button>
      </>}
    </p>
  );
}

export default function ShijiWorkbench({ onOpenChapter }: { onOpenChapter: (volume: number) => void }) {
  const initialSessions = useMemo(() => readSessions(), []);
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [current, setCurrent] = useState<Session>(() => {
    const session = newSession();
    const requestedVolume = Number(new URLSearchParams(window.location.search).get("volume"));
    if (Number.isInteger(requestedVolume) && requestedVolume >= 1 && requestedVolume <= 130) session.volume = requestedVolume;
    return session;
  });
  const [leftOpen, setLeftOpen] = useState(() => !window.matchMedia("(max-width: 820px)").matches);
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);
  const [expandedGates, setExpandedGates] = useState<GateId[]>(["facts"]);
  const [input, setInput] = useState(() => new URLSearchParams(window.location.search).get("prompt") || "");
  const [sources, setSources] = useState<Array<(typeof sourceOptions)[number]>>([...sourceOptions]);
  const [period, setPeriod] = useState<(typeof periodOptions)[number]>("不限");
  const [chapterQuery, setChapterQuery] = useState("");
  const [selectedBook, setSelectedBook] = useState<string>("《史記》原文與三家註");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [jurisdiction, setJurisdiction] = useState("臺灣");
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eventCategory, setEventCategory] = useState<"政治" | "歷史" | "法制" | "國際" | "社會" | "經濟">("法制");
  const [sourceDisagreement, setSourceDisagreement] = useState("");
  const [eventSources, setEventSources] = useState<ContemporarySource[]>([
    { ...emptySource(), kind: "primary" },
    emptySource(),
  ]);
  const reducedMotion = useReducedMotion();
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoFollowRef = useRef(true);
  const programmaticScrollUntilRef = useRef(0);
  const scrollFrameRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);

  const scrollToLatest = useCallback((force = false) => {
    if (!force && !autoFollowRef.current) return;
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const node = scrollRef.current;
      if (!node) return;
      autoFollowRef.current = true;
      programmaticScrollUntilRef.current = Date.now() + (reducedMotion ? 0 : 520);
      setShowJumpToLatest(false);
      node.scrollTo({ top: node.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
      lastScrollTopRef.current = node.scrollTop;
    });
  }, [reducedMotion]);

  const handleConversationScroll = () => {
    const node = scrollRef.current;
    if (!node) return;
    const movedUp = node.scrollTop < lastScrollTopRef.current - 10;
    lastScrollTopRef.current = node.scrollTop;
    if (movedUp) {
      programmaticScrollUntilRef.current = 0;
      autoFollowRef.current = false;
      setShowJumpToLatest(true);
      return;
    }
    if (Date.now() < programmaticScrollUntilRef.current) return;
    const atLatest = node.scrollHeight - node.scrollTop - node.clientHeight < 88;
    autoFollowRef.current = atLatest;
    setShowJumpToLatest(!atLatest);
  };

  useEffect(() => {
    document.title = "史記對話工作臺｜太史公書";
  }, []);
  useEffect(() => {
    setSessions(previous => {
      const withoutCurrent = previous.filter(item => item.id !== current.id);
      const next = current.messages.length || current.artifact
        ? [current, ...withoutCurrent].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30)
        : withoutCurrent;
      localStorage.setItem("shiji:workbench-sessions", JSON.stringify(next));
      return next;
    });
  }, [current]);
  useEffect(() => {
    scrollToLatest();
  }, [current.messages.length, scrollToLatest]);
  useEffect(() => {
    setTypingMessageId(null);
    autoFollowRef.current = true;
    setShowJumpToLatest(false);
    scrollToLatest(true);
  }, [current.id, scrollToLatest]);
  useEffect(() => () => {
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
  }, []);

  const updateCurrent = (patch: Partial<Session> | ((session: Session) => Partial<Session>)) => {
    setCurrent(session => ({ ...session, ...(typeof patch === "function" ? patch(session) : patch), updatedAt: Date.now() }));
  };
  const appendMessage = (message: ChatMessage) => updateCurrent(session => ({ messages: [...session.messages, message], title: session.messages.length ? session.title : message.content.slice(0, 26) }));
  const visibleChapters = manifest.chapters.filter(chapter => !chapterQuery.trim() || `${chapter.volumeLabel}${chapter.title}${chapter.category}`.includes(chapterQuery.trim()));

  const ask = trpc.shiji.ask.useMutation({
    onSuccess: data => {
      const id = makeId();
      setTypingMessageId(id);
      appendMessage({ id, role: "assistant", content: data.answer, confidence: data.confidence, citations: data.citations, kind: "chat" });
    },
    onError: error => toast.error(error.message || "史記問答暫時無法使用"),
  });
  const analyzeEvent = trpc.eventLedger.analyze.useMutation({
    onSuccess: data => {
      const artifact = data as EventArtifact;
      const id = makeId();
      setTypingMessageId(id);
      updateCurrent(session => ({
        artifact,
        title: eventTitle.slice(0, 26),
        messages: [...session.messages, { id, role: "assistant", kind: "event", content: artifact.lesson, citations: artifact.citations, confidence: "中" }],
      }));
      setRightPanel("artifact");
      setExpandedGates(gateDefinitions.map(gate => gate.id));
      toast.success("事件簿 AI 初稿已完成；尚待編輯覆核");
    },
    onError: error => toast.error(error.message || "事件簿分析暫時無法使用"),
  });

  const submitChat = () => {
    const question = input.trim();
    if (!question || ask.isPending) return;
    if (isStaticPagesBuild) {
      const url = new URL(officialSiteUrl);
      url.searchParams.set("prompt", question);
      if (current.volume) url.searchParams.set("volume", String(current.volume));
      if (period !== "不限") url.searchParams.set("period", period);
      window.location.assign(url.toString());
      return;
    }
    const history = current.messages.filter(message => message.role === "user").slice(-6).map(message => ({ role: "user" as const, content: message.content }));
    setTypingMessageId(null);
    appendMessage({ id: makeId(), role: "user", content: question, kind: "chat" });
    setInput("");
    ask.mutate({ volume: current.volume, question, history, sources, period });
  };
  const submitEvent = () => {
    if (isStaticPagesBuild) {
      window.location.assign(`${officialSiteUrl}/`);
      return;
    }
    if (eventSources.length < 2) return toast.error("至少需要兩個獨立來源");
    setTypingMessageId(null);
    appendMessage({ id: makeId(), role: "user", kind: "event", content: `事件簿：${eventTitle}\n${eventDescription}` });
    updateCurrent({ mode: "event", project: "事件簿研究" });
    analyzeEvent.mutate({ title: eventTitle, description: eventDescription, jurisdiction, eventDate, category: eventCategory, sourceDisagreement, sources: eventSources });
  };
  const startNew = () => {
    setCurrent(newSession());
    setInput("");
    setRightPanel(null);
  };
  const openGate = (id: GateId) => {
    setRightPanel(current.artifact ? "artifact" : "gates");
    setExpandedGates(list => list.includes(id) ? list : [...list, id]);
  };
  const toggleGate = (id: GateId) => setExpandedGates(list => list.includes(id) ? list.filter(item => item !== id) : [...list, id]);
  const setMode = (mode: Mode) => {
    updateCurrent({ mode, project: mode === "event" ? "事件簿研究" : current.project });
    if (mode === "event") setRightPanel("event");
  };
  const chooseBook = (book: typeof books[number]) => {
    setSelectedBook(book.title);
    if ("source" in book && book.source) {
      setSources([book.source]);
      toast.success(`問答來源已限定為${book.title}`);
    }
  };
  const markOutcome = (horizon: 30 | 90 | 365, value: 0 | 1) => {
    if (!current.artifact) return;
    updateCurrent({ artifact: { ...current.artifact, outcomes: { ...current.artifact.outcomes, [String(horizon)]: value } } });
  };

  return (
    <main className={`workbench ${leftOpen ? "left-open" : "left-closed"} ${rightPanel ? "right-open" : ""}`}>
      <div className="grain" aria-hidden="true" />
      <aside className={`workspace-left ${leftOpen ? "open" : "closed"}`} aria-label="工作抽屜">
        <header><button className="workspace-brand" onClick={startNew}><BrandLogo className="brand-logo--compact" /><span><b>史記工作臺</b><small>通古今之變</small></span></button><button aria-label="收合左側抽屜" onClick={() => setLeftOpen(false)}><PanelLeftClose size={17} /></button></header>
        <button className="new-conversation" onClick={startNew}><Plus size={15} />新的對話</button>
        <nav className="workspace-nav">
          <details open><summary><History size={14} />紀錄<ChevronDown size={12} /></summary><div>{sessions.map(session => <button key={session.id} className={session.id === current.id ? "active" : ""} onClick={() => setCurrent(session)}><span>{session.title}</span><small>{dateLabel(session.updatedAt)}</small></button>)}</div></details>
          <details><summary><Star size={14} />Starred<ChevronDown size={12} /></summary><div>{sessions.filter(item => item.starred).map(session => <button key={session.id} onClick={() => setCurrent(session)}><span>{session.title}</span><small>{dateLabel(session.updatedAt)}</small></button>)}{!sessions.some(item => item.starred) && <p>尚無加星對話</p>}</div></details>
          <details open><summary><FolderKanban size={14} />Projects<ChevronDown size={12} /></summary><div>{projects.map(project => <button key={project.name} className={current.project === project.name ? "active" : ""} onClick={() => updateCurrent({ project: project.name, mode: project.name === "事件簿研究" ? "event" : "chat" })}><span>{project.name}</span><small>{project.description}</small></button>)}</div></details>
          <details open><summary><Box size={14} />Artifacts<ChevronDown size={12} /></summary><div>{sessions.filter(item => item.artifact).map(session => <button key={session.id} onClick={() => { setCurrent(session); setRightPanel("artifact"); }}><span>{session.title}</span><small>事件簿 · AI初稿</small></button>)}{!sessions.some(item => item.artifact) && <p>事件簿完成後會保存在此</p>}</div></details>
        </nav>
        <footer><a href={appHref("about")}><Library size={13} />讀本說明</a><a href={reviewHref()}><ShieldCheck size={13} />人工校訂台</a></footer>
      </aside>

      <section className="workspace-center">
        <header className="workspace-topbar">
          <div className="workspace-top-primary">
            {!leftOpen && <button aria-label="開啟左側抽屜" onClick={() => setLeftOpen(true)}><Menu size={18} /></button>}
            <button aria-label="回到工作臺首頁" title="首頁" onClick={startNew}><House size={15} /><span>首頁</span></button>
            <button onClick={() => setRightPanel("chapters")} className={rightPanel === "chapters" ? "active" : ""}><ListTree size={15} /><span>章節</span></button>
            <button onClick={() => setRightPanel("books")} className={rightPanel === "books" ? "active" : ""}><Library size={15} /><span>古今書庫</span></button>
            <button onClick={() => { setMode("event"); setRightPanel("event"); }} className={current.mode === "event" ? "active" : ""}><Radar size={15} /><span>事件簿</span></button>
            <span className="workspace-scope">{current.volume ? `卷${current.volume} · ${manifest.chapters[current.volume - 1]?.title}` : "全書一百三十篇"}</span>
            <button className={current.starred ? "starred" : ""} onClick={() => updateCurrent({ starred: !current.starred })} aria-label={current.starred ? "取消加星" : "將對話加星"}><Star size={16} fill={current.starred ? "currentColor" : "none"} /></button>
          </div>
          <div className="verification-gates" aria-label="事件簿發布閘門">{gateDefinitions.map(gate => <button key={gate.id} onClick={() => openGate(gate.id)} className={expandedGates.includes(gate.id) && rightPanel ? "active" : ""}><gate.icon size={13} /><span>{gate.label}</span></button>)}</div>
        </header>

        <div className="workspace-conversation" ref={scrollRef} onScroll={handleConversationScroll} aria-live="polite" aria-busy={ask.isPending || analyzeEvent.isPending || Boolean(typingMessageId)}>
          {!current.messages.length && (
            <section className="workbench-empty">
              <BrandLogo className="brand-logo--hero" />
              <p>《史記》對話工作臺</p>
              <h1>以古鑑今，先問證據</h1>
              <div className="empty-rule" />
              <p className="workbench-intro">可從一百三十篇原文、集解、索隱與正義提問；亦可建立「事件簿」，用可核查來源對照歷史教訓與未來情境。</p>
              <div className="workbench-suggestions">
                {["比較項羽與劉邦的用人方式", "《史記》如何看待法令與民心？", "從商君列傳整理制度變革的代價"].map(prompt => <button key={prompt} onClick={() => { setInput(prompt); setMode("chat"); }}>{prompt}<ChevronRight size={14} /></button>)}
                <button onClick={() => setMode("event")}><b>事件簿</b>：以兩個當代來源建立30／90／365日情境<ChevronRight size={14} /></button>
              </div>
            </section>
          )}
          {current.messages.map(message => {
            const isTyping = message.role === "assistant" && typingMessageId === message.id;
            return (
            <article className={`workbench-message ${message.role}${isTyping ? " typing" : ""}`} key={message.id}>
              <div className="workbench-speaker">{message.role === "user" ? <UserRound size={16} /> : <BrandLogo className="brand-logo--speaker" decorative />}<b>{message.role === "user" ? "你" : message.kind === "event" ? "事件簿" : "史記助讀"}</b></div>
              <div className="workbench-answer"><TypewriterText text={message.content} active={isTyping} reducedMotion={reducedMotion} onProgress={() => scrollToLatest()} onComplete={() => setTypingMessageId(value => value === message.id ? null : value)} />{!isTyping && message.confidence && <span className="support-level">資料支持度 · {message.confidence}</span>}{!isTyping && message.citations?.length ? <details><summary>核對 {message.citations.length} 則《史記》引文</summary>{message.citations.map(citation => <blockquote key={citation.id}><b>〔{citation.layer}〕{citation.section}</b><p>{citation.quote}</p></blockquote>)}</details> : null}</div>
            </article>
          );})}
          {(ask.isPending || analyzeEvent.isPending) && <div className="workbench-thinking"><Loader2 size={17} className="animate-spin" /><span>{analyzeEvent.isPending ? "正在通過七道核實閘門並建立情境……" : "正在全書與三家註中核對……"}</span></div>}
        </div>

        {showJumpToLatest && <button className="jump-to-latest" type="button" onClick={() => scrollToLatest(true)}><ArrowDown size={14} />回到最新對話</button>}

        <footer className="workspace-composer">
          <div className="composer-meta">
            <div className="mode-switch"><button className={current.mode === "chat" ? "active" : ""} onClick={() => setMode("chat")}><Bot size={13} />史記問答</button><button className={current.mode === "event" ? "active" : ""} onClick={() => setMode("event")}><Radar size={13} />事件簿</button></div>
            <button onClick={() => setRightPanel("chapters")}><ListTree size={13} />{current.volume ? `卷${current.volume}` : "全書"}</button>
            <button onClick={() => setRightPanel("books")}><BookOpen size={13} />{selectedBook}</button>
            <label>時期<select aria-label="工作臺歷史時期" value={period} onChange={event => setPeriod(event.target.value as typeof period)}>{periodOptions.map(option => <option key={option}>{option}</option>)}</select></label>
          </div>
          {current.mode === "chat" ? <form onSubmit={event => { event.preventDefault(); submitChat(); }}><textarea aria-label="輸入史記問題" autoFocus value={input} onChange={event => setInput(event.target.value)} placeholder="向《史記》提問；Shift + Enter 換行" maxLength={500} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitChat(); } }} /><button type="submit" aria-label="送出史記問題" disabled={!input.trim() || ask.isPending}><Send size={17} /></button></form> : <button className="event-composer-link" onClick={() => setRightPanel("event")}><Radar size={16} /><span><b>{eventTitle || "建立事件簿"}</b><small>先填入至少兩個來源，再進行情境推演</small></span><ChevronRight size={16} /></button>}
          <small className="composer-disclaimer">{isStaticPagesBuild ? <>GitHub Pages 提供靜態讀本；AI、事件簿與資料提交將轉往<a href={officialSiteUrl}>正式全端網站</a>。</> : "AI 可能出錯。史記問答須回查原文；事件簿不是法律意見、投資建議、選舉宣傳或事實預言。"}</small>
        </footer>
      </section>

      {rightPanel && <aside className="workspace-right" aria-label="右側功能抽屜">
        <header><div><p className="eyebrow">工作抽屜</p><h2>{rightPanel === "chapters" ? "一百三十篇" : rightPanel === "books" ? "古今解釋《史記》的書" : rightPanel === "event" ? "建立事件簿" : rightPanel === "artifact" ? "事件簿核實檔案" : "七道發布閘門"}</h2></div><button aria-label="關閉右側抽屜" onClick={() => setRightPanel(null)}><PanelRightClose size={18} /></button></header>
        {rightPanel === "chapters" && <div className="drawer-chapters"><label><FileSearch size={14} /><input aria-label="搜尋章節" value={chapterQuery} onChange={event => setChapterQuery(event.target.value)} placeholder="篇名、卷次或體例" /></label><button className={!current.volume ? "active" : ""} onClick={() => updateCurrent({ volume: 0 })}><span>全</span><b>全書跨篇問答</b><small>一百三十篇</small></button>{visibleChapters.map(chapter => <div className={`chapter-choice ${current.volume === chapter.volume ? "active" : ""}`} key={chapter.volume}><button onClick={() => { updateCurrent({ volume: chapter.volume }); setRightPanel(null); }}><span>{String(chapter.volume).padStart(3, "0")}</span><b>{chapter.title}</b><small>{chapter.category}</small></button><button aria-label={`閱讀${chapter.title}`} onClick={() => onOpenChapter(chapter.volume)}><BookOpen size={13} /></button></div>)}</div>}
        {rightPanel === "books" && <div className="drawer-books"><p>本站只會引用已匯入的原文與三家註；近現代書籍僅作書目線索，不假稱已讀取其全文。</p>{books.map(book => <article key={book.title} className={selectedBook === book.title ? "active" : ""}><button onClick={() => chooseBook(book)}><small>{book.kind}</small><b>{book.title}</b><span>{book.author}</span></button>{"url" in book && book.url && <a href={book.url} target="_blank" rel="noreferrer" aria-label={`開啟${book.title}外部來源`}><ExternalLink size={13} /></a>}</article>)}</div>}
        {rightPanel === "event" && <div className="event-builder">
          <div className="event-builder-notice"><ShieldCheck size={15} />只有通過來源門檻的事件才會送交模型；輸出一律標為 AI 初稿。</div>
          <div className="event-radar-status"><Activity size={14} />每日自動事件雷達已啟用（Asia／Taipei，每 24 小時）；最多建立兩則待真人覆核初稿，不會自動發布。</div>
          <label>事件名稱<input value={eventTitle} onChange={event => setEventTitle(event.target.value)} maxLength={240} placeholder="例如：某項重大法案的立法與覆議爭議" /></label>
          <div className="event-row"><label>司法管轄區<input value={jurisdiction} onChange={event => setJurisdiction(event.target.value)} /></label><label>事件日期<input type="date" value={eventDate} onChange={event => setEventDate(event.target.value)} /></label></div>
          <label>類別<select value={eventCategory} onChange={event => setEventCategory(event.target.value as typeof eventCategory)}>{["政治", "歷史", "法制", "國際", "社會", "經濟"].map(item => <option key={item}>{item}</option>)}</select></label>
          <label>已核實事實摘要<textarea value={eventDescription} onChange={event => setEventDescription(event.target.value)} maxLength={8000} placeholder="至少80字；區分已發生事實、程序狀態與尚未確定事項。" /></label>
          <label>來源分歧或爭議事實<textarea value={sourceDisagreement} onChange={event => setSourceDisagreement(event.target.value)} maxLength={2000} placeholder="選填；如來源說法不同，逐項說明。" /></label>
          <div className="event-sources-heading"><span>當代來源 · 至少兩個</span><button onClick={() => eventSources.length < 8 && setEventSources(items => [...items, emptySource()])}><Plus size={13} />新增來源</button></div>
          {eventSources.map((source, index) => <section className="event-source" key={index}><header><b>來源 {index + 1}</b><select aria-label={`來源${index + 1}類型`} value={source.kind} onChange={event => setEventSources(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, kind: event.target.value as ContemporarySource["kind"] } : item))}><option value="primary">一手來源</option><option value="independent">獨立來源</option></select>{eventSources.length > 2 && <button aria-label={`刪除來源${index + 1}`} onClick={() => setEventSources(items => items.filter((_, itemIndex) => itemIndex !== index))}><X size={13} /></button>}</header>{(["title", "publisher", "publishedAt", "url"] as const).map(field => <label key={field}>{field === "title" ? "標題" : field === "publisher" ? "機構／媒體" : field === "publishedAt" ? "發布日期" : "原始網址"}<input type={field === "url" ? "url" : "text"} value={source[field]} onChange={event => setEventSources(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: event.target.value } : item))} /></label>)}<label>來源摘錄<textarea value={source.excerpt} onChange={event => setEventSources(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, excerpt: event.target.value } : item))} placeholder="至少60字，貼入可直接核查的關鍵段落。" /></label></section>)}
          <button className="analyze-event" disabled={analyzeEvent.isPending || eventTitle.length < 5 || eventDescription.length < 80 || eventSources.some(source => !source.title || !source.url || !source.publisher || !source.publishedAt || source.excerpt.length < 60)} onClick={submitEvent}>{analyzeEvent.isPending ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />}通過閘門並建立情境</button>
        </div>}
        {(rightPanel === "gates" || rightPanel === "artifact") && <div className="gate-accordion">{gateDefinitions.map(gate => { const open = expandedGates.includes(gate.id); return <section key={gate.id} className={open ? "open" : ""}><button onClick={() => toggleGate(gate.id)}><gate.icon size={15} /><span><b>{gate.label}</b><small>{gate.help}</small></span><ChevronDown size={14} /></button>{open && <div className="gate-content"><GateContent gate={gate.id} artifact={current.artifact} onMarkOutcome={markOutcome} /></div>}</section>; })}</div>}
      </aside>}
    </main>
  );
}

function GateContent({ gate, artifact, onMarkOutcome }: { gate: GateId; artifact?: EventArtifact; onMarkOutcome: (horizon: 30 | 90 | 365, value: 0 | 1) => void }) {
  if (!artifact) return <p className="gate-placeholder">尚無事件簿分析。請先由「事件簿」填入事件與至少兩個來源；本閘門不會以未核實資料產生預測。</p>;
  if (gate === "facts") return <><h3>已核實事實</h3>{artifact.verifiedFacts.map((fact, index) => <p key={index}>{fact.claim}<small>來源 {fact.sourceIndexes.join("、")}</small></p>)}{artifact.disputedFacts.length > 0 && <><h3>爭議或不足</h3>{artifact.disputedFacts.map((fact, index) => <p key={index} className="disputed"><AlertTriangle size={12} />{fact}</p>)}</>}</>;
  if (gate === "shiji") return <>{artifact.citations.map(citation => <blockquote key={citation.id}><b>卷{citation.volume} · {citation.title} · 〔{citation.layer}〕</b><p>{citation.quote}</p><button onClick={() => { window.location.href = chapterHref(citation.volume); }}>開啟篇章</button></blockquote>)}</>;
  if (gate === "boundary") return <><h3>可比較之處</h3><ul>{artifact.analogy.similarities.map(item => <li key={item}>{item}</li>)}</ul><h3>不可等同之處</h3><ul>{artifact.analogy.differences.map(item => <li key={item}>{item}</li>)}</ul><h3>反例</h3><p>{artifact.analogy.counterexample}</p></>;
  if (gate === "forecast") return <>{artifact.forecasts.map(item => <article className="forecast-entry" key={item.horizonDays}><header><b>{item.horizonDays} 日</b><span>{item.probability}%</span></header><p>{item.proposition}</p><h4>先行指標</h4><ul>{item.leadingIndicators.map(value => <li key={value}>{value}</li>)}</ul><h4>失效條件</h4><ul>{item.invalidationConditions.map(value => <li key={value}>{value}</li>)}</ul></article>)}</>;
  if (gate === "trace") return <dl><dt>事件簿編號</dt><dd><code>{artifact.audit.artifactCode || "本機草稿"}</code></dd><dt>狀態</dt><dd>{artifact.audit.status}</dd><dt>分析時間</dt><dd>{new Date(artifact.audit.analyzedAt).toLocaleString("zh-Hant")}</dd><dt>模型</dt><dd>{artifact.audit.model}</dd><dt>來源</dt><dd>{artifact.audit.sourceCount} 個，其中一手來源 {artifact.audit.primarySourceCount} 個</dd><dt>提示摘要</dt><dd>{artifact.audit.promptSummary}</dd><dt>來源快照雜湊</dt><dd><code>{artifact.audit.sourceSnapshotHash}</code></dd><dt>提示雜湊</dt><dd><code>{artifact.audit.promptHash}</code></dd></dl>;
  if (gate === "outcome") return <><p className="gate-note">以下是讀者端本機試算；正式結果須由管理員於校訂台附核查說明登錄。</p>{artifact.forecasts.map(item => { const outcome = artifact.outcomes?.[String(item.horizonDays) as "30" | "90" | "365"]; const brier = outcome === undefined ? null : ((item.probability / 100 - outcome) ** 2).toFixed(3); return <article className="outcome-entry" key={item.horizonDays}><b>{item.horizonDays} 日結果判準</b><p>{item.resolutionCriteria}</p><div><button className={outcome === 1 ? "active" : ""} onClick={() => onMarkOutcome(item.horizonDays, 1)}>本機試算：已發生</button><button className={outcome === 0 ? "active" : ""} onClick={() => onMarkOutcome(item.horizonDays, 0)}>本機試算：未發生</button></div>{brier && <small>Brier score：{brier}（越接近0越佳）</small>}</article>; })}<p className="gate-note">試算結果只存於本機工作紀錄，不會改寫或發布原預測。</p></>;
  return <><p>{artifact.legalPoliticalDisclosure}</p><p className="gate-note"><Scale size={13} />本工具不為任何政黨、候選人或特定選民製作政治說服內容；法律爭議應另諮詢適格專業人士。</p></>;
}
