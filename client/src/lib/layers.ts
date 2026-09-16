import type { ChapterContext, EditorialLayer, ScholarlyLayer } from "@/types/content";

const scholiaModules = import.meta.glob<{ default: ScholarlyLayer }>(
  "../content/scholia/*.json",
);
const editorialModules = import.meta.glob<{ default: EditorialLayer }>(
  "../content/editorial/*.json",
);
const contextModules = import.meta.glob<{ default: ChapterContext }>(
  "../content/context/*.json",
);

const scholiaCache = new Map<number, ScholarlyLayer>();
const editorialCache = new Map<number, EditorialLayer>();
const contextCache = new Map<number, ChapterContext>();

export async function loadScholia(volume: number): Promise<ScholarlyLayer> {
  if (scholiaCache.has(volume)) return scholiaCache.get(volume)!;
  const key = `../content/scholia/${String(volume).padStart(3, "0")}.json`;
  const loader = scholiaModules[key];
  if (!loader) throw new Error(`找不到卷 ${volume} 的三家註資料`);
  const data = (await loader()).default;
  scholiaCache.set(volume, data);
  return data;
}

export async function loadEditorial(volume: number): Promise<EditorialLayer> {
  if (editorialCache.has(volume)) return editorialCache.get(volume)!;
  const key = `../content/editorial/${String(volume).padStart(3, "0")}.json`;
  const loader = editorialModules[key];
  if (!loader) throw new Error(`卷 ${volume} 的白話導讀正在整理`);
  const data = (await loader()).default;
  editorialCache.set(volume, data);
  return data;
}

export async function loadContext(volume: number): Promise<ChapterContext> {
  if (contextCache.has(volume)) return contextCache.get(volume)!;
  const key = `../content/context/${String(volume).padStart(3, "0")}.json`;
  const loader = contextModules[key];
  if (!loader) throw new Error(`卷 ${volume} 的人物與年代資料正在整理`);
  const data = (await loader()).default;
  contextCache.set(volume, data);
  return data;
}
