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

## 6A. 玩家正式版本通知與 dev → main Release Contract

本節是永久發布契約。未來任何 Work（工作模式）、GPT、Claude、Codex 或其他發布 owner 都必須執行；不需要專案負責人重複提醒。

### 唯一正式玩家資料來源

- `release/release.json`：工程用 Game Version／Cache Version 與 release readiness。
- `release/release-update.json`：唯一玩家公告 manifest。跑馬燈、首頁／首次登入公告、Update Detail Modal 必須直接共用它，不得各自維護文案或另建公告資料來源。
- 部署產物 `release-manifest.json`：Commit SHA／部署核對專用。它不是玩家公告資料，也不得以 Git SHA 判斷玩家是否看過版本。

`release/release-update.json` 至少必須有：

```json
{
  "schemaVersion": 1,
  "publicNotice": true,
  "releaseVersion": "V173.66",
  "noticeId": "release-v17366",
  "title": "V173.66 更新",
  "summary": "玩家看得懂的一句摘要",
  "content": ["玩家可感知變更一", "玩家可感知變更二"],
  "publishedAt": "2026-09-19T00:00:00.000Z",
  "updateMode": "normal",
  "minimumVersion": null
}
```

- `releaseVersion` 必須與 `release/release.json` 的 Game Version 相同；版本比較要使用數字 parser，不得用字串大小。
- `noticeId` 每一正式版本必須唯一，建議 `release-v<去除小數點的版本>`。
- `title`、`summary`、`content` 必須是玩家看得懂的繁體中文；不可出現程式檔名、函式名、Commit SHA、CI、測試、cache、debug 或工程排錯術語。
- `updateMode` 只可為 `normal` 或 `forced`。`minimumVersion` 為 null 或合法版本；當載入版本低於它時，必須視為強制更新。
- `publicNotice:false` 只允許專案負責人於本次明確說出「本次不公告」且本批變更完全不影響玩家時使用；必須附 `skipReason`。文件、CI、開發工具或完全不可感知的內部變更才可跳過，發布 owner 不得自行默認跳過。

### 發布前自動差異整理（必做）

每次 `dev → main`，除非有上述明確「本次不公告」指示，發布 owner 必須自行執行以下流程，不能要求專案負責人另外提供跑馬燈文案、首頁公告文案或 Release Notes：

1. 先更新 remote refs，從實際 current `main` 到即將發布的候選 `dev` 做完整三點差異；建議執行 `npm run release:update-diff -- --base origin/main --head HEAD`。
2. 檢查完整 diff，而非只看最後一個 commit、PR 標題或檔案清單。若自上一次 main 累積多項玩家可感知修改，必須全部整理進本次 `content`。
3. 自行把真正影響玩家的結果濃縮成玩家語言：新增了什麼、體驗如何改善、修正了什麼。不可把工程實作、內部檔名或未發布功能偽裝成玩家內容。
4. 將同一份 manifest 填入 `summary` 與 `content`；遊戲三個入口自動共用，禁止再手寫三份不一致文字。
5. 由 `release-gate` 驗證 manifest 結構、版本對齊、公開／跳過原因，再連同 Requirement Verification、CI 與 dev 驗收走既有發布流程。

### normal／forced 與安全 reload

- `normal`：背景偵測到新版本後顯示跑馬燈，玩家可查看內容、稍後更新或在安全狀態按「立即更新」。不得自動 reload。
- `forced`：安全狀態直接顯示不可略過的更新 Modal；戰鬥、結算、領獎、合成、冶煉、商店交易、背包／裝備資料變更、Boss 獎勵與存檔寫入中只標記 pending，完成後才要求更新。不可按背景、ESC、返回鍵或返回按鈕繞過。
- 已讀只記錄 localStorage account sidecar `release-update-last-seen-version`／`release-update-last-seen-notice`；不進 Cloud Save。相同版本確認後不重複強制跳出；下一個 `noticeId`／版本仍必須正常辨識。
- runtime 每 4 分鐘檢查，另在 startup、頁面回到前景與 online 恢復時以節流檢查。`release/release-update.json` 必須 query cache-bust、`cache: no-store`，並以 `_headers` 排除長期 cache。現況沒有 Service Worker；未來導入 PWA／Service Worker 時，必須先保障此檔 network-first 或不被舊 cache 攔截。

### 正式發布流程

`功能開發完成 → 合併 dev → dev 驗收 → 自動比對 main...dev 並整理玩家可感知內容 → 更新 Game/Cache Version 與 release manifest 欄位 → Requirement Verification／最終 CI → dev → main → main 發布完成 → 在線玩家背景發現新版 → 跑馬燈／完整內容 → 玩家安全時 reload → 新登入玩家首次看一次公告`。

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

## 20. dev → main 發布期間的修復回流

發布檢查、Code Review、QA、Browser Test、Security Check 或自動審查若發現程式問題，正式流程固定為：

`最新 dev → 新 fix/ 分支 → 最小必要測試 → PR 回 dev → CI 綠燈 → 合併 dev → 以最新 dev 重跑 main 發布檢查 → dev 合併 main`。

- 禁止直接只修 main。
- 禁止只在既有 dev → main PR 的 head 上保留一份 dev 沒有的修復。
- main 不得出現 dev 尚未擁有的獨立程式修復。
- 發布 PR 已開啟時，仍必須先讓修復正式進入 dev，再重新核對發布 PR diff。
- 任一時刻若形成 `dev = A`、`main = A + 修復 B`，Release Gate 必須失敗並停止發布。


## 正式版本與 CHANGELOG 對應規則

- 正式 Game Version 只代表已完成 Requirement Verification、可對外辨識的發布批次。
- 每次正式版本變更都必須同步更新 `CHANGELOG.md`，新增 `## V<版本號>` 條目。
- 該條目必須說明本版本實際修正／新增內容，並列出對應 Requirement Batch。
- 版本號不得只作為 cache busting 或畫面裝飾；若沒有對應 CHANGELOG，Release Gate 必須失敗。
- Game Version 與 Cache Version 仍需同步，但兩者用途不同：Game Version 用於版本追蹤，Cache Version 用於資源失效。
