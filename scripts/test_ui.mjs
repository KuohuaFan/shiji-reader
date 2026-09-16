import { chromium } from "playwright-core";

const baseUrl = process.env.TEST_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const results = [];
function pass(name, details = "") {
  results.push({ name, status: "ok", details });
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("Failed to load resource")) {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(`${baseUrl}/about`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("shiji:workbench-sessions", JSON.stringify([{
    id: "returning-session", title: "卷24舊對話", updatedAt: Date.now(), starred: true, project: "通古今", volume: 24, mode: "chat",
    messages: [{ id: "returning-message", role: "user", kind: "chat", content: "這是先前保存的對話內容" }],
  }])));
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "以古鑑今，先問證據" }).waitFor();
  await page.getByText("紀錄", { exact: true }).waitFor();
  await page.getByText("Starred", { exact: true }).waitFor();
  await page.getByText("Projects", { exact: true }).waitFor();
  await page.getByText("Artifacts", { exact: true }).waitFor();
  pass("滿版無氣泡對話入口");

  await page.getByRole("button", { name: /卷24舊對話/ }).first().click();
  await page.getByText("這是先前保存的對話內容", { exact: true }).waitFor();
  await page.getByRole("button", { name: "回到工作臺首頁" }).click();
  await page.getByRole("heading", { name: "以古鑑今，先問證據" }).waitFor();
  if (await page.getByRole("button", { name: /卷24舊對話/ }).count() < 1) throw new Error("返回首頁後舊紀錄遺失");
  pass("回訪首頁與舊紀錄分離");

  await page.getByRole("button", { name: "章節", exact: true }).click();
  await page.getByRole("heading", { name: "一百三十篇" }).waitFor();
  await page.getByLabel("搜尋章節").fill("項羽本紀");
  await page.getByRole("button", { name: /項羽本紀第七/ }).first().click();
  await page.getByText("卷7", { exact: true }).waitFor();
  pass("上方章節與右側抽屜");

  await page.getByRole("button", { name: "古今書庫", exact: true }).click();
  await page.getByRole("heading", { name: "古今解釋《史記》的書" }).waitFor();
  await page.getByRole("button", { name: /《史記索隱》/ }).click();
  await page.getByText("問答來源已限定為《史記索隱》").waitFor();
  pass("古今書庫與來源限定");

  await page.route("**/api/trpc/shiji.ask?**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([{ result: { data: { json: {
      answer: "項羽勇而少謀，能得士卒一時之死力，卻未能長久信任並任用賢才。劉邦則能納諫、任將並分配權責。這段測試回答刻意保留足夠長度，用來確認文字會逐步顯現，而且讀者可隨時選擇顯示全文。".repeat(12),
      confidence: "高",
      citations: [{ id: "v007:s-1-0", layer: "索隱", section: "卷7 · 項羽本紀第七 · 注釋1", quote: "索隱述項氏世系及楚將之後。" }],
    } } } }]),
  }));
  const workbenchInput = page.getByLabel("輸入史記問題");
  await workbenchInput.fill("項羽在用人上有何得失？");
  await page.getByRole("button", { name: "送出史記問題" }).click();
  await page.locator(".workbench-message.assistant.typing").waitFor({ timeout: 120000 });
  const skipTyping = page.getByRole("button", { name: "顯示全文" });
  await skipTyping.waitFor();
  const skipped = await page.evaluate(() => {
    const button = document.querySelector(".typewriter-skip");
    button?.click();
    return Boolean(button);
  });
  if (!skipped) throw new Error("打字機未提供顯示全文控制");
  await page.locator(".workbench-message.assistant.typing").waitFor({ state: "detached" });
  await page.locator(".workbench-message.assistant details").waitFor();
  pass("工作臺打字機與立即顯示全文");

  const motionContext = await browser.newContext({ viewport: { width: 1100, height: 720 } });
  const motionPage = await motionContext.newPage();
  await motionPage.goto(`${baseUrl}/about`, { waitUntil: "networkidle" });
  await motionPage.evaluate(() => localStorage.setItem("shiji:workbench-sessions", JSON.stringify([{
    id: "scroll-test", title: "長對話捲動測試", updatedAt: Date.now(), starred: false, project: "通古今", volume: 1, mode: "chat",
    messages: Array.from({ length: 24 }, (_, index) => ({ id: `scroll-${index}`, role: index % 2 ? "assistant" : "user", kind: "chat", content: `${index + 1}｜${"史記對話內容。".repeat(22)}` })),
  }])));
  await motionPage.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await motionPage.getByRole("button", { name: /長對話捲動測試/ }).first().click();
  await motionPage.getByText("24｜", { exact: false }).waitFor();
  await motionPage.locator(".workspace-conversation").evaluate(node => { node.scrollTop = 0; node.dispatchEvent(new Event("scroll")); });
  await motionPage.getByRole("button", { name: "回到最新對話" }).waitFor();
  await motionPage.getByRole("button", { name: "回到最新對話" }).click();
  await motionPage.waitForFunction(() => {
    const node = document.querySelector(".workspace-conversation");
    return node && node.scrollHeight - node.scrollTop - node.clientHeight < 100;
  });
  pass("智慧平滑捲動與閱讀位置保護");
  await motionContext.close();

  const reducedContext = await browser.newContext({ viewport: { width: 1100, height: 720 }, reducedMotion: "reduce" });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  const reducedMotionState = await reducedPage.evaluate(() => ({
    matches: matchMedia("(prefers-reduced-motion: reduce)").matches,
    scrollBehavior: getComputedStyle(document.querySelector(".workspace-conversation")).scrollBehavior,
    duration: getComputedStyle(document.querySelector(".brand-logo--hero")).animationDuration,
  }));
  if (!reducedMotionState.matches || reducedMotionState.scrollBehavior !== "auto") throw new Error(`降低動態未生效：${JSON.stringify(reducedMotionState)}`);
  pass("降低動態偏好", JSON.stringify(reducedMotionState));
  await reducedContext.close();

  await page.getByRole("button", { name: "當代事實", exact: true }).click();
  await page.getByText("尚無事件簿分析", { exact: false }).waitFor();
  await page.getByRole("button", { name: "事件簿", exact: true }).first().click();
  await page.getByRole("heading", { name: "建立事件簿" }).waitFor();
  await page.getByText("每日自動事件雷達已啟用", { exact: false }).waitFor();
  await page.getByText("當代來源 · 至少兩個", { exact: true }).waitFor();
  if (await page.locator(".event-source").count() !== 2) throw new Error("事件簿未提供兩個預設來源欄位");
  pass("七道閘門與事件簿表單");

  await page.goto(`${baseUrl}/about`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("shiji:workbench-sessions", JSON.stringify([{
    id: "e2e-artifact", title: "核實事件簿", updatedAt: Date.now(), starred: true, project: "事件簿研究", volume: 0, mode: "event",
    messages: [{ id: "m1", role: "assistant", kind: "event", content: "歷史教訓測試" }],
    artifact: {
      verifiedFacts: [{ claim: "官方文件已發布。", sourceIndexes: [1, 2] }], disputedFacts: ["後續效果尚未確定。"], lesson: "制度效果仍取決於落實。",
      analogy: { citationIds: ["v001:o-1-0", "v008:o-1-0"], similarities: ["均涉及制度調整", "均需程序配套"], differences: ["主權結構不同", "技術條件不同"], counterexample: "存在不經相同歷史路徑而完成改革的制度。" },
      forecasts: [30, 90, 365].map(days => ({ horizonDays: days, proposition: `${days}日內出現可觀察程序`, probability: 60, leadingIndicators: ["正式公告", "程序排程"], invalidationConditions: ["程序中止"], resolutionCriteria: "期限內官方網站是否公布該程序。" })),
      legalPoliticalDisclosure: "這是歷史比較研究，不是法律意見或事實預言。",
      citations: [{ id: "v001:o-1-0", volume: 1, title: "五帝本紀第一", layer: "原文", section: "正文", quote: "黃帝者，少典之子。" }, { id: "v008:o-1-0", volume: 8, title: "高祖本紀第八", layer: "原文", section: "正文", quote: "高祖，沛豐邑中陽里人。" }],
      audit: { status: "AI初稿", analyzedAt: new Date().toISOString(), model: "gpt-5", jurisdiction: "臺灣", eventDate: "2026-09-12", promptSummary: "測試", promptHash: "a".repeat(64), sourceSnapshotHash: "b".repeat(64), sourceCount: 2, primarySourceCount: 1 },
      sources: [{ index: 1, title: "官方", url: "https://official.test", publisher: "機關", publishedAt: "2026-09-12", kind: "primary", excerpt: "測試" }, { index: 2, title: "報導", url: "https://news.test", publisher: "媒體", publishedAt: "2026-09-12", kind: "independent", excerpt: "測試" }]
    }
  }])));
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /核實事件簿/ }).last().click();
  await page.getByRole("button", { name: "當代事實", exact: true }).click();
  await page.getByText("官方文件已發布。", { exact: false }).waitFor();
  await page.getByRole("button", { name: "情境推演", exact: true }).click();
  await page.getByText("30 日", { exact: true }).waitFor();
  await page.getByRole("button", { name: "事後驗證", exact: true }).click();
  await page.getByRole("button", { name: "本機試算：已發生", exact: true }).first().click();
  await page.getByText("Brier score：0.160", { exact: false }).waitFor();
  pass("事件簿核實檔案與Brier事後驗證");

  await page.goto(`${baseUrl}/?chapter=1`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "五帝本紀第一", exact: true }).waitFor();
  await page.getByText("黃帝者，少典之子", { exact: false }).waitFor();
  pass("首篇載入", await page.title());

  await page.getByRole("tab", { name: "白話" }).click();
  await page.getByText("AI 輔助白話翻譯", { exact: false }).waitFor();
  await page.getByText("黃帝是少典的兒子", { exact: false }).waitFor();
  pass("逐段白話翻譯");

  await page.getByRole("tab", { name: /三家註/ }).click();
  await page.locator(".scholium-note.集解").first().waitFor();
  await page.locator(".scholium-note.索隱").first().waitFor();
  await page.locator(".scholium-note.正義").first().waitFor();
  pass("三家註分層顯示");

  await page.getByRole("tab", { name: /校勘/ }).click();
  await page.locator(".critical-card").first().waitFor();
  pass("校勘記與註腳");

  await page.getByRole("tab", { name: "導讀" }).click();
  await page.getByText("主要人物", { exact: true }).waitFor();
  await page.getByText("黃帝", { exact: true }).first().waitFor();
  pass("篇旨與人物解說");

  await page.getByRole("tab", { name: "脈絡" }).click();
  await page.locator(".person-node").first().waitFor();
  const personCount = await page.locator(".person-node").count();
  if (personCount < 2) throw new Error("人物關係圖節點不足");
  pass("互動人物關係圖", `${personCount} 個人物節點`);
  await page.getByRole("tab", { name: "互動年代軸" }).click();
  await page.locator(".timeline-event").first().waitFor();
  pass("互動年代軸", `${await page.locator(".timeline-event").count()} 個事件`);

  await page.getByRole("tab", { name: "原文" }).click();

  await page.getByRole("button", { name: "檢索", exact: true }).first().click();
  await page.getByRole("dialog", { name: "全文檢索" }).waitFor();
  const searchInput = page.getByPlaceholder("輸入人物、地名或詞句");
  await searchInput.fill("項羽");
  await searchInput.press("Enter");
  await page.locator(".search-results > button").first().waitFor({ timeout: 15000 });
  const resultCount = await page.locator(".search-results > button").count();
  if (resultCount < 1) throw new Error("全文檢索沒有結果");
  pass("全文檢索", `${resultCount} 篇結果`);
  await page.locator(".search-results > button").first().click();
  await page.locator(".search-context").waitFor();
  pass("檢索跳轉與標示", page.url());

  await page.getByRole("button", { name: "書籤", exact: true }).first().click();
  const bookmarks = await page.evaluate(() => localStorage.getItem("shiji:bookmarks"));
  if (!bookmarks || bookmarks === "[]") throw new Error("書籤未寫入 localStorage");
  pass("本機書籤", bookmarks);

  await page.getByRole("button", { name: "閱讀設定" }).click();
  await page.getByRole("heading", { name: "調整版面" }).waitFor();
  await page.locator(".setting-row").filter({ hasText: "夜讀模式" }).locator("button").click();
  if (!(await page.locator(".reader-shell").getAttribute("class"))?.includes("night")) {
    throw new Error("夜讀模式未套用");
  }
  pass("夜讀模式");
  await page.getByRole("dialog", { name: "閱讀設定" }).locator("button").first().click();

  await page.goto(`${baseUrl}/?chapter=1`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "五帝本紀第一", exact: true }).waitFor();
  await page.getByRole("button", { name: "問答", exact: true }).click();
  const aiDialog = page.getByRole("dialog", { name: "史記 AI 問答" });
  await aiDialog.waitFor();
  await aiDialog.getByRole("button", { name: "原文", exact: true }).click();
  await aiDialog.getByRole("button", { name: "集解", exact: true }).click();
  await aiDialog.getByRole("button", { name: "正義", exact: true }).click();
  await aiDialog.getByLabel("特定歷史時期").selectOption("上古與五帝");
  await page.getByPlaceholder("例如：司馬遷如何評價項羽？").fill("黃帝為什麼稱為黃帝？");
  await aiDialog.getByRole("button", { name: "送出問題" }).click();
  await page.locator(".ai-message.assistant").waitFor({ timeout: 120000 });
  await page.locator(".ai-citations").waitFor();
  await page.locator(".ai-citations summary").click();
  const citationLabels = await page.locator(".ai-citations blockquote b").allTextContents();
  if (!citationLabels.some(label => label.includes("索隱")) || citationLabels.some(label => ["集解", "正義", "原文"].some(source => label.includes(`〔${source}〕`)))) throw new Error(`AI 未遵守指定注家篩選：${citationLabels.join("、")}`);
  pass("AI 注家與時期篩選", "只引用索隱，限定上古與五帝");
  await aiDialog.getByRole("button", { name: "關閉 AI 問答" }).click();

  await page.getByRole("tab", { name: "原文" }).click();
  await page.locator(".chapter-body p").first().evaluate(element => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.getByRole("button", { name: "回報", exact: true }).click();
  const reportDialog = page.getByRole("dialog", { name: "錯誤回報" });
  await reportDialog.waitFor();
  const selectedQuote = await reportDialog.getByLabel("原句或選取文字").inputValue();
  if (!selectedQuote.includes("黃帝")) throw new Error("錯誤回報未帶入選取文字");
  await reportDialog.getByLabel("修改建議*").fill("瀏覽器端到端測試建議，不實際送出。");
  pass("側欄錯誤回報表單", "已帶入選取原句與段落位置");
  await reportDialog.getByRole("button", { name: "關閉錯誤回報" }).click();

  await page.getByRole("button", { name: "讀札", exact: true }).click();
  await page.getByRole("dialog", { name: "讀札" }).waitFor();
  await page.getByPlaceholder("記下人物關係、年代疑問或閱讀心得……").fill("端到端測試讀札");
  const notes = await page.evaluate(() => localStorage.getItem("shiji:notes"));
  if (!notes?.includes("端到端測試讀札")) throw new Error("讀札未自動儲存");
  pass("本機讀札");

  await page.goto(`${baseUrl}/?chapter=13`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "三代世表第一", exact: true }).waitFor();
  const tables = await page.locator(".chapter-table").count();
  if (tables < 1) throw new Error("表類篇章未顯示表格");
  pass("年表顯示", `${tables} 個表格`);

  await page.goto(`${baseUrl}/?chapter=17`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "白話" }).click();
  await page.getByText("年表已逐格轉為白話", { exact: false }).first().waitFor();
  if (await page.getByText("本表逐格白話尚未完成", { exact: false }).count()) {
    throw new Error("卷十七仍落回原表");
  }
  pass("十表逐格白話");

  await page.goto(`${baseUrl}/?chapter=21`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /三家註/ }).click();
  await page.getByText("本卷維基文庫三家註來源沒有可顯示的注釋。", { exact: true }).waitFor();
  pass("來源無注透明標示");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await mobile.getByRole("heading", { name: "以古鑑今，先問證據" }).waitFor();
  await mobile.getByRole("button", { name: "開啟左側抽屜" }).click();
  await mobile.getByRole("button", { name: "收合左側抽屜" }).waitFor();
  await mobile.getByRole("button", { name: "收合左側抽屜" }).click();
  await mobile.getByRole("button", { name: "開啟左側抽屜" }).waitFor();
  pass("手機滿版對話與功能抽屜");
  await mobile.goto(`${baseUrl}/?chapter=1`, { waitUntil: "networkidle" });
  const menu = mobile.getByRole("button", { name: "開啟目錄" });
  await menu.waitFor();
  await menu.click();
  await mobile.locator(".toc-panel.mobile-open").waitFor();
  pass("手機目錄抽屜");
  const bottomToolsVisible = await mobile.locator(".tool-rail").isVisible();
  if (!bottomToolsVisible) throw new Error("手機底部工具列未顯示");
  pass("手機底部工具列");
  await mobile.close();

  const reviewPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await reviewPage.goto(`${baseUrl}/review`, { waitUntil: "networkidle" });
  await reviewPage.getByRole("heading", { name: "人工學術校訂台" }).waitFor();
  await reviewPage.getByRole("button", { name: "登入校訂" }).waitFor();
  pass("校訂台登入閘門");
  await reviewPage.close();

  if (errors.length) throw new Error(`瀏覽器錯誤：${errors.join(" | ")}`);
  pass("瀏覽器主控台", "無錯誤");

  console.log(JSON.stringify({ status: "ok", checks: results }, null, 2));
} finally {
  await browser.close();
}
