import { appRouter } from "../server/routers";
import { eq } from "drizzle-orm";
import { eventLedgerAnalyses } from "../drizzle/schema";
import { getDb } from "../server/db";

const caller = appRouter.createCaller({
  req: { ip: "127.0.0.31", headers: {}, socket: { remoteAddress: "127.0.0.31" } },
  res: {},
  user: null,
} as never);

const result = await caller.eventLedger.analyze({
  title: "憲法法庭限縮死刑適用並要求強化刑事程序保障",
  description: "憲法法庭於2024年9月20日作成113年憲判字第8號判決，認為死刑在犯罪情節屬最嚴重、且程序符合憲法最嚴密正當法律程序時，於該範圍內尚屬合憲；判決同時要求偵查、第三審、合議庭一致決與精神障礙被告保障等制度調整。這是已發生且已結案的法制事件，本測試只驗證情境推演結構，不作當代案件法律意見。",
  jurisdiction: "臺灣",
  eventDate: "2024-09-20",
  category: "法制",
  sourceDisagreement: "社會與倡議團體對判決是否足以保障生命權有不同評價；判決主文及程序要求本身則以官方裁判為準。",
  sources: [
    {
      title: "113年憲判字第8號【死刑案】",
      publisher: "司法院憲法法庭",
      publishedAt: "2024-09-20",
      url: "https://cons.judicial.gov.tw/docdata.aspx?fid=38&id=351689",
      kind: "primary",
      excerpt: "刑法規定以死刑為最重本刑部分，僅得適用於個案犯罪情節屬最嚴重，且其刑事程序符合憲法最嚴密之正當法律程序要求之情形。判決並要求辯護人在場、第三審強制辯護及言詞辯論、科處死刑應經合議庭法官一致決，並命有關機關於判決宣示日起二年內依判決意旨修法。",
    },
    {
      title: "死刑釋憲案 憲法法庭：有條件合憲",
      publisher: "中央通訊社",
      publishedAt: "2024-09-20T15:22:00+08:00",
      url: "https://www.cna.com.tw/news/asoc/202409205006.aspx",
      kind: "independent",
      excerpt: "中央社報導，憲法法庭作成113年憲判字第8號判決，刑法以死刑為最重本刑部分，僅適用犯罪情節屬最嚴重，且刑事程序符合憲法最嚴密正當法律程序要求的情形合憲。報導並記載王信福等37名死囚聲請法規範憲法審查，憲法法庭曾舉行言詞辯論後宣示判決。",
    },
  ],
});

if (result.audit.status !== "AI初稿") throw new Error("事件簿未標示AI初稿");
if (result.audit.sourceCount !== 2 || result.audit.primarySourceCount !== 1) throw new Error("來源稽核數量錯誤");
if (result.citations.length < 2 || result.citations.some(item => !item.title || !item.quote || !item.id)) throw new Error("史記引用不足或不可追溯");
if (![30, 90, 365].every(days => result.forecasts.some(item => item.horizonDays === days))) throw new Error("缺少30、90或365日情境");
if (!result.analogy.counterexample || result.analogy.differences.length < 2) throw new Error("類比邊界不完整");
if (!/^[a-f0-9]{64}$/.test(result.audit.sourceSnapshotHash) || !/^[a-f0-9]{64}$/.test(result.audit.promptHash)) throw new Error("稽核雜湊格式錯誤");
console.log(JSON.stringify({
  status: "ok",
  audit: result.audit,
  lesson: result.lesson,
  citations: result.citations.map(item => ({ id: item.id, title: item.title, layer: item.layer })),
  horizons: result.forecasts.map(item => ({ days: item.horizonDays, probability: item.probability, hasResolutionCriteria: Boolean(item.resolutionCriteria) })),
  differences: result.analogy.differences.length,
  hasCounterexample: Boolean(result.analogy.counterexample),
}, null, 2));
const db = await getDb();
if (db) await db.delete(eventLedgerAnalyses).where(eq(eventLedgerAnalyses.artifactCode, result.audit.artifactCode));
process.exit(0);
