# 專案代理規則

1. 開始任何工作前，先完整閱讀 `HANDOFF.md`。
2. **任何 UI、CSS、版面、美術圖片、背包、裝備、技能、戰鬥介面等修改前，都必須先閱讀 `UI_GUIDELINES.md`。**
3. `UI_GUIDELINES.md` 是一般 UI 規範的唯一來源；不要把完整規範複製到其他文件，避免版本分歧。**唯一的專項例外是 `docs/ITEM_RARITY_UI_SPEC.md`：凡涉及裝備、道具、材料、設計圖、符咒、寶箱、掉落、背包格、商店格、合成、冶煉或任何物品階級／稀有度顏色時，該文件為階級與色號的最高權威來源。**
4. 若本次只要求 UI 修改，不得順手修改戰鬥、存檔、數值、掉落等無關邏輯。
5. **任何程式、CSS、UI、戰鬥、存檔、技能、掉落、動畫或資產整合修改前，都必須完整閱讀 `HANDOFF.md`、`UI_GUIDELINES.md` 與 `ARCHITECTURE_RULES.md`；若工作涉及物品階級／稀有度，再額外完整閱讀 `docs/ITEM_RARITY_UI_SPEC.md`。**
6. **修改前必須先在回報中列出：本次功能的 owner 檔案、主要函式、現有 wrapper／後續覆蓋點，以及是否需要暫時補丁。未完成此檢查不得修改。**
7. **不得自行把 `low / mid / high / perfect` 或「低階／中階／高階／完美」當成新的正式物品階級；正式六階與固定色號一律以 `docs/ITEM_RARITY_UI_SPEC.md` 為準。**

## DEV 發布與測試位置
- `main` 仍是正式版來源，除非使用者明確要求，不得把開發修改直接推進 `main`。
- `dev` 每次 push 由 `.github/workflows/deploy-dev-cloudflare.yml` 自動部署到 Cloudflare Pages。
- DEV 唯一固定測試網址：`https://four-symbols-dev.pages.dev`。
- 不再使用 GitHack / RawCDN 作為 DEV 驗證來源。
- `assets-library` 與 `assets-library/assets/inbox/` 仍維持 GitHub 素材工作流，不受 Cloudflare Pages 發布方式影響。
- 每次維修或升版後，主城 HUD 顯示版本、`index.html` 的載入版本與 `V_ASSET_VERSION` 必須同步更新，避免手機載入舊快取。
