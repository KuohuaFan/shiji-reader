import fs from "node:fs/promises";
import path from "node:path";

export type TextBlock = { type: "text"; text: string };
export type TableBlock = { type: "table"; rows: string[][] };
export type Chapter = {
  volume: number;
  volumeLabel: string;
  title: string;
  category: string;
  sections: Array<{ heading: string; blocks: Array<TextBlock | TableBlock> }>;
};
export type Scholium = {
  source: "集解" | "索隱" | "正義";
  text: string;
};
export type Scholia = {
  annotations: Array<{
    section: string;
    anchor: string;
    notes: Scholium[];
  }>;
  criticalNotes: Array<{ number: number; anchor: string; text: string }>;
};
export type Editorial = {
  purpose: string;
  overview: string;
  historicalContext: string;
  themes: string[];
  people: Array<{ name: string; role: string; significance: string }>;
  translations: Array<{ sectionIndex: number; blockIndex: number; text: string }>;
  tableTranslations?: Array<{ sectionIndex: number; blockIndex: number; rowIndex: number; cells: string[] }>;
};

function contentRoot() {
  if (process.env.SHIJI_CONTENT_ROOT) return path.resolve(process.env.SHIJI_CONTENT_ROOT);
  return process.env.NODE_ENV === "production"
    ? path.resolve(import.meta.dirname, "content")
    : path.resolve(import.meta.dirname, "..", "client", "src", "content");
}

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.join(contentRoot(), relativePath), "utf8")) as T;
}

const layerCache = new Map<number, Promise<{ chapter: Chapter; scholia: Scholia; editorial: Editorial }>>();

export async function loadShijiLayers(volume: number) {
  const cached = layerCache.get(volume);
  if (cached) return cached;
  const id = String(volume).padStart(3, "0");
  const pending = Promise.all([
    readJson<Chapter>(`chapters/${id}.json`),
    readJson<Scholia>(`scholia/${id}.json`),
    readJson<Editorial>(`editorial/${id}.json`),
  ]).then(([chapter, scholia, editorial]) => ({ chapter, scholia, editorial }));
  layerCache.set(volume, pending);
  try {
    return await pending;
  } catch (error) {
    layerCache.delete(volume);
    throw error;
  }
}

export type ContextChunk = {
  id: string;
  layer: "原文" | "集解" | "索隱" | "正義" | "校勘" | "白話" | "導讀";
  section: string;
  text: string;
};

