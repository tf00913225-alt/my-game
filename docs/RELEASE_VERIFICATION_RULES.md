# 《四象江湖傳》Release / Requirement Verification 永久規範

本文件是 Release／Candidate／Freeze／dev → main／正式版本／Release Readiness／Exact-HEAD production verification 的唯一發布驗證 Owner；在這些任務內完整適用，main 發布仍須使用者正式授權。

AGENTS.md 唯一控制 Agent 讀取路由。一般 dev Bug、Additive 或 docs/governance-only 不預設載入完整發布契約，也不因本文件要求升版、正式部署或玩家實機驗收；既有 CI／Release Gate／deployment checks 正常執行，不取消、不略過。普通工作生命周期依 AGENTS、一般 Bug 結案依 Fast Path；本文件的 NOT COMPLETE／逐項發布驗證門檻適用其發布範圍。

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

### 4A. npm metadata 與版本語意

- 根 `package.json.version` 是私有遊戲工具專案的發布 metadata 投影，不是 Runtime／Game／Cache Owner，也不是獨立對外發布的 npm 版本。歷史 Game `N.N` 對應 npm semver `N.N.0`；三段 `N.N.N` 原樣投影。唯一決策來源仍是 `release/release.json.version`，既有 Release Gate 驗證投影，不從 package 反向修改 Game／Cache。
- 發布者依 release source 計算投影後，使用 `npm version <投影值> --no-git-tag-version --ignore-scripts` 維護 metadata；不單獨升根 package 版本。本批只修 metadata，Game／Cache 保持 173.73。
- 根工具專案的 CI parser 使用固定版本 devDependency，並由 npm 維護追蹤的 `package-lock.json`；不為數字同步另外新增 lock。既有 Gate 同時驗證 root lock 頂層及 `packages[""]` 的 name／version；用 npm 更新，不手改 lock，不容許 metadata 漂移。
- `functions/package.json.version` 是獨立 Functions 私有 npm package metadata，現為 `1.0.0`；不映射 Game／Cache。Functions lock 必須存在且 metadata 與自身 package 一致。Firebase 部署仍由既有 workflow 綁定 exact Git SHA，不能用 Functions package version 推定部署或遊戲版本。
- build／asset manifest 讀 release source；Production manifest 的版本由 `.github/scripts/release-gate.mjs::writeDeployManifest` 投影，SHA 由既有部署 workflow 綁定。玩家公告、HUD／loader、cache validation 均依各既有 Owner 引用／驗證 release source；不得新增版本檔、workflow env 人工版本、timer 或第二 Owner。

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
- DEV／本機 Preview（預覽）模式仍禁止 reload；預覽視窗不得顯示「立即更新」，必須改用「關閉預覽」等明確動作，避免把安全防護誤認成按鈕故障。
- `forced`：安全狀態直接顯示不可略過的更新 Modal；戰鬥、結算、領獎、合成、冶煉、商店交易、背包／裝備資料變更、Boss 獎勵與存檔寫入中只標記 pending，完成後才要求更新。不可按背景、ESC、返回鍵或返回按鈕繞過。
- `last-seen-version`／`last-seen-notice` 只代表已讀與通知狀態，不再代表「往後登入都不顯示」。玩家每次新的登入工作階段進入主城後，當前正式公告要自動顯示一次。公告底部提供「今日不再跳出提醒」；勾選後以 per-UID localStorage sidecar 保存目前 `noticeId` 與玩家裝置當地日期，只抑制該公告當日的登入自動 Modal。隔日同公告重新顯示；同日若發布新 `noticeId`，新公告仍顯示。此 sidecar 不進 Cloud Save。
- runtime 每 4 分鐘檢查，另在 startup、頁面回到前景與 online 恢復時以節流檢查。`release/release-update.json` 必須 query cache-bust、`cache: no-store`，並以 `_headers` 排除長期 cache。現況沒有 Service Worker；未來導入 PWA／Service Worker 時，必須先保障此檔 network-first 或不被舊 cache 攔截。

### 正式發布流程

`功能開發完成 → 合併 dev → dev 驗收 → 自動比對 main...dev 並整理玩家可感知內容 → 更新 Game/Cache Version 與 release manifest 欄位 → Requirement Verification／最終 CI → dev → main → main 發布完成 → 在線玩家背景發現新版 → 跑馬燈／完整內容 → 玩家安全時 reload → 每次新登入進主城自動顯示當前公告一次（若已勾選今日不再跳出則當日略過）`。

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

## 16A. Repository Closeout 與 main/dev 有效內容收斂

本節為正式 `dev → main` 發布不可省略的收尾；普通 dev 工作只依 AGENTS 的 lifecycle／清理，不自動延伸至 main。

標準完整流程改為：

`最新 dev → 工作分支 → PR 回 dev → CI/Requirement Verification → 合併 dev → 安全清理已完成工作分支／被取代 PR → dev preview／使用者確認 → dev → main PR → main CI → production deploy → production version/SHA verification → 安全清理發布分支 → main/dev 有效內容收斂確認`。

