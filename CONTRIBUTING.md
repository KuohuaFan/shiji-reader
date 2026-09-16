# 貢獻指南

感謝協助改進《史記》對話工作臺。提交前請先確認修改屬於程式、史籍資料、AI 輔助內容或學術校訂，因為四類內容的證據與審查要求不同。

## 建立分支與驗證

請從 `main` 建立短期分支，保持提交訊息具體。送出 Pull Request 前至少執行：

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build:pages
```

修改原文、三家註、白話或人物年代資料時，另須執行：

```bash
python3 scripts/validate_content.py
python3 scripts/validate_layers.py
python3 scripts/validate_context.py
```

## 史籍與白話修訂

原文、標點、三家註或校勘修正必須提供可查證版本、卷次與原句。白話修訂應忠於句法、人物關係、制度語境與年代，並說明修改理由。不得把 AI 生成結果標示為真人學術校訂。

請勿提交無權公開的現代譯本、大段新聞全文、個人資料、API 金鑰或資料庫憑證。事件簿來源只能保存必要的短摘錄，且必須符合 [EVENT_LEDGER_POLICY.md](EVENT_LEDGER_POLICY.md)。

## Pull Request 說明

請說明問題、修改範圍、驗證命令及結果。涉及介面者應附桌機與手機截圖；涉及資料格式者應說明向後相容性。大型重構請先建立 issue 討論，以免和既有匯入或校訂流程衝突。

## 授權

提交程式碼即表示您有權依 MIT License 提供該貢獻。文本、編排、標點、註釋、Logo 與第三方資料仍依 [LICENSES.md](LICENSES.md) 的分層條款處理。
