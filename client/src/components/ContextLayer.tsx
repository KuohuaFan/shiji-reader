import { Clock3, Network, Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { ChapterContext, ContextEvent, ContextRelationship } from "@/types/content";

const relationColors: Record<ContextRelationship["type"], string> = {
  親屬: "#9b3a32",
  君臣: "#9a7228",
  盟友: "#47765b",
  對立: "#783b5d",
  師友: "#41677b",
  繼承: "#815c35",
  其他: "#777064",
};

function formatYear(year: number, label: string) {
  if (year < 0) return `前 ${Math.abs(year)} 年`;
  if (year > 0) return `${year} 年`;
  return label || "紀年未詳";
}

function PersonGraph({ context }: { context: ChapterContext }) {
  const [activeTypes, setActiveTypes] = useState<ContextRelationship["type"][]>(() => Array.from(new Set(context.relationships.map(item => item.type))));
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(context.people[0]?.name || "");
  const people = context.people.slice(0, 16);
  const points = useMemo(() => {
    const center = { x: 450, y: 275 };
    return new Map(people.map((person, index) => {
      if (index === 0) return [person.name, center];
      const ringIndex = index - 1;
      const inner = ringIndex < 7;
      const count = inner ? Math.min(7, people.length - 1) : Math.max(1, people.length - 8);
      const localIndex = inner ? ringIndex : ringIndex - 7;
      const angle = -Math.PI / 2 + (localIndex * Math.PI * 2) / count;
      const radiusX = inner ? 205 : 350;
      const radiusY = inner ? 145 : 235;
      return [person.name, { x: center.x + Math.cos(angle) * radiusX, y: center.y + Math.sin(angle) * radiusY }];
    }));
  }, [people]);
  const visiblePeople = query.trim() ? people.filter(item => `${item.name}${item.role}${item.group}`.includes(query.trim())) : people;
  const visibleNames = new Set(visiblePeople.map(item => item.name));
  const visibleRelations = context.relationships.filter(item => activeTypes.includes(item.type) && visibleNames.has(item.source) && visibleNames.has(item.target));
  const selectedPerson = people.find(item => item.name === selected) || people[0];
  const toggleType = (type: ContextRelationship["type"]) => setActiveTypes(current => current.includes(type) ? current.filter(item => item !== type) : [...current, type]);

  return <div className="context-view relation-view">
    <div className="context-toolbar">
      <label><Search size={14} /><input aria-label="搜尋人物" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜尋人物" /></label>
      <div className="relation-filters" aria-label="關係類型篩選">
        {(Object.keys(relationColors) as ContextRelationship["type"][]).filter(type => context.relationships.some(item => item.type === type)).map(type =>
          <button key={type} aria-pressed={activeTypes.includes(type)} className={activeTypes.includes(type) ? "active" : ""} style={{ "--relation-color": relationColors[type] } as React.CSSProperties} onClick={() => toggleType(type)}>{type}</button>
        )}
      </div>
    </div>
    <div className="relation-stage">
      <svg viewBox="0 0 900 550" role="img" aria-label={`${context.title}人物關係圖`}>
        <defs><marker id="relation-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#777064" /></marker></defs>
        {visibleRelations.map(relation => {
          const from = points.get(relation.source)!;
          const to = points.get(relation.target)!;
          return <g key={relation.id} className="relation-edge" style={{ color: relationColors[relation.type] }}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} markerEnd="url(#relation-arrow)" />
            <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 5}>{relation.label}</text>
          </g>;
        })}
        {visiblePeople.map(person => {
          const point = points.get(person.name)!;
          const isSelected = selected === person.name;
          return <g key={person.id} className={`person-node ${isSelected ? "selected" : ""}`} transform={`translate(${point.x},${point.y})`} role="button" tabIndex={0} aria-label={`${person.name}，${person.role}`} onClick={() => setSelected(person.name)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") setSelected(person.name); }}>
            <circle r={isSelected ? 42 : 36} /><text textAnchor="middle" y="-2">{person.name.slice(0, 5)}</text><text className="person-role" textAnchor="middle" y="16">{person.role.slice(0, 7)}</text>
          </g>;
        })}
      </svg>
      {selectedPerson && <aside className="person-detail"><p className="eyebrow">人物</p><h3>{selectedPerson.name}</h3><span>{selectedPerson.role}{selectedPerson.group ? ` · ${selectedPerson.group}` : ""}</span><p>{selectedPerson.summary}</p>
        <div>{context.relationships.filter(item => item.source === selectedPerson.name || item.target === selectedPerson.name).slice(0, 5).map(item => <details key={item.id}><summary><i style={{ background: relationColors[item.type] }} />{item.source} — {item.label} — {item.target}</summary><blockquote>{item.evidence}</blockquote></details>)}</div>
      </aside>}
    </div>
  </div>;
}

