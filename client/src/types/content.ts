export type TextBlock = {
  type: "text";
  text: string;
};

export type TableBlock = {
  type: "table";
  rows: string[][];
};

export type ContentBlock = TextBlock | TableBlock;

export interface ChapterSection {
  heading: string;
  blocks: ContentBlock[];
}

export interface ChapterMeta {
  id: string;
  volume: number;
  volumeLabel: string;
  title: string;
  category: "本紀" | "表" | "書" | "世家" | "列傳";
  categoryIndex: number;
  categoryDescription: string;
  charCount: number;
  sourceUrl: string;
}

export interface Chapter extends ChapterMeta {
  sections: ChapterSection[];
}

export type ScholiumSource = "集解" | "索隱" | "正義";

export interface ScholiumEntry {
  id: string;
  section: string;
  anchor: string;
  notes: Array<{ source: ScholiumSource; text: string }>;
}

export interface CriticalNote {
  id: string;
  number: number;
  anchor: string;
  text: string;
}

export interface ScholarlyLayer {
  id: string;
  volume: number;
  sanjiazhuSourceUrl: string;
  originalSourceUrl: string;
  annotations: ScholiumEntry[];
  criticalNotes: CriticalNote[];
}

export interface EditorialPerson {
  name: string;
  role: string;
  significance: string;
}

export interface EditorialLayer {
  id: string;
  volume: number;
  title: string;
  model: string;
  generatedAt: string;
  editorialNotice: string;
  purpose: string;
  overview: string;
  historicalContext: string;
  themes: string[];
  people: EditorialPerson[];
  translations: Array<{ sectionIndex: number; blockIndex: number; text: string }>;
  tableTranslations?: Array<{
    sectionIndex: number;
    blockIndex: number;
    rowIndex: number;
    cells: string[];
  }>;
  tableTranslationMethod?: string;
}

export interface ContextPerson {
  id: string;
  name: string;
  role: string;
  group: string;
  summary: string;
}

export interface ContextRelationship {
  id: string;
  source: string;
  target: string;
  type: "親屬" | "君臣" | "盟友" | "對立" | "師友" | "繼承" | "其他";
  label: string;
  evidence: string;
}

export interface ContextEvent {
  id: string;
  year: number;
  yearLabel: string;
  title: string;
  description: string;
  people: string[];
  type: "即位" | "戰爭" | "封建" | "政治" | "制度" | "遷徙" | "出生" | "逝世" | "其他";
  evidence: string;
}

export interface ChapterContext {
  id: string;
  volume: number;
  title: string;
  model: string;
  reviewStatus: string;
  period: { label: string; startYear: number; endYear: number };
  people: ContextPerson[];
  relationships: ContextRelationship[];
  events: ContextEvent[];
}

export interface TranslationRevision {
  sectionIndex: number;
  blockIndex: number;
  revisedTranslation: string;
  rationale?: string | null;
  reviewerName?: string | null;
  updatedAt: number;
}

export interface CategoryMeta {
  name: ChapterMeta["category"];
  start: number;
  end: number;
  count: number;
  description: string;
}

export interface ShijiManifest {
  title: string;
  author: string;
  version: string;
  source: string;
  sourceUrl: string;
  sourceLicense: string;
  importedAt: string;
  chapterCount: number;
  totalChars: number;
  categories: CategoryMeta[];
  chapters: ChapterMeta[];
}
