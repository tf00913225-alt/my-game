# 《四象江湖傳》Release / Requirement Verification 永久規範

本文件是 `AGENTS.md` 與 `CLAUDE.md` 的共通永久發布規範。GPT、Claude、Codex 或任何 AI 開發代理都必須遵守。除非專案負責人日後明確修改，否則不得繞過。

## 最高優先級規則

**任何一次需求若包含多項修改，禁止在未完成逐項驗證前更新正式版本號並宣稱完成。**

版本號只能表示「這批已驗證需求準備發布」，不能作為「功能已完成」的證據。若版本已變更但 Requirement Checklist 未達 100% VERIFIED，CI／發布流程必須視為不完整版本並阻止發布／結案。

## 1. 修改完成不等於部署完成

禁止因為程式有 diff、commit/push 成功、Repository checks SUCCESS、Deploy SUCCESS 或畫面版本號更新，就宣稱「已完成」。正式完成必須同時具備：需求已實作、正確檔案已修改、修改已 commit、commit 已 push、CI 通過、實際部署使用該 commit、Game/Cache Version 一致、本次需求逐項驗收通過。缺少任一步，一律回報 `NOT COMPLETE`。

## 2. Requirement Checklist

多項需求必須建立 Requirement Checklist。每一項只能使用 `TODO / IMPLEMENTED / VERIFIED / BLOCKED`。不得因部分完成就把整批標記完成；只有 N/N VERIFIED 才能宣稱完成。

每項 VERIFIED 必須有證據：修改檔案、主要函式／元件／CSS owner、使用素材（若有）、驗證方法與驗證結果。

## 3. 功能證據與版本證據分離

版本號只證明版本；不得用 Vxxx 顯示成功推定功能成功。功能必須以其 DOM、handler、函式、資料、CSS、素材引用、實際 UI／行為等可驗證證據獨立驗收。

## 4. Single Source of Truth

正式 Game Version 與 Cache Version 以 `release/release.json` 為版本來源。畫面版本、Loader、`V_ASSET_VERSION`、受管理的 HTML/CSS/JS cache-busting 必須與此來源一致。部署流程只能驗證，不得在 `_deploy` 或其他暫存產物中偷偷改版本字串。

任何 Game/Cache Version 不一致都必須阻止發布。

## 5. Commit SHA 與 Deploy SHA

每次 dev／main 發布必須記錄實際 commit SHA。完成回報至少包含 Branch、Commit SHA、Game Version、Cache Version、Repository checks、Deploy 狀態與 Deployment SHA verified。

Cloudflare dev 必須確認：`dev HEAD == workflow commit SHA == deployed release-manifest commitSha`。任一不一致不得宣稱部署完成。

main 若沒有可驗證實際 production SHA 的 deployment owner／workflow，必須明確標示為人工或 BLOCKED，不得假稱已自動化。

## 6. Release Manifest

發布產物必須包含 Release Manifest，至少記錄 Version、Commit SHA、Included Requirements、Verification Result、Cache Version、Deploy Result。部署前 manifest 可為 `PENDING_VERIFICATION`；部署後必須產生最終 `SUCCESS` 記錄並確認 SHA。

## 7. 能自動驗證的規格必須進 CI

能用程式搜尋／斷言驗證的內容不得只靠人工。正式廢除功能的舊 DOM id、class、函式、設定 key、顯示文字若仍存在於正式 HTML/JS/CSS，CI 必須失敗。其他固定公式／階級／掉落規格只要可穩定斷言，也應逐步納入現有 CI，而不是建立重複測試系統。

## 8. CI SUCCESS / Deploy SUCCESS 不代表 Requirement 完成

Repository checks SUCCESS 只表示既有自動檢查通過；Deploy SUCCESS 只表示部署流程成功。最終完成仍需 Requirement Checklist 100% VERIFIED。

## 9. 修改前基準確認

每次修改前必須確認目前分支、HEAD commit、Game Version，以及是否在最新指定分支（通常 dev）工作。禁止在未知基準、舊 blob、舊 worktree、舊 patch、錯誤分支上直接修改。

## 10. 禁止修改錯誤副本

必須先確認實際入口與 import chain。不得只修改測試 blob、`_deploy`、暫存檔、舊版本副本、未追蹤副本或不會被正式部署使用的檔案。

## 11. 素材路徑驗證

新圖片／icon 必須確認檔案存在、命名／分類正確、正式 HTML/JS/CSS 已引用、舊引用移除且部署產物包含該素材。「素材已上傳」不等於「遊戲已使用」。

## 12. UI 最小必要視覺驗收

滿版、捲動、裁切、icon、modal、手機排版、loading、點擊、副本／背包／角色／商店等 UI 修改，不得只讀 CSS 後宣稱完成。至少驗證主要手機 viewport 下：未裁切、可操作、icon 載入、主要資訊完整可見。

## 13. 禁止用補版本號掩蓋功能未完成

修復版本同步後，仍必須重新執行 Requirement Checklist；新版版本號顯示成功不得直接結案。

## 14. 「你說改好了但手機沒變」固定排查順序

依序檢查：source code 是否有需求 → 是否存在 commit → commit 是否 push → dev/main HEAD → 實際部署 SHA → Game Version → Cache Version → Browser/Service Worker Cache。未確認斷點前禁止直接重做功能。

## 15. 完成回報格式

禁止只說「已處理／已同步／已完成／已部署」。完成回報至少使用：

- Requirements: N/N VERIFIED
- Branch
- Commit SHA
- Game Version
- Cache Version
- Repository checks
- Deploy
- Deployment SHA verified

任一未完成時必須顯示 `NOT COMPLETE` 並列出剩餘項目。

## 16. dev / main 固定流程

`dev → CI → dev preview → Requirement Verification → 使用者確認 → PR / merge main → main CI → production deploy → production version/SHA verification`。

未經 dev 驗收不得直接推 main。`assets-library` 維持素材專用，不得混入程式功能修改。

## 17. 玩家資料安全

Cache、版本、Service Worker 更新只允許處理靜態資源 Cache。禁止因此清除玩家 `localStorage`、IndexedDB、雲端存檔、帳號、背包、等級、裝備或遊戲進度。Cache invalidation 與 Save Data 必須完全分離。

## 18. 自動化檢查 owner

- `release/release.json`：Game/Cache Version 與 release readiness。
- `release/requirements.json`：本批 Requirement Checklist。
- `release/deprecated-code.json`：正式廢除功能的 forbidden tokens。
- `.github/scripts/release-gate.mjs`：版本、Cache、Checklist、deprecated code、artifact manifest、deployed SHA gate。
- `.github/workflows/ci.yml`：Repository checks 與版本更新前 100% VERIFIED gate。
- `.github/workflows/deploy-dev-cloudflare.yml`：dev HEAD、release readiness、immutable artifact、Cloudflare deployed SHA 驗證。

## 19. 人工驗收仍不可省略

CI 無法取代所有 UI／手機實機、操作手感、視覺完整性、使用者主觀確認；這些項目需在 Requirement Checklist 中清楚標明驗證方式。遠端 GitHub CI 也無法看見開發者尚未 commit 的本機工作目錄，因此「功能改了但沒進 commit」仍必須由開發代理在 push 前以 `git status`／`git diff --cached`／commit diff 進行工作區驗證。