### 16A-1／16A-2. 分支與被取代 PR 清理

安全清理與有效內容吸收判定統一引用 AGENTS.md「工作生命週期／DEV PR 自動整合規則」，發布工作同樣遵守；不複製第二套清理授權。發布分支不是永久分支，內容已完整進 main 且無保留理由時必須安全清理。

### 16A-3. dev → main 發布後收斂
- 正式發布完成後必須比較 `main` 與 `dev` 的**實際有效內容**。
- `ahead/behind`、merge commit 數、commit graph 或 GitHub 顯示 `diverged` 只能作為線索，不能單獨證明內容分歧。
- 若兩邊實際 tree／有效 diff 一致，單純 commit 歷史不同視為已收斂，不得因此把發布狀態降級。
- 若 `main` 有 `dev` 未吸收的有效內容，必須建立受控同步 PR／工作分支完成回流；禁止 rebase、force push、直接覆寫 `main`／`dev`。
- 發布候選 branch／PR 在正式發布成功且內容已吸收後，必須進入安全清理判定，不得無理由永久保留。

### 16A-4. 週報健康燈號
週報必須把「系統健康」與「Repository Hygiene（程式庫清潔）」分開：

- **綠燈**：production／dev 的必要 CI 與部署健康；沒有會阻塞下一次發布的有效未吸收內容、實質 main/dev 內容分歧或 P0/P1 發布阻塞。
- **黃燈**：存在會實際影響下一次發布的問題，例如必要 CI 失敗、有效 PR 衝突、未吸收獨立內容、實質 main/dev 內容分歧或部署／Release Gate 未完成。
- **紅燈**：production 已知嚴重故障、核心玩家資料／登入／存檔／付款等高風險失效、正式部署失敗或嚴重 Regression。
- 歷史已完成 branch 數量、已被取代且無獨立內容的舊 PR、純 merge-history 差異，只能列入 Hygiene，不得單獨把總燈號從綠降成黃。

### 16A-5. 結案回報
本發布流程完成回報除既有欄位外，還必須補：
- Source branch closeout：DELETED／RETAINED（附原因）
- Superseded PR closeout：CLOSED／NONE／RETAINED（附原因）
- Release branch closeout：DELETED／N/A／RETAINED（附原因）
- main/dev effective-content convergence：VERIFIED／NOT APPLICABLE／BLOCKED

能安全完成但尚未完成的 closeout 項目，不得省略不報。

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


## 21. Release Readiness Priority Framework（發布整備優先級框架）

本章是全 Repository 唯一的 **Release Readiness Priority Framework** 正式 Owner。它適用發布整備與 P0／P1／P2 Release Readiness 分類；普通 Bug／功能不因此必讀完整發布規範。AGENTS.md、CLAUDE.md 只能放入口，不得複製、改寫或建立第二份規則。

本框架只界定「發布整備」與「正常開發」的責任邊界。它**不得降低**既有 Bug Repair DoD（錯誤修復完成定義）、Owner Convergence Gate（控制來源收斂閘門）、Change Safety Contract（變更安全契約）、Cloud Save fail-closed（雲端存檔預設拒絕）、main 保護、dev PR（合併請求）流程、Release Verification（發布驗證）或 Repository Closeout（程式庫收尾）規則。

### 21.1 永久優先級定義

P0／P1／P2 是 **Priority Classification（優先級分類）**，不是固定任務清單。每個 Release Cycle（發布週期）都必須依最新 dev、Runtime（執行環境）、CI（持續整合）、Open PR、已知 Bug 與 Release Scope（發布範圍）重新分類；前一版已完成、被取代或已失效的項目不得自動沿用。

- **P0 — Release Blocker（發布阻塞）**：未解決即不得正式發布目前 Candidate（候選版本）。包括真實核心 CI 失敗、正式 Runtime 無法運作、玩家資料／存檔風險、登入／帳號核心失效、付款／獎勵安全、正式 Asset（素材）損毀、Release Candidate 驗收失敗及嚴重玩家可見 Regression（退化）。
- **P1 — Release Readiness（發布整備）**：近期發布前應完成、但尚不構成真正 Release Blocker 的工作，例如 Release Scope、Dirty PR 清理、被取代 PR 關閉、main／dev 差異整理、CI 強化、發布清單與 Repository Hygiene（程式庫清潔）。若實際造成資料損壞、Runtime 故障、正式發布失敗或玩家高風險，必須立即 **P1 → P0**。
- **P2 — Maintenance（維護／技術債）**：Warning（警告）、非阻塞版本資訊、空資料夾、舊腳本、命名整理、非必要重構及低風險 Hygiene。若證實造成真實發布風險，必須重新分類為 P0 或 P1。

**P0 ≠ Development Blocker（開發阻塞）。** P0 未完成時仍允許 Bug Repair、Feature Development（功能開發）、Gameplay Adjustment（玩法調整）、UI／CSS、Asset Import（素材導入）、Cloud Save（雲端存檔）與其他獨立 PR；限制只有「目前狀態不得正式發布」。

