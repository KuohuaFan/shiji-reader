![《史記》對話工作臺 Logo](docs/assets/logo.png)

# 《史記》對話工作臺

《史記》對話工作臺是一個以繁體中文呈現的開源數位人文專案。它以沉浸式 AI 對話為入口，同時提供《史記》一百三十篇、三家註、逐段白話、校勘、人物關係圖、年代軸與協作校訂功能。

**GitHub Pages：** <https://kuohuafan.github.io/shiji-reader/>

**正式全端網站：** <https://shijiread.manus.space/>

**原始碼：** <https://github.com/KuohuaFan/shiji-reader>

> **內容提醒：** 白話翻譯、篇旨、人物解說、人物關係與年代資料含 AI 輔助初稿。正式研究及引用應回查《史記》原文、三家註與來源頁。事件簿是歷史比較與情境推演工具，不是法律意見、投資建議、選舉宣傳或事實預言。

## 主要功能

首頁採滿版、無訊息氣泡的對話工作臺。左欄保存紀錄、Starred、Projects 與 Artifacts；上方提供章節、古今書庫、事件簿與七道發布閘門；右側以功能抽屜呈現章節、書目、來源與分析；下方輸入列可切換全書或單篇問答、古籍來源與歷史時期。

對話回答使用標點感知的打字機效果。讀者向上閱讀時，智慧捲動會停止追隨並顯示「回到最新對話」。系統支援 `prefers-reduced-motion`，使用者要求降低動態時會直接顯示全文。

完整讀本具有以下六層內容：

1. **原文**：十二本紀、十表、八書、三十世家與七十列傳，共一百三十篇。
2. **白話**：5,015 個正文段落及 1,610 個年表列的對照初稿。
3. **三家註**：裴駰《集解》、司馬貞《索隱》與張守節《正義》，共 14,315 個注釋錨點。
4. **校勘**：來源頁附有的校勘記與註腳。
5. **導讀**：篇旨、內容概述、歷史脈絡、閱讀主題與人物解說。
6. **脈絡**：1,897 個人物節點、1,493 條關係與 1,310 個事件；每項均保留本篇原文依據。

讀本另有全文檢索、前後篇切換、書籤、讀札、夜讀、字級、寬幅閱讀、中文語音朗讀、人物搜尋及年代篩選。

## 事件簿：歷史教訓與情境推演

事件簿只接受通過來源閘門的題目。每個事件至少需要兩個不同網站且不同發布機構的來源，其中至少一個必須是一手文件。分析會跨一百三十篇《史記》原文與三家註尋找可回查的證據，並輸出 30、90 與 365 日三種情境。

七道閘門分別檢查**當代事實、史記證據、類比邊界、情境推演、可追溯性、事後驗證、法律政治揭露**。每個情境都包含機率區間、先行指標、失效條件與預先結果判準。系統保存來源快照、分析時間、模型版本、提示摘要與 SHA-256 雜湊；狀態依序為 `AI 初稿 → 編輯覆核 → 已發布`。已發布預測不可回寫，只能另外登錄實際結果與 Brier score。

完整規則見 [事件簿核實及發布準則](EVENT_LEDGER_POLICY.md)。

## 人工學術校訂與讀者回報

讀者可在每篇側欄針對原文或白話提交修改建議。系統產生 `SJ-XXXXXXXXXXXX` 回報編號，供讀者查詢處理狀態。只有管理員能在 `/review` 校訂台核准白話覆寫、更新篇章狀態、處理讀者回報及覆核事件簿。

本站不把 AI 檢查冒充真人校訂。新篇章預設為「待人工校訂」，必須由真人逐段覆核並主動簽核，才能顯示「已人工覆核」。流程詳見 [白話翻譯人工學術校訂準則](HUMAN_REVIEW_POLICY.md)。

## GitHub Pages 與正式網站的功能邊界

GitHub Pages 只能託管靜態檔案，不能執行 Express、tRPC、資料庫或保管模型金鑰。因此本專案採用**靜態前端與正式 API 分離**的方式部署。

| 功能 | GitHub Pages | 正式全端網站 |
| --- | --- | --- |
| 一百三十篇原文與六層內容 | 完整支援 | 完整支援 |
| 全文檢索、書籤、讀札、視覺化 | 完整支援 | 完整支援 |
| AI 問答與事件簿初稿 | 導向正式網站 | 由同站後端處理 |
| 錯誤回報與狀態查詢 | 導向正式網站 | 由同站後端及資料庫處理 |
| `/review` 管理校訂台 | 導向正式網站 | 完整支援 |
| 資料庫與模型密鑰 | 不存在於 Pages | 僅在伺服器環境 |

GitHub Pages 不會在背景對正式 API 發送資料。使用者主動送出問答、事件簿或校勘回報時，介面會先導向正式全端網站；原文、白話、三家註、校勘、導讀、人物圖、年代軸及本機閱讀工具則可在 Pages 獨立使用。請勿把任何 API 金鑰寫入 `VITE_*` 變數，因為這些變數會進入瀏覽器程式碼。

## 技術架構

