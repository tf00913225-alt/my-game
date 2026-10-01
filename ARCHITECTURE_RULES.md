# 永久架構規則

## 一般 Bug 預設路徑（2026-10-01 生效）

一般 Bug 必須先讀 `docs/BUG_FIX_FAST_PATH.md`，以該文件為調查範圍、證據升級、自主整合與結案的權威來源。預設最小必要調查＋最小安全修正；只查直接相關責任與呼叫鏈。完整 Owner Convergence／Lifecycle 稽核僅在該文件第四節證據成立或使用者明確要求架構工程時適用。下文不得以「較嚴格優先」恢復一般 Bug 全面稽核、tests-only 限制、固定失敗額度、僅草稿 PR 或正式 Runtime 即硬停止。最新 Head 必要 CI、原症狀驗證與資料安全仍必須遵守；一般 Bug 結案不要求發布 main。


## 0. 變更安全與取代遷移（永久強制）

所有新增、修改、替換、重構與修復，必須先遵守 `docs/CHANGE_SAFETY_REPLACEMENT_CONTRACT.md`。

- 先分類 Additive（新增）／Replacement（取代）／Convergence（收斂）／Removal（移除）。
- Replacement 不等於在舊版本後面再疊一層；必須掃描舊實作仍承擔的責任。
- Owner、Contract、Lifecycle、Semantic State、Regression Test 必須一起收斂。
- 若新版只能靠 `display:none`、`animation:none`、`!important`、更高 selector specificity、Wrapper 或 late patch 壓住舊版才正常，預設視為遷移未完成。
- 使用者只負責產品／玩法決策；舊程式是否刪除、遷移或相容保留由代理依專案證據主動判斷並說明。


1. 先找出此功能目前真正的來源檔、主要函式與既有後續覆蓋點。

2. 一般修改優先直接修正該功能的主要來源，不新增新的 vXXX runtime patch。

3. 若因相容性風險必須新增暫時補丁：
   - 必須在 HANDOFF.md 記錄原因、影響函式、原始來源檔與未來收斂位置。
   - 同一個函式不得連續疊第三層補丁。
   - 下一次再修改同一功能時，必須把既有暫時補丁收斂回單一權威實作。

4. 不可對 renderBattle、winBattle、技能結算、存檔讀寫等核心函式反覆 wrapper 疊加；先整合既有邏輯再修改。

5. CSS 優先修改該頁／該元件原本的樣式；禁止只靠新增更後面的 CSS 和 !important 壓過舊規則。

6. 每次修改後，測試必須以「所有正式腳本都載入後」的最終遊戲行為為準，不能只測單一歷史補丁。

7. 新功能要指定唯一 owner 檔案；HANDOFF.md 必須記錄它的權威位置。

8. 不順手全面重構；只在本次修改的同一子系統內做小範圍收斂。

## 0A. Bug Repair Owner Convergence Gate（永久強制）

所有 Bug／failure／regression 修復另必須遵守 `docs/BUG_REPAIR_DOD_OWNER_CONVERGENCE_GATE.md`。

1. 修復 production runtime 前，先完成 Responsibility Inventory（責任盤點）與 Multi-Owner Scan（多 Owner 掃描）。
2. 同一責任只能有一個 Canonical Owner（正式 Owner）；載入順序最後執行者不得自然成為事實 Owner。
3. Wrapper、late patch、Timer、rAF、Observer、CSS override、第二份 DOM／State／Registry 都必須視為 Patch 候選並完成退場判定。
4. 新 Owner 接管時，舊 Owner 必須退役，或降為有明確用途、退場條件且沒有決策權的 Compatibility Layer（相容層）。
5. 必須檢查完整 Lifecycle：建立、準備、啟用、更新、失敗、重試、離開、清理與再次進入。
6. 修復測試以完整正式載入後的 final state（最終狀態）為準；中間 resolver／state／file existence 不得代替玩家最終結果。
7. 同一玩家症狀一次修復後仍重現，下一次禁止再加局部 Patch；兩次仍重現，第三次施工前強制做 Subsystem Convergence Audit（子系統收斂稽核）。
8. DIAGNOSED／IMPLEMENTED／INTEGRATED／DEPLOYED 均不得稱為「已修好」；只有符合該契約 VERIFIED 條件才能宣稱完成。
9. 若產品結果可行但指定實作方式會違反本 Gate，代理必須阻止該實作方法，改採符合正式 Owner 架構的安全方案。

## Release Update Notification System