function Timeline({ context }: { context: ChapterContext }) {
  const eventTypes = Array.from(new Set(context.events.map(item => item.type)));
  const [activeTypes, setActiveTypes] = useState<ContextEvent["type"][]>(eventTypes);
  const knownYears = context.events.map(item => item.year).filter(year => year !== 0);
  const minYear = knownYears.length ? Math.min(...knownYears) : 0;
  const maxYear = knownYears.length ? Math.max(...knownYears) : 0;
  const [fromYear, setFromYear] = useState(minYear);
  const [toYear, setToYear] = useState(maxYear);
  const visible = context.events.filter(item => activeTypes.includes(item.type) && (item.year === 0 || (item.year >= fromYear && item.year <= toYear)));
  const toggleType = (type: ContextEvent["type"]) => setActiveTypes(current => current.includes(type) ? current.filter(item => item !== type) : [...current, type]);
  return <div className="context-view timeline-view">
    <div className="timeline-controls">
      <div className="timeline-types">{eventTypes.map(type => <button key={type} aria-pressed={activeTypes.includes(type)} className={activeTypes.includes(type) ? "active" : ""} onClick={() => toggleType(type)}>{type}</button>)}</div>
      {knownYears.length > 1 && minYear !== maxYear && <div className="year-range"><span>{formatYear(fromYear, "")}</span><label>起始年<input aria-label="年代軸起始年" type="range" min={minYear} max={maxYear} value={fromYear} onChange={event => setFromYear(Math.min(Number(event.target.value), toYear))} /></label><label>結束年<input aria-label="年代軸結束年" type="range" min={minYear} max={maxYear} value={toYear} onChange={event => setToYear(Math.max(Number(event.target.value), fromYear))} /></label><span>{formatYear(toYear, "")}</span></div>}
    </div>
    <div className="timeline-track" tabIndex={0} aria-label="可水平捲動的年代軸">
      {visible.map((event, index) => <article key={event.id} className="timeline-event">
        <div className="timeline-year">{formatYear(event.year, event.yearLabel)}</div><span className="timeline-dot" /><div className="timeline-card"><small>{event.type}</small><h3>{event.title}</h3><p>{event.description}</p>{event.people.length > 0 && <div className="event-people">{event.people.map(name => <span key={name}>{name}</span>)}</div>}<details><summary>原文依據</summary><blockquote>{event.evidence}</blockquote></details></div>{index < visible.length - 1 && <i className="timeline-line" />}
      </article>)}
      {!visible.length && <div className="layer-empty"><span className="seal-outline">年</span><p>目前篩選條件下沒有事件。</p></div>}
    </div>
  </div>;
}

export default function ContextLayer({ context }: { context: ChapterContext }) {
  const [view, setView] = useState<"relations" | "timeline">("relations");
  return <div className="context-layer" id="reading-layer-panel" role="tabpanel">
    <div className="editorial-notice">數位人文視覺化 · 每條關係與事件附本篇原文依據 · AI 結構化初稿，待人工校訂</div>
    <header className="context-heading"><div><p className="eyebrow">歷史脈絡</p><h2>{context.period.label}</h2></div><div role="tablist" aria-label="脈絡視圖"><button role="tab" aria-selected={view === "relations"} className={view === "relations" ? "active" : ""} onClick={() => setView("relations")}><Network size={16} />人物關係圖</button><button role="tab" aria-selected={view === "timeline"} className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}><Clock3 size={16} />互動年代軸</button></div></header>
    {!context.people.length && !context.events.length ? <div className="layer-empty"><UsersRound size={25} /><p>本篇目前沒有足夠資料建立脈絡圖。</p></div> : view === "relations" ? <PersonGraph context={context} /> : <Timeline context={context} />}
  </div>;
}