前端使用 React 19、TypeScript、Vite 7 與 Tailwind CSS 4。後端使用 Express 4 與 tRPC 11。資料層使用 Drizzle ORM 與 MySQL。正式後端透過伺服器環境呼叫模型；瀏覽器不接觸模型密鑰。

主要目錄如下：

```text
client/src/components/       對話工作臺、讀本、視覺化、回報介面
client/src/content/          一百三十篇分層 JSON 資料
server/                      tRPC、AI 檢索、校訂與事件簿後端
drizzle/                     資料表與非破壞性遷移
scripts/                     匯入、生成、驗證與 E2E 測試
docs/assets/logo.png         公開 README 使用的專案 Logo
research/                    事件簿來源查核紀錄
```

## 本機開發

需要 Node.js 22、pnpm 10 與 Python 3.11。

```bash
git clone https://github.com/KuohuaFan/shiji-reader.git
cd shiji-reader
pnpm install
pnpm dev
```

純前端頁面與分層文本不需要資料庫。AI、讀者回報、校訂台與事件簿需要 `DATABASE_URL`、OAuth 與模型服務等伺服器環境變數。請只在本機秘密管理工具或部署平台設定，不要提交 `.env`。所有 `VITE_*` 變數都會進入瀏覽器程式碼，因此不得存放秘密。

常用驗證命令：

```bash
python3 scripts/validate_content.py
python3 scripts/validate_layers.py
python3 scripts/validate_context.py
pnpm check
pnpm test
pnpm build
pnpm build:pages
```

涉及真實模型或資料庫的測試會使用既有伺服器環境，且測試腳本在完成後清理測試資料：

```bash
pnpm exec tsx scripts/test_ai.ts
pnpm exec tsx scripts/test_editorial_api.ts
pnpm exec tsx scripts/test_event_ledger.ts
pnpm exec tsx scripts/test_event_ledger_workflow.ts
```

## GitHub Pages 發布

`scripts/deploy_pages.sh` 會依序安裝鎖定依賴、執行型別檢查與單元測試、建置 `/shiji-reader/` 子路徑，然後只把靜態產物推送到 `gh-pages` 分支。這種方式不把伺服器密鑰或資料庫放入 Pages，也不需要 GitHub Actions workflow 寫入權限。`scripts/prepare_pages.py` 會建立 `404.html` fallback、`.nojekyll`、Pages 專用 sitemap 與 robots 設定。

手動重現 Pages 產物：

```bash
pnpm install --frozen-lockfile
pnpm build:pages
python3 -m http.server 4173 --directory dist/public
```

本機直接開啟 `http://127.0.0.1:4173/shiji-reader/` 時，需由具備相同子路徑的伺服器提供；GitHub Pages 會自動提供此路徑。

有 `github` Git remote 的維護者可直接發布：

```bash
bash scripts/deploy_pages.sh github
```

## 內容編輯與資料驗證

| 路徑 | 用途 | 編輯原則 |
| --- | --- | --- |
| `client/src/content/chapters/` | 原文、分節與表格 | 由 EPUB 匯入器生成；人工改動前先建立版本 |
| `client/src/content/scholia/` | 三家註、錨點與校勘 | 保持注家、錨點和原文對應 |
| `client/src/content/editorial/` | 白話、篇旨與人物解說 | AI 初稿，應由真人校訂 |
| `client/src/content/context/` | 人物、關係與年代事件 | 每條關係與事件必須保留原文證據 |
| `scripts/import_epub.py` | 重建原文資料 | 來源快照更新後執行 |
| `scripts/import_layers.py` | 重建三家註與校勘 | 全部成功後才原子替換輸出 |
| `scripts/validate_*.py` | 驗證篇數、索引、表格及證據 | 每次內容發布前執行 |

重新匯入可能覆寫生成層。若直接修改 JSON，請先提交版本，或將真人修訂保存為獨立補丁與資料庫覆寫。

## 開源、內容授權與 Logo

專案自行撰寫的程式碼依 [MIT License](LICENSE) 開源。《史記》原文與三家古注屬公有領域；維基文庫所加的編排、標點、校勘及協作內容依來源頁授權處理。[1] [2]

AI 輔助內容、讀者提交、事件簿摘錄與專案 Logo 不應被一概視為 MIT 程式碼。Logo 是專案識別資產，未經另行授權不得暗示官方背書或混淆來源。完整分層條款見 [LICENSES.md](LICENSES.md)。

## 貢獻與安全

提交程式或內容修正前，請閱讀 [CONTRIBUTING.md](CONTRIBUTING.md)。安全漏洞請依 [SECURITY.md](SECURITY.md) 私下回報，不要先公開包含利用細節的 issue。一般原文、標點、白話或註釋問題可使用站內「錯誤回報」或 GitHub issue。

## References

[1]: https://zh.wikisource.org/zh-hant/史記 "維基文庫《史記》"
[2]: https://zh.wikisource.org/zh-hant/史記三家註 "維基文庫《史記三家註》"
[3]: https://kuohuafan.github.io/Huayan-Sutra/ "《華嚴經》參考網站"
