# UI-SKILL-STANDARD-20261020 — 第一施工段

Target: dev，PR #955。本段實作與驗收中，**不是全介面完成**。

## 修改及責任

- 能力值窄按鈕：原 `css/00-main.css` 的 44px 寬度未使用 native UI 長度單位，與字級、其他控制不在相同尺寸域；原列改正常 grid，按鈕使用既有單位。不改加點 handler、數值或儲存。
- 經驗池標題：技能列表捲動後切 TAB，原 `switchCharacterTab` 保留舊 `characterTabContent.scrollTop`（修改前實測144），使標題落在 TAB 後。原切頁生命週期回頂，並即時呼叫既有充能呈現同步，避免等待4秒畫面 timer 而出現空殼。不修改公式、收益或 timer。
- 冶煉規則：原 C 級短對話框同時讓 flex 長內容縮小與 sticky 按鈕覆蓋正文。保留全部原文字、數值、機率及成本，只分為原標題／單一內容捲動區／原返回操作列；使用既有 Medium 上限。
- 素材：角色三 TAB、自動設定、冶煉規則沿用技能原有九宮格與標題牌。`css/49` 保留同一美術 Owner；技能專屬選取變數、頭像／列表及框幾何保留。其他尚未審核的介面不在本段換裝。

## 自動設定捲動責任衝突

本段實際操作發現 `#homeFeatureModalBody` 有1371／1936的可捲內容，但真touch始終0→0。最終 computed style 顯示內層 panel 為 overflow:hidden：`css/38` 的舊高權重 compact 規則蓋掉 `css/48` 正式設定頁的 overflow:visible。移除該舊規則後，同一真touch能抵達補品耗盡回城及元素匣時間控制。

依 Architecture／Replacement／Bug Owner Gate，範圍只限已證實衝突的四行舊規則：

- 建立、借入、關閉、歸還仍是原 `js/00-main.js`；沒有新增 DOM Owner、observer、timer或wrapper。
- 設定頁框及唯一捲動區仍屬 `css/48-v169-element-box-settings.css`；只退役 `css/38` 的 max-height/overflow 重複 writer。
- `.v141-compact-element-box` 仍承擔其餘正式內容樣式，沒有退役該語意 class。
- 資料、設定、啟停、交易、獎勵、帳號與存檔權威均不變。
- 回歸使用正式 loader、所有樣式及隔離唯讀 QA 帳號；原 `run-ui-skill-standard-browser-qa.mjs` 真touch序列會在舊規則恢復時因捲動0→0失敗。

## 證據與限制

本機修改前：`artifacts/ui-skill-standard/focused-before/393x873`；廣泛基線：`artifacts/browser-qa/functional-reading/393x873`。後者的字級量測不是美術批准。

修後最終序列：`artifacts/ui-skill-standard/segment-1-r3/<viewport>`，四目標為360x640、393x873、412x915、1280x800。report含Head、dirty、來源及manifest SHA256、逐次touch命中與文字邊界、捲動前後、技能皮膚狀態；截圖獨立保存。舊r1/r2探索證據不替最終快照背書。

第一輪獨立審核發現並要求補足：選單未正式關閉造成假底部證據、非零充能圖誤標zero、規則返回必須來自真冶煉入口、初始轉場影格應待穩定。全部保留為未批准的歷史證據，不把當時程式或測量通過當成視覺完成。

仍待：r3四裝置獨立審核、更多實際相關狀態、其餘台帳項目、Latest Head Required CI、dev整合、實際deployed SHA及原症狀驗證。未測的真實手機硬體、各瀏覽器、載入／失敗／待確認或未列出的狀態均不宣稱通過。