const NON_CORPUS_PATTERNS = [
  /公有領域|公有领域/,
  /作者逝世已?經?超過\s*100\s*年/,
  /1931年1月1日之前出版/,
  /著作權|版权声明|版權聲明/,
  /Wikisource|維基文庫|维基文库/i,
  /(?:^|\W)(?:header|reader|eader)\|title=/i,
  /<\s*\/?\s*(?:a|div|span|sup)\b|data-mw|typeof=|id=["']mw/i,
];

/** Reject export-page boilerplate that is not part of the Shiji text or Sanjiazhu. */
export function isAuthenticShijiEvidence(text: string) {
  const normalized = text.replace(/\s+/g, "").trim();
  return normalized.length > 0 && !NON_CORPUS_PATTERNS.some(pattern => pattern.test(normalized));
}

function queryTerms(question: string): string[] {
  const compact = question.replace(/[\s，。！？、；：「」『』（）()《》〈〉的了是在與及如何何以為什麼請問]/g, "");
  const terms = new Set<string>();
  for (let size = 2; size <= 4; size += 1) {
    for (let index = 0; index <= compact.length - size; index += 1) {
      terms.add(compact.slice(index, index + size));
    }
  }
  return Array.from(terms).slice(0, 160);
}

function score(text: string, terms: string[]) {
  return terms.reduce((total, term) => total + (text.includes(term) ? term.length ** 2 : 0), 0);
}

export async function retrieveShijiContext(
  volume: number,
  question: string,
  allowedLayers?: ContextChunk["layer"][],
) {
  const { chapter, scholia, editorial } = await loadShijiLayers(volume);
  const chunks: ContextChunk[] = [];
  chapter.sections.forEach((section, sectionIndex) => {
    section.blocks.forEach((block, blockIndex) => {
      if (block.type === "text") {
        if (isAuthenticShijiEvidence(block.text)) {
          chunks.push({ id: `o-${sectionIndex}-${blockIndex}`, layer: "原文", section: section.heading || "正文", text: block.text });
        }
        return;
      }
      block.rows.forEach((row, rowIndex) => {
        const text = row.join("｜");
        if (!isAuthenticShijiEvidence(text)) return;
        chunks.push({
          id: `o-${sectionIndex}-${blockIndex}-${rowIndex}`,
          layer: "原文",
          section: `${section.heading || "年表"} · 第 ${rowIndex + 1} 列`,
          text,
        });
      });
    });
  });
  scholia.annotations.forEach((entry, entryIndex) => {
    entry.notes.forEach((note, noteIndex) => {
      if (!isAuthenticShijiEvidence(note.text)) return;
      chunks.push({
        id: `s-${entryIndex}-${noteIndex}`,
        layer: note.source,
        section: entry.section || "注釋",
        text: `${entry.anchor ? `所注原文：${entry.anchor}\n` : ""}${note.text}`,
      });
    });
  });
  scholia.criticalNotes.forEach((note, noteIndex) => {
    chunks.push({ id: `n-${noteIndex}`, layer: "校勘", section: "校勘記", text: `${note.anchor}\n${note.text}` });
  });
  editorial.translations.forEach((translation, index) => {
    const section = chapter.sections[translation.sectionIndex]?.heading || "白話翻譯";
    chunks.push({ id: `t-${index}`, layer: "白話", section, text: translation.text });
  });
  editorial.tableTranslations?.forEach((translation, index) => {
    const section = chapter.sections[translation.sectionIndex]?.heading || "年表白話";
    chunks.push({ id: `tt-${index}`, layer: "白話", section: `${section} · 第 ${translation.rowIndex + 1} 列`, text: translation.cells.join("｜") });
  });
  chunks.push({ id: "g-purpose", layer: "導讀", section: "篇旨", text: editorial.purpose });
  chunks.push({ id: "g-overview", layer: "導讀", section: "內容概述", text: editorial.overview });
  chunks.push({ id: "g-context", layer: "導讀", section: "歷史脈絡", text: editorial.historicalContext });
  chunks.push({ id: "g-themes", layer: "導讀", section: "閱讀主題", text: editorial.themes.join("；") });
  editorial.people.forEach((person, index) => {
    chunks.push({ id: `g-person-${index}`, layer: "導讀", section: "人物解說", text: `${person.name}（${person.role}）：${person.significance}` });
  });

  const available = allowedLayers?.length ? chunks.filter(chunk => allowedLayers.includes(chunk.layer)) : chunks;
  const terms = queryTerms(question);
  const ranked = available
    .map((chunk, index) => ({ chunk, index, score: score(chunk.text, terms) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected: ContextChunk[] = [];
  let length = 0;
  for (const candidate of ranked) {
    if (selected.length >= 28 || length >= 32_000) break;
    if (candidate.score === 0 && selected.length >= 10) break;
    selected.push(candidate.chunk);
    length += candidate.chunk.text.length;
  }
  if (!selected.some(chunk => chunk.layer === "原文")) {
    const firstOriginal = available.find(chunk => chunk.layer === "原文");
    if (firstOriginal) selected.unshift(firstOriginal);
  }
  return { chapter, editorial, chunks: selected };
}

export type CrossChapterChunk = ContextChunk & {
  volume: number;
  title: string;
  category: string;
};

export async function retrieveAcrossShiji(
  question: string,
  allowedLayers: ContextChunk["layer"][] = ["原文", "集解", "索隱", "正義"],
) {
  const perChapter = await Promise.all(
    Array.from({ length: 130 }, async (_, index) => {
      const result = await retrieveShijiContext(index + 1, question, allowedLayers);
      return result.chunks.slice(0, 8).map(chunk => ({
        ...chunk,
        id: `v${String(result.chapter.volume).padStart(3, "0")}:${chunk.id}`,
        volume: result.chapter.volume,
        title: result.chapter.title,
        category: result.chapter.category,
      }));
    }),
  );
  const terms = queryTerms(question);
  const ranked = perChapter.flat()
    .map((chunk, index) => ({ chunk, index, score: score(chunk.text, terms) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected: CrossChapterChunk[] = [];
  const volumeCounts = new Map<number, number>();
  let length = 0;
  for (const candidate of ranked) {
    if (selected.length >= 42 || length >= 48_000) break;
    const count = volumeCounts.get(candidate.chunk.volume) || 0;
    if (count >= 4) continue;
    if (candidate.score === 0 && selected.length >= 16) break;
    selected.push(candidate.chunk);
    volumeCounts.set(candidate.chunk.volume, count + 1);
    length += candidate.chunk.text.length;
  }
  return selected;
}
