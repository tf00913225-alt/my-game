# 永久架構規則

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
