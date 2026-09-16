# 授權說明

## 網站程式碼

除另有標示外，本專案自行撰寫的 React、TypeScript、CSS 與資料轉換程式依根目錄 [`LICENSE`](./LICENSE) 的 MIT License 提供。

Copyright (c) 2026 KuohuaFan and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## 《史記》文本與來源編排

《史記》古籍原文及裴駰《集解》、司馬貞《索隱》、張守節《正義》等古籍內容屬公有領域。`source/shiji-wikisource.epub`、`source/shiji-sanjiazhu-wikisource.epub`，以及由兩者轉換而來的 `client/src/content/chapters/`、`client/src/content/scholia/`，包含維基文庫的編排、標點、校勘與協作貢獻，應依維基文庫頁面所示之 Creative Commons Attribution-ShareAlike 條款使用，並保留來源署名及相同方式分享要求；其他條款依維基文庫當時頁面說明。

來源：<https://zh.wikisource.org/zh-hant/史記>

三家註來源：<https://zh.wikisource.org/zh-hant/史記三家註>

## AI 輔助閱讀內容

`client/src/content/editorial/` 中的白話翻譯、篇旨、歷史脈絡及人物解說，以及 `client/src/content/context/` 的人物關係與年代事件結構，為 `gpt-5-mini` 依本站原文生成的輔助閱讀內容，不是《史記》原文、三家註或維基文庫的校勘成果。人物關係與年代事件雖以程式確認所附引句存在於本篇，仍須人工學術覆核。網站介面已持續揭露其 AI 性質；使用者從事研究、教學或正式引用時，應回查古籍原文與來源頁。

## 人工修訂與讀者提交內容

校訂台保存的人工白話修訂、校訂理由及篇章總評，應由提交者確保有權提供。讀者透過錯誤回報表單提交的修改建議、說明或引文，僅用於本站校勘與品質改進；本站不會在未覆核情況下自動發布。提交者不應填入無權公開的長篇現代譯本內容或不必要的個人資料。

## 事件簿與當代資料

事件簿使用者提交的事件描述、來源標題、網址與摘錄只用於建立可追溯的歷史比較初稿。提交者應使用可合法引用的短摘錄，不應貼入受著作權保護的完整新聞、報告或資料庫內容，也不應輸入不必要的個人資料。外部來源仍受各來源網站自身條款與著作權保護；本站保存來源清單與短摘錄不表示取得其完整內容的再利用授權。

事件簿的《史記》引文依前述古籍與維基文庫條款處理；歷史類比、反例及 30／90／365 日情境由 AI 產生，屬待編輯覆核的研究初稿。只有經管理員覆核並另行發布者才具有「已發布」狀態；即使已發布，也不構成法律意見、投資建議、選舉宣傳或事實預言。

## Logo 與品牌識別

`docs/assets/logo.png`、網站 favicon 及由該圖衍生的尺寸版本是專案擁有者提供的品牌識別資產。它們**不包含在 MIT 程式碼授權內**。未經另行書面授權，不得使用該 Logo 暗示與本專案、KuohuaFan 或正式網站有官方關聯、認可或背書。為執行、fork 或展示本專案所必要的原樣載入，不代表授予獨立商標或再品牌權利。

## 參考網站

本專案沒有複製 `KuohuaFan/Huayan-Sutra` 的原始碼、版面素材或自撰內容。該站僅作為資訊架構與編輯方式的功能參考。
