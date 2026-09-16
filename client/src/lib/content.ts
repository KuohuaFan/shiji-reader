import manifestData from "@/content/manifest.json";
import type { Chapter, ShijiManifest } from "@/types/content";

export const manifest = manifestData as ShijiManifest;

const chapterModules = import.meta.glob<{ default: Chapter }>(
  "../content/chapters/*.json",
);

const chapterCache = new Map<number, Chapter>();

export async function loadChapter(volume: number): Promise<Chapter> {
  if (chapterCache.has(volume)) return chapterCache.get(volume)!;
  const key = `../content/chapters/${String(volume).padStart(3, "0")}.json`;
  const loader = chapterModules[key];
  if (!loader) throw new Error(`找不到卷 ${volume} 的文本資料`);
  const module = await loader();
  chapterCache.set(volume, module.default);
  return module.default;
}

export async function loadAllChapters(): Promise<Chapter[]> {
  return Promise.all(
    Array.from({ length: manifest.chapterCount }, (_, index) =>
      loadChapter(index + 1),
    ),
  );
}

export function chapterPlainText(chapter: Chapter): string {
  return chapter.sections
    .flatMap((section) => [
      section.heading,
      ...section.blocks.map((block) =>
        block.type === "text"
          ? block.text
          : block.rows.map((row) => row.join("｜")).join("\n"),
      ),
    ])
    .filter(Boolean)
    .join("\n");
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-Hant").format(value);
}
