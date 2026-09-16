import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

const ctx = {
  user: null,
  req: { ip: "127.0.0.20", headers: {}, socket: { remoteAddress: "127.0.0.20" } },
  res: {},
} as unknown as TrpcContext;

const excerpt = "這是一段可由原始文件直接核對的關鍵內容，包含事件的程序狀態、發布日期、作成機關與現階段已知事實，並刻意超過六十個中文字以符合核實門檻。";
const base = {
  title: "重大法制事件的程序發展與制度影響",
  description: "本事件涉及一項仍在進行中的重大法制程序。現階段可確認主管機關已公布正式文件，其他機構則提供獨立報導；部分法律效果、後續程序與政治影響尚未確定，因此只能建立可否證的情境而不是必然預言。",
  jurisdiction: "臺灣",
  eventDate: "2026-09-12",
  category: "法制" as const,
  sourceDisagreement: "",
};

describe("event ledger verification gates", () => {
  it("rejects analysis without a primary source", async () => {
    const caller = appRouter.createCaller(ctx);
    await expect(caller.eventLedger.analyze({
      ...base,
      sources: [
        { title: "獨立報導一", publisher: "媒體甲", publishedAt: "2026-09-12", url: "https://example-one.test/a", kind: "independent", excerpt },
        { title: "獨立報導二", publisher: "媒體乙", publishedAt: "2026-09-12", url: "https://example-two.test/b", kind: "independent", excerpt },
      ],
    })).rejects.toThrow("至少一個來源必須是");
  });

  it("rejects two sources from the same website", async () => {
    const caller = appRouter.createCaller(ctx);
    await expect(caller.eventLedger.analyze({
      ...base,
      sources: [
        { title: "官方公報", publisher: "主管機關", publishedAt: "2026-09-12", url: "https://official.test/a", kind: "primary", excerpt },
        { title: "同站說明", publisher: "主管機關", publishedAt: "2026-09-12", url: "https://official.test/b", kind: "independent", excerpt },
      ],
    })).rejects.toThrow("不同網站或機構");
  });

  it("rejects multiple pages published by the same institution", async () => {
    const caller = appRouter.createCaller(ctx);
    await expect(caller.eventLedger.analyze({
      ...base,
      sources: [
        { title: "官方公報", publisher: "同一主管機關", publishedAt: "2026-09-12", url: "https://official-one.test/a", kind: "primary", excerpt },
        { title: "機關新聞稿", publisher: "同一主管機關", publishedAt: "2026-09-12", url: "https://official-two.test/b", kind: "independent", excerpt },
      ],
    })).rejects.toThrow("不同機構發布");
  });
});