1. 玩家正式版本公告的唯一資料 owner 是 `release/release-update.json`；Game／Cache Version 仍由 `release/release.json` 擁有。部署用 `release-manifest.json` 的 Commit SHA 不得作為玩家公告版本判斷。
2. Runtime owner 是 `js/release-update-notification.js`。它必須重用既有 `#game-overlay-layer` 跑馬燈與 `#homeFeatureModal`，不得建立第二套公告列、Modal 框架、全頁透明點擊層或一般公告資料來源。
3. 安全重新載入只允許透過 `FourSymbolsReleaseUpdate.canSafelyReloadForUpdate()` 與其 critical-operation registry 判斷；戰鬥、結算、獎勵、背包交易、合成／冶煉、商店交易與存檔寫入不得各自複製 reload 判斷。
4. Runtime 只可維持一個 3～5 分鐘版本 polling interval；visibility／online 使用節流。延後更新期間的單一短期 recheck timer 必須在 pending work 結束後清除，不得演變成第二套全域 timer。
5. `release/release-update.json` 由 `release-gate` 驗證，並以 `no-store`／cache-busting 請求；未來加入 Service Worker 或 PWA 前，必須明確把此檔排除於長期 cache 或補上等價的 network-first 規則與跨版本測試。
6. DEV／本機視覺驗收只可使用同一 runtime 的 `?releaseUpdatePreview=marquee` 或 `?releaseUpdatePreview=modal`。它只允許精確 hostname：`dev.four-symbols-dev.pages.dev`、`localhost`、`127.0.0.1`、`::1`；必須沿用正式 manifest、跑馬燈與共用 Modal，不得寫入已讀狀態或 reload，且 `main` 不得啟用。Preview Modal（預覽視窗）不得顯示會讓人誤以為能真的更新的「立即更新」按鈕；唯一主要動作應明確標示「關閉預覽」或等價語意。
7. 當前正式公告在每次新的登入工作階段進入主城時最多自動顯示一次；是否已讀不得取消下一次登入顯示。唯一同日抑制機制是 per-UID sidecar 的 `noticeId + local date`，UI 文字固定為「今日不再跳出提醒」。此抑制只影響登入自動 Modal，不得停用新版本跑馬燈、forced update（強制更新）或新 `noticeId`。

## Boot Architecture

1. Critical Boot 只包含首次操作真正需要的模組；權威清單為 `asset-manifest.json` 的 `critical`。
2. 非 Critical feature 禁止阻塞 startup；功能邊界由 `config/feature-manifest.json` 與 `window.FourSymbolsFeatures` 管理。
3. 禁止 artificial startup delay；不得以 logo、cinematic、廣告或固定秒數延後已就緒的下一階段。
4. 禁止 fake loading progress；100% 必須表示目前下一個帳號／創角／主城階段已可操作。
5. 禁止以 sequential HTTP request 維持大量 runtime execution order；需要順序的 legacy source 必須在 production bundle 內固定順序，bundle 間依 dependency graph 執行。
6. 圖片禁止以大型 Base64 字串切成多個 JavaScript chunk。
7. 圖片必須使用正常資產檔、content-hash 與 HTTP cache；非首屏圖片預設 lazy 或 background preload。
8. Character creation 必須在 Firebase Auth 與 UID save resolution 都成功後，且 StartupStateMachine 已進入 `NEED_CHARACTER` 才能顯示。
9. Account identity 必須先於 character ownership；沒有 Firebase UID 時禁止建立正式角色，訪客也必須使用 Anonymous Auth UID。
10. local save 必須 account-aware；canonical save 與 sidecar key 都必須包含目前 UID，gameplay schema 與 ownership metadata 分離。
11. 帳號切換不可共享前一 UID 的 active save、記憶體角色、背包、裝備或進度；切換 UID 必須先解除 owner 並重建 runtime context。
12. Firebase optional service 可以 fail gracefully，但身份與存檔判斷不可 fail-open；已驗證 UID 的完整本機存檔才可進 `OFFLINE_READY`。
13. 不可因 Auth、Firestore、localStorage 或 migration error 誤判成「新玩家」，也不可因此顯示創角或清除資料。
14. 新增 feature 預設為 lazy/non-critical；只有能證明它是帳號畫面、創角最小依賴或第一個可操作畫面必要依賴時，才能加入 Critical Boot。
15. 修改 startup architecture 必須同步更新 boot manifest、production build、`docs/BOOT_ARCHITECTURE.md`、架構測試與 browser QA。
