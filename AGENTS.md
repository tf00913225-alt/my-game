# 專案代理規則

1. 開始任何工作前，先完整閱讀 `HANDOFF.md`。
2. **任何 UI、CSS、版面、美術圖片、背包、裝備、技能、戰鬥介面等修改前，都必須先閱讀 `UI_GUIDELINES.md`。**
3. `UI_GUIDELINES.md` 是 UI 規範唯一來源；不要把完整規範複製到其他文件，避免版本分歧。
4. 若本次只要求 UI 修改，不得順手修改戰鬥、存檔、數值、掉落等無關邏輯。
5. **任何程式、CSS、UI、戰鬥、存檔、技能、掉落、動畫或資產整合修改前，都必須完整閱讀 `HANDOFF.md`、`UI_GUIDELINES.md` 與 `ARCHITECTURE_RULES.md`。**
6. **修改前必須先在回報中列出：本次功能的 owner 檔案、主要函式、現有 wrapper／後續覆蓋點，以及是否需要暫時補丁。未完成此檢查不得修改。**

## DEV 發布與測試位置
- `main` 仍是正式版來源，除非使用者明確要求，不得把開發修改直接推進 `main`。
- `dev` 每次 push 由 `.github/workflows/deploy-dev-cloudflare.yml` 自動部署到 Cloudflare Pages。
- DEV 唯一固定測試網址：`https://four-symbols-dev.pages.dev`。
- 不再使用 GitHack / RawCDN 作為 DEV 驗證來源。
