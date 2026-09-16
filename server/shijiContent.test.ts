import { describe, expect, it } from "vitest";
import { isAuthenticShijiEvidence, loadShijiLayers, retrieveAcrossShiji, retrieveShijiContext } from "./shijiContent";

describe("Shiji layered content", () => {
  it("loads all 130 aligned chapter layers and every table row translation", async () => {
    const volumes = await Promise.all(
      Array.from({ length: 130 }, (_, index) => loadShijiLayers(index + 1)),
    );
    expect(volumes).toHaveLength(130);
    for (const { chapter, scholia, editorial } of volumes) {
      expect(scholia.volume).toBe(chapter.volume);
      expect(editorial.volume).toBe(chapter.volume);
      expect(editorial.title).toBe(chapter.title);
      const textBlocks = chapter.sections.flatMap(section => section.blocks).filter(block => block.type === "text");
      expect(editorial.translations).toHaveLength(textBlocks.length);
      const tableRows = chapter.sections.flatMap(section => section.blocks)
        .filter(block => block.type === "table")
        .reduce((total, block) => total + block.rows.length, 0);
      expect(editorial.tableTranslations || []).toHaveLength(tableRows);
    }
  });

  it("loads aligned scholarly and editorial layers", async () => {
    const { chapter, scholia, editorial } = await loadShijiLayers(1);
    expect(chapter.title).toBe("五帝本紀第一");
    expect(scholia.annotations.length).toBeGreaterThan(100);
    expect(scholia.criticalNotes.length).toBeGreaterThan(0);
    expect(editorial.translations.length).toBe(
      chapter.sections.flatMap(section => section.blocks).filter(block => block.type === "text").length,
    );
  });

  it("retrieves primary text and traditional commentary for a question", async () => {
    const result = await retrieveShijiContext(1, "黃帝為什麼稱為黃帝？");
    expect(result.chunks.some(chunk => chunk.layer === "原文" && chunk.text.includes("土德"))).toBe(true);
    expect(result.chunks.some(chunk => ["集解", "索隱", "正義"].includes(chunk.layer))).toBe(true);
  });

  it("restricts retrieval to the selected traditional commentary source", async () => {
    const result = await retrieveShijiContext(1, "黃帝 土德", ["索隱"]);
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks.every(chunk => chunk.layer === "索隱")).toBe(true);
  });

  it("retrieves grounded evidence across the full 130-chapter corpus", async () => {
    const chunks = await retrieveAcrossShiji("項羽 劉邦 用人 成敗", ["原文", "索隱"]);
    expect(chunks.length).toBeGreaterThan(10);
    expect(new Set(chunks.map(chunk => chunk.volume)).size).toBeGreaterThan(2);
    expect(chunks.every(chunk => ["原文", "索隱"].includes(chunk.layer))).toBe(true);
    expect(chunks.every(chunk => chunk.id.startsWith("v"))).toBe(true);
  }, 30_000);

  it("rejects Wikisource licensing boilerplate as historical evidence", async () => {
    expect(isAuthenticShijiEvidence("此作品在全世界都属于公有领域，因为作者逝世已经超过100年，且作品于1931年1月1日之前出版。")).toBe(false);
    expect(isAuthenticShijiEvidence("eader|title=史記卷四十八|section=陳涉世家第十八 按：勝立數月而死。")).toBe(false);
    expect(isAuthenticShijiEvidence("吳王不聽，遂北伐齊。<span typeof=\"mw:LanguageVariant\" id=\"mwRA\"></span>百牢。")).toBe(false);
    expect(isAuthenticShijiEvidence("太史公曰：法令所以導民也，刑罰所以禁姦也。")).toBe(true);
    const chunks = await retrieveAcrossShiji("選舉 聯盟 政黨 組閣", ["原文", "集解", "索隱", "正義"]);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => isAuthenticShijiEvidence(chunk.text))).toBe(true);
  }, 30_000);
});