**P1 與 P2 不得阻止正常開發。** 永久禁止把「P0 沒清完不能修 Bug」、「P1 沒做完不能開新功能」或「P2 沒整理完不能改 Gameplay」當成流程規則。不得因仍有 P2 無限延後正常版本。

### 21.2 預設工作狀態：NORMAL DEVELOPMENT（正常開發）

專案預設且常態狀態永遠是 **NORMAL DEVELOPMENT**。此狀態可同時進行 P0 Repair、P1 Cleanup、P2 Maintenance、Bug、Feature、Gameplay、UI、Assets 與 Cloud 工作；每項仍須遵守既有 owner、測試、PR 與安全規範。

不同對話／Agent 可平行工作，但每項工作必須：
1. 從當下最新 dev 建立獨立工作分支，禁止直接寫入 dev／main。
2. 每個 PR 準備合併前重新取得最新 dev HEAD。
3. 若 dev 已前進，重新核對 Base、Conflict（衝突）、Canonical Owner（正式控制來源）、Lifecycle（生命週期）、Regression 與 CI；不得沿用舊 Base 驗證直接合入。

若兩項工作涉及同一 Canonical Owner、同一 Lifecycle、同一資料權威來源，或高度重疊核心檔案，禁止各自獨立平行修改後直接合入 dev。必須序列化施工，或明確由其中一個 PR 承接另一個已完成結果，以避免雙 Owner、last-write-wins（後寫覆蓋）、舊 Base 覆蓋、Patch 疊加與 Test Contract Drift（測試契約漂移）。

### 21.3 RELEASE FREEZE（發布凍結）與 Candidate

只有專案負責人明確表示「準備正式發布」、「準備下一版上線」、「開始 Release Candidate」或「執行最終發布驗收」，或語意等價指令時，才可進入 **RELEASE FREEZE**。AI／Agent 不得因 P0 清單存在、CI Warning、P1／P2 未清、或自行判斷「差不多可以發布」而擅自 Freeze。

Freeze 開始時必須：
1. 記錄 Candidate Dev HEAD SHA。
2. 建立並明確標示 **RELEASE CANDIDATE <SHA>**。
3. 為保持 Candidate SHA 穩定，暫停非必要 Feature、UI 與 Content 修改進入候選 dev。
4. 執行本候選版本所需的 P0 Final Exact-HEAD Verification（P0 最終精確 SHA 驗收）、Release Scope P1 檢查，以及既有 Release Verification。

只有 Freeze 期間可建立／重跑 Exact-HEAD Verification。**NORMAL DEVELOPMENT 期間禁止因每次 dev 前進反覆建立 Exact-HEAD Verification PR 或重跑整個 Release Gate。** 日常僅執行本次修改所需的 Targeted Test（目標測試）、Regression Test、Repository CI 與必要 Browser QA（瀏覽器驗收）。

### 21.4 Candidate Invalidated Rule（候選失效規則）

Freeze 時若 Candidate SHA = A，而 P0 驗收發現真正問題，修復流程固定為：

最新 dev → fix branch → 最小修復 → PR → dev → CI → merge dev

若 dev 變成 SHA = B，則 **Candidate A 立即 INVALIDATED（失效）**。A 的 CI、Browser QA、Deployment 或 Release Evidence（發布證據）不得作為 B 的發布證據。新的 Candidate 必須是 RELEASE CANDIDATE B，並以 B 重新執行必要的 Final Verification。禁止只修 main 或在發布 PR head 留下 dev 不具備的獨立修復。

Freeze 時只確認真正影響本次 Release correctness（發布正確性）、Player safety（玩家安全）、Runtime integrity（執行完整性）或 Deployment（部署）的 P1。其餘 P1 可明確標記 **Deferred（延後）**，不阻止發布；P2 預設不阻止發布。

### 21.5 狀態語意與解除 Freeze

狀態必須使用下列語意，且不得混淆：

- **NORMAL DEVELOPMENT**：正常平行施工。
- **RELEASE FREEZE**：已由專案負責人啟動發布凍結。
- **RELEASE CANDIDATE <SHA>**：固定候選提交。
- **RELEASE BLOCKED**：此 Candidate 仍有未解 P0。
- **RELEASE READY**：此 Candidate 的 P0 Final Verification 已通過。
- **RELEASED**：main 合併、main CI PASS、Production Deploy PASS、Production SHA verified 與 Repository Closeout 全部完成。

**RELEASE BLOCKED 不等於 DEVELOPMENT BLOCKED。** 除非問題本身會破壞資料、污染 dev 或造成不可逆風險，正常開發仍可繼續。

正式發布完成後，Release Freeze 自動結束並回到 **NORMAL DEVELOPMENT**；Bug、Feature、Gameplay、UI、Assets、Cloud 全部恢復正常施工。
