# 《四象江湖傳》Cloud Account / Cloud Save 整體進度

本文件是長期工程進度來源。**每個 Phase 結束都必須更新本文件**；聊天、Commit、PR、CI 或部署成功不能取代驗收紀錄。

## A. Overall Architecture Status（整體架構狀態）

| Phase | 範圍 | 狀態 |
| --- | --- | --- |
| 1 | Single Active Session（單一有效工作階段權威） | BLOCKED |
| 2 | Cloud Save Skeleton（雲端存檔骨架） | NOT STARTED |
| 3 | UID Local Isolation / Login Loading（本機隔離／登入載入） | NOT STARTED |
| 4 | General Progress Migration（一般進度遷移） | NOT STARTED |
| 5 | High-value Data Backend Authority（高價值資料後端權威） | NOT STARTED |
| 6 | Operation ID / Idempotency / Atomic Transaction | NOT STARTED |
| 7 | Audit / Economy Ledger（稽核／經濟帳本） | NOT STARTED |
| 8 | Snapshot / Backup / Recovery（快照／備份／復原） | NOT STARTED |
| 9 | Payment / Refund Entitlement（付款／退款權益） | NOT STARTED |
| 10 | Destructive / Multi-device / Recovery Testing（破壞性／多裝置／復原測試） | NOT STARTED |

既有 UID local repository、唯讀 cloud reader、migration candidate 等是前置實作，**不代表 Phase 2–10 已驗收完成**。Phase 1 使用交易不代表 Phase 6 全部完成。

## B. Current Phase（目前階段）

- Phase 1 — Single Active Session Authority。
- 起始基準：GitHub 最新 `dev@7dd60dcddc9334902e058123a6084a93353e5943`，2026-09-19 重新 fetch 核對。
- 工作分支：`feature/cloud-session-authority-phase1-20260919`；整合目標 `dev`；禁止修改 `main`、rebase、force push。
- 官方版本／cache version 維持 `173.65`，沒有升版。
- 實作／測試／部署狀態分開記錄於下方；未取得實際證據不得標記 COMPLETED。
- 程式 PR [#335](https://github.com/tf00913225-alt/my-game/pull/335) 已在兩組 CI 全綠後合併 `dev`。實作 commits：`3d2434fd1323ea175333868cd8d51871a6f4a69a`、`d413304550f015dc164152d1e0229dd68dcdd95b`；merge commit：`b105f5329d95874820202b6ade78254712200d5e`。未修改 `main`。
- **BLOCKED / NOT COMPLETE：** 程式與模擬器驗收已完成，DEV 前端已部署；Firebase 部署在 Rules API 測試階段遭 IAM 403 拒絕。七支 Functions／規則尚未完成部署，真正雲端 A/B 驗收未執行。Requirements：**4/5 VERIFIED**。

## Architecture Audit（修改前實際程式碼稽核）

已完整閱讀 `AGENTS.md`、`CLAUDE.md`、`HANDOFF.md`、`ARCHITECTURE_RULES.md`、`UI_GUIDELINES.md`、`SYSTEM_CONTRACTS.md`、`docs/BOOT_ARCHITECTURE.md`，並讀取 release verification 與既有 Firebase 文件。

**基準中不存在 `DATA_SECURITY_CONTRACTS.md`**（GitHub exact-SHA 404，repository 搜尋亦無此檔）。沒有假設其規定存在；本文件永久記錄使用者本次明確定案的安全原則。後续應由專案補齊／核對契約，不能以本次新增程式宣稱缺失文件已閱讀。

| 問題 | 稽核結果／實際 owner |
| --- | --- |
| 1. Firebase 初始化 | `js/firebase/firebase-config.js` 提供公開 Web config；`firebase-auth.js::initializeFirebaseAuth()` 建立 named app 與 Auth。Web SDK 12.18.0，project `four-symbols-jianghu`。 |
| 2. UID 來源 | Firebase SDK `auth.currentUser.uid`；`publicUser()` 僅公開 UID/profile；bootstrap 透過 `getSignedInUser()` 與 auth listener 交給 startup。沒有使用本機自編 UID 取代 Firebase 身分。 |
| 3. Login | `firebase-auth.js` 的 Google/Facebook popup、Email 登入／註冊、Anonymous；`firebase-auth-ui.js::bind()` 直接使用這些 owner。`getRedirectResult()` 僅相容既有 redirect 回傳。 |
| 4. Logout | `firebase-auth.js::signOutFirebase()` 原本只呼叫 SDK signOut；UI 登出／切換帳號與 bootstrap API 均走此處。 |
| 5. Auth listener | `observeFirebaseAuthState()` → `onAuthStateChanged`；`firebase-bootstrap.js::initializeLifecycle()` 維護 generation、發送 `four-symbols:firebase-auth-state`；startup `onAuth()` 管理 UID 切換。 |
| 6. 玩家讀取 | `js/52-v173.20-startup-loader.js::resolveSaveFor()` → UID local repository + `firebase-bootstrap.js::resolveCloudSave()` → `firebase-cloud-save.js::readCurrentCloudSave()` → Firestore `users/{uid}/saves/current`。正式雲端 payload 需 `authoritativeStateReady===true`；讀取失敗僅允許已驗證 UID local fallback。 |
| 7. 玩家寫入 | `js/00-main.js::saveGame()` → `FourSymbolsAccountSave.writeForUid()` → localStorage。`loadGame()` 接受 startup 已解析 payload。`SAVE_KEY` 與 active UID key 交叉核對。Firestore 寫入由 Admin Functions 處理，並未完成一般遊戲進度上雲。 |
| 8. 現有 Backend | `functions/index.js` 共四支既有 callable：`bootstrapCloudSave`、`submitLegacyMigrationCandidate`、`createNativeAuthHandoff`、`redeemNativeAuthHandoff`。前兩支只有 Firebase Auth，尚無遊戲 session check；後兩支是原生 Facebook 身分交接。 |
| 9. Browser 直接 database 寫入 | Firebase browser source 僅 `getDoc`；未發現 Firestore write API 或 Realtime Database 的正式玩家寫入 owner。歷史 local candidate 透過 callable 送後端，僅標示 untrusted。 |
| 10. 本機儲存 | 詳見下表。程式未發現自有 IndexedDB 玩家存檔 owner；Firebase `browserLocalPersistence` 的 SDK 身分持久化與遊戲存檔分開。First Play cache／UI session resume 不是遊戲權威。 |
| 11. 跨 UID 風險 | 主存檔已按 UID 分區，核心 save guard 存在；但共用 `four_symbols_active_uid` 跨 tab、部分 sidecar 在模組初始化時固定 UID key、全域 gameplay state 切換 reset 仍需 Phase 3 系統性驗證。不能據此宣稱所有 UID 污染風險已清除。 |
| 12. 既有 Session/Device/Token | 有 Firebase Auth persistence、native 2-minute handoff code、`sixiang_startup_session_ready_v1` 等 UI resume 標記；皆不是 single active game session authority。無後端 activeSession 指標。 |
| 13. Security Rules | `firestore.rules` 允許 signed-in owner 讀取自己的 `/users/{uid}` tree；所有 browser create/update/delete 禁止；其餘路徑包括 `serverUsers` 與 `nativeAuthHandoffs` 全拒絕。這是 repository 規則，不能在部署／查驗前推定線上已一致。 |
| 14. Client 可改哪些數值 | 金幣、EXP、等級、背包、裝備、秘寶、進度、副本／Boss／合成等仍在 browser gameplay state 與 local save 計算。migration candidate 雖做結構／數值範圍驗證，仍明確 `trusted:false`，不等於經濟權威。 |

資料流：Firebase UID 經 bootstrap auth event 交給 startup `resolveSaveFor(uid)`，讀取 own-UID cloud save 與 local repository，再由 `loadGame(resolvedSave)` hydrate 遊戲狀態。`saveGame()` 仍寫 UID local save／metadata。legacy 檔只有明確確認後才本機遷移／備份，或另送後端作 untrusted candidate。

| 本機資料／key | 內容／owner |
| --- | --- |
| `four_symbols_save:{uid}` | 角色、金幣、sharedExp、背包、裝備、技能、秘寶、隊伍、任務／副本等主進度；`js/00-main.js`、`js/startup/account-save-repository.js` |
| `four_symbols_save_meta:{uid}` | ownerUid、schemaVersion 2、localDirty、cloudBaseFingerprint、source、本機 updatedAt；只表示快取來源，不是可信 server revision |
| `four_symbols_active_uid` | 同 origin 共用 active pointer；核心 SAVE_KEY guard 不可移除 |
| `battle_full_version_save_v5`、`four_symbols_legacy_backup:{uid}:{timestamp}` | 舊檔與使用者確認遷移時保留的備份；本 Phase 不搬移、不刪除 |
| UID `accountKey()` sidecars | element-box-state (`js/25-*`)、daily-dungeon-state (`js/27-*`)、exp-pool-growth-state (`js/28-*`)、rested-exp-state (`js/32-*`)、progress (`js/34-*`)、announcement-read／quest-milestones／task-tracker (`js/35-*`)、legacy-abyss-state (`js/36-*`)、abyss-state (`js/59-*`) |
| UID UI／商店 sidecars | patrol-character-index (`js/26-*`)、bulk-sell-quality (`js/53-*`、`js/55-*`)、equipment-shop-daily (`js/equipment-progression.js`、`js/51-*`、`js/56-*`)、equipment-shop-purchases (`js/56-*`) |
| 非權威 cache／UI state | `js/startup/first-play-resource-loader.js` resource completion record、`js/00-main.js` sessionStorage resume marker、SDK Auth persistence；不混作玩家正式進度 |

## C. Completed Work（已實作／驗證證據）

### Session Authority owner

- `functions/src/session-authority.js`：唯一 session policy／transaction owner。
- `functions/index.js`：三支新 callable `createGameSession`、`revokeGameSession`、`protectedTest`；`verifyGameIdentity()` 用 Admin `verifyIdToken(token,true)` 檢查 Firebase 身分與撤銷狀態。
- 兩支既有存檔 callable 改用 `sessions.runProtected(request, operation)`，**授權檢查與資料寫入在同一 Firestore transaction**；不能在 helper 回傳後另做正式寫入。
- native auth handoff 仍只負責登入身分交換。稽核複查發現它可 mint 新 auth_time，故加入必要的相依防護：建立／兌換交接碼均在交易內驗證 source authTime 未被取代；custom token 攜帶 server-issued `sessionSourceAuthTime`，新 session 建立時再次比對，封住「先兌換、取代後才登入」的競態。Firebase revocation 同時檢查來源登入；不改原生 UI 或遊戲資料。
- 取代交易同時寫入新 record／active pointer 並撤銷上一 record。已先完成的交易可線性化於 takeover 前；B takeover 完成之後才開始的 A 操作必須失敗。

### 資料結構與安全資訊

| 路徑 | 欄位／權限 |
| --- | --- |
| `serverUsers/{uid}/sessionAuthority/current` | schemaVersion 1、uid、activeSessionId、status、authTime、revision、createdAt、updatedAt；Admin only |
| `serverUsers/{uid}/sessions/{sessionId}` | schemaVersion 1、uid、sessionId、authTime、revision、credentialHash、status、createdAt、revokedAt；Admin only |
| sessionStorage `four_symbols_game_session_v1:{encodedUid}` | UID＋authTime 綁定的 credential 或 terminal tombstone；僅 bearer cache，不是權威，不存 Firebase ID Token，不存遊戲進度 |

- sessionId 由後端 24 random bytes 產生；credential 由後端 32 random bytes 產生，僅首次回應回傳 raw credential。資料庫只存 SHA-256 hash，以 constant-time compare 驗證。公開 state/event/API 不回傳 credential。
- createdAt／updatedAt／revokedAt 全部 `FieldValue.serverTimestamp()`。本階段不用 lastSeenAt／heartbeat，不以 client clock 判断有效。
- authTime 來自 Firebase 已驗證的 `auth_time` claim（秒），不是 client timestamp。首次無 authority 的 UID 可採納既有登入；之後取代必須是比前次更新、且 5 分鐘內的登入。refresh token 不更新 auth_time，舊登入不能清除 local state 後搶回 session。
- 同一秒兩次登入無法排序：後一 acquisition 回 `SESSION_REAUTH_REQUIRED`，稍後明確重新登入；不做自動循環重試。撤銷保留 authTime tombstone，禁止復活。
- bearer 被複製即屬同一憑證，不能宣稱硬體綁定。sessionStorage clone／XSS 風險列於下方。

### Client owner 與啟動

- `js/firebase/session-client.js`：UID/authTime-bound lifecycle、重入去重、stale response discard、terminal error、logout。
- `js/firebase/firebase-session.js`：Firebase callable adapter／最小公開狀態；`firebase-bootstrap.js` 於 auth observer 與明確登入完成後同步 session；`firebase-auth.js` owner 在 SDK logout 前撤銷。
- `firebase-cloud-save.js` 的受保護呼叫捕捉原 UID，payload 不得被另一 UID 重標；不自動重新送出失敗寫入。
- `firebase-auth-ui.js` 只沿用現有 status 顯示明確 session error，不改版面。沒有新的 gameplay wrapper 或存檔 override。
- session backend 不可用時，原本 Firebase login、UID cloud read、已驗證 local boot 繼續；**受保護寫入一律失敗**。沒有 cloud promotion／local timestamp 覆蓋雲端。
- session 失效只丟棄憑證／記錄 tombstone，不刪角色、背包或 legacy save。重新整理只驗證已有憑證；失效後不自動建立新 session。
- 新模組納入 `scripts/build-production.mjs` 的既有 hashed Firebase graph 與 First Play manifest，沒有新增獨立啟動 owner。

### 驗證紀錄

- 2026-09-19：7 個精準 test files 共 30 tests PASS（session client 8 cases；既有 Firebase auth、trusted backend、account ownership、auth-before-creation、boot architecture、resolved save hydration）。
- `node scripts/build-production.mjs --check` PASS。
- `scripts/test-session-authority-emulator.mjs`：本機 Auth＋Firestore emulator／direct exported handlers PASS：A 成功、B 取代、A 被拒、B 成功；UID 隔離、tampering、logout、私人路徑 rules、兩支既有 protected writer、併發取代／寫入先後、Firebase revoked／disabled identity 均通過。完整 HTTP callable 亦已於下列最終 CI 通過。
- 本機 Functions emulator 被執行環境 Unix socket `EPERM` 限制；未放寬平台權限。測試保留 TCP-only direct callable fallback，完整 HTTP callable 由 GitHub emulator job 驗證。
- `.github/scripts/run-boot-architecture-browser-qa.mjs` 同步新的 session module mock；PR #335／Session Authority run `35430277320` 的 account boot browser gate PASS，確認 backend unavailable 不破壞帳號啟動。
- 第一輪 Repository checks `35430277442` PASS；第一輪 HTTP callable 已跑過 A/B 與併發檢查，最後 revoked-identity assertion 誤將明確 `AUTH_REQUIRED` 視為通用 `UNAUTHENTICATED` 而失敗。修正 test adapter／期望代碼後重跑，不放寬後端檢查、不硬併。
- 原生 Android 身分交換既有精準測試另 6 tests PASS（未執行裝置 OAuth／整套 Android build）。
- 最終程式 `d413304550f015dc164152d1e0229dd68dcdd95b`：Repository checks [35430681904](https://github.com/tf00913225-alt/my-game/actions/runs/35430681904) **SUCCESS**；Session Authority [35430681815](https://github.com/tf00913225-alt/my-game/actions/runs/35430681815) **SUCCESS**。後者包含真實 HTTP callable A/B、rules、並行交易、revoked／disabled identity、native source epoch replay 及 account boot browser QA。
- 併發驗證使用 Firestore document `updateTime` 比較實際提交順序；`serverTimestamp()` 是 server request time，不能把其值誤當 commit ordering。未放寬交易／授權断言。
- `dev@b105f5329d95874820202b6ade78254712200d5e`：Repository checks [35430858607](https://github.com/tf00913225-alt/my-game/actions/runs/35430858607) **SUCCESS**，同 run 的 DEV deployment gate／Cloudflare 部署及部署 SHA 驗證亦 SUCCESS。Game／Cache version 均 `173.65`。
- 同一 dev SHA 的 [Session Authority 35430858389](https://github.com/tf00913225-alt/my-game/actions/runs/35430858389)：emulator job `105865040421` **SUCCESS**；Firebase deploy job `105865475494` **FAILURE**。既有 Secret 存在且 Google Cloud authentication 成功，2026-09-19 08:05:04 UTC 在 `firebaserules.googleapis.com/v1/projects/four-symbols-jianghu:test` 回覆 **403, The caller does not have permission**。
- 失敗發生於 `firestore.rules` compilation test，尚未進入本次 Functions 部署／Rules release。未略過規則、未更換或提升憑證權限。Live Firebase／真正雲端 A/B：**未完成**；沒有為此建立正式環境測試帳號或修改正式玩家資料。

## D. Remaining Work（尚未完成）

1. 由 Firebase／Google Cloud 專案管理者檢查既有部署服務帳號在 `four-symbols-jianghu` 的 Rules 權限與 deny policy，解決已證實的 Rules API 403。至少目前缺乏有效的 `firebaserules.rulesets.test` 存取；後續部署亦需 ruleset／release 寫入權限，不能只讓測試通過。
2. 權限修復後，從**屆時最新 dev** 使用下列既有部署命令部署七支 Functions＋Rules，記錄 exact SHA 與成功證據；不略過規則、不放寬 latest-dev gate。這次文件收尾會推進 dev SHA，舊 `b105f53` job 不能在新 dev 上直接重跑並假稱是最新部署。
3. 部署成功後，以同 UID 兩個獨立登入實際驗證 A SUCCESS → B takeover → A SESSION_REVOKED → B SUCCESS，另確認 UID Y 不受影響。記錄雲端驗收結果後更新本文件、HANDOFF 與 Requirement Batch，才可標記 Phase 1 COMPLETED。
4. Phase 2+ 才做正式 game save schema、完整登入載入隔離、一般進度／高價值資料遷移、operationId、帳本、快照、付款。Phase 1 不把 local progress 升格為正式雲端資料。

## E. Architecture Decisions（永久決策）

後續不得擅自推翻：

| 決策 | 永久規則 |
| --- | --- |
| Single Active Session | 每 UID 只有一個 activeSession；Firebase identity 之外，所有 protected operations 必須驗證 current session；trusted backend 為最終權威 |
| Cloud Authoritative | 正式進度以雲端為準；local 僅 cache／temporary／offline candidate；禁止以較新 local timestamp 整份覆蓋 cloud |
| UID Isolation | 本機／雲端資料均明確綁定 UID；A 登出／B 登入不得继承 A 正式資料；UID 必須由驗證身分取得 |
| Trusted Backend | 金幣、EXP、等級、物品、裝備、秘寶、獎勵、合成、商店、付款／退款等最終由後端驗證／計算，browser 只提意圖 |
| Revision | 正式資料採用 server-owned monotonic revision 做並行控制；本次 session revision 與 save serverRevision 是不同領域，不互相代替 |
| schemaVersion | 每個持久化 schema 都有明確版本，需具相容／遷移策略；不可把 legacy save version 當 cloud schema |
| serverTimestamp | 正式提交／建立／撤銷時間由 server 決定；local 時間不授權、不決定正式先後 |
| operationId / idempotency | 未來有副作用操作必須 UID-scoped 去重與可重送結果；session 失效不能靠重試重取權威；本次 acquisition 回應遺失要求重新登入 |
| Atomic Transaction | session check 與受保護寫入同一 atomic transaction；transaction callback 可重跑，不得內含外部付款／通知等不可重複副作用 |
| Audit Log | 後續記錄可追查的高價值操作與經濟帳本；不得包含 raw credentials／秘密；本次 session record 不是完整 audit |
| Snapshot / Backup | 後續需可驗證還原與版本／UID 一致性；不得以本機 legacy backup 冒充正式 cloud backup |

## F. Known Risks / Technical Debt（不在本 Phase 擴大施工）

- **高：** 現有 browser 可改本機金幣／EXP／物品等；舊 A 仍可操作本機遊戲，但無權經新的 protected backend 寫正式雲端。未遷移的 gameplay 不能宣稱已防作弊。
- **高：** 部分 sidecar key／in-memory singleton 固定於首次 UID，現有 startup 切換帳號未統一 reload/reset 全部 owner；核心 save guard 可降低風險，Phase 3 仍須獨立稽核與實測。
- **高：** 基準缺 `DATA_SECURITY_CONTRACTS.md`；production Functions／Rules／IAM／enabled providers 需實際部署與查驗。repository CORS 不是授權；不可用它取代 session check。
- **高／目前阻塞：** Firebase Rules 部署已確認 IAM 403，線上仍不能宣稱具有本次 session authority。新前端缺少 session 時會拒絕受保護呼叫，但既有已部署 callable 的舊權限模型不會因 GitHub merge 自動更新；必須完成七支 Functions 與規則部署，才能對線上 caller 保證失效 session 被拒絕。
- **高：** 未實作 App Check／全面 rate limit／經濟後端；session bearer 在同 origin JS 可讀，XSS／被複製 credential 不屬硬體防複製機制。新增裝置不能只靠 local deviceId 判斷。
- **中：** sessionStorage 不支援／被清除／create response 遺失／tab 關閉後，已存在 authority 的 UID 需明確重新登入；不自動搶回。匿名帳號不得為恢復權威自動建立另一 UID；應先保留原 UID 並規劃綁定／恢復流程。
- **中：** offline logout 會清除本機憑證並執行 SDK logout，但無法保證遠端 revoke 已提交；回報錯誤。已遺失的 bearer 在新登入取代前仍可能有效，不能把 local signOut 等同 server revoke。
- **中：** 不做背景 heartbeat／idle expiry／session records retention；此階段以 takeover、logout 或 Firebase 身分撤銷失效。未來加入 expiry／清理時不可刪除 authTime tombstone 使舊登入復活。
- **中：** Firebase auth_time 精度為秒；相同秒重登需再明確登入，這是保守拒絕，不以 client timestamp 猜順序。
- **中：** 舊客户端沒有 game session credential，部署後其舊 callable 寫入被拒絕；其 login／readonly read 不受影響。不能為相容而保留無 session 的寫入後門。
- **中：** native auth handoff 既有交易內 delete 後 throw 會 rollback 清理；清理／一次性交接可靠性屬原生登入獨立任務，未更動。部署前舊交接碼／舊 custom login 缺少 source authTime，不能取得新遊戲 session，需原 UID 重新登入／重新產生交接碼。
- **中：** 同一 Firebase project 為多個前端共用。`main` 程式碼未修改；部署 session authority 的後端安全行為會適用同 project 所有 caller。

## Backend 部署與 protected-test 操作

`.github/workflows/session-authority.yml`：PR→dev 執行專屬 emulator gate；merge 至 dev 後，先等該 SHA 的 Repository checks SUCCESS 並確認仍是最新 dev，才部署。沿用既有 Actions Secret `FIREBASE_DEPLOY_SERVICE_ACCOUNT_JSON`；缺少權限／Secret 則 job 失敗，Phase 1 必須保持 BLOCKED。

目前阻塞是服務帳號的 Rules API 權限，不是 Secret 缺失。專案管理者應依最小權限原則核對 `firebaserules.rulesets.test` 與 ruleset／release 部署權限；官方預設角色 `roles/firebaserules.admin` 包含這組權限（[Firebase Rules IAM 角色](https://docs.cloud.google.com/iam/docs/roles-permissions/firebaserules)）。本次沒有授予 IAM 角色，也沒有存取或提交私鑰。修復此 403 不代表後续 Functions 部署權限已驗證，應繼續依實際部署結果處理。

此 workflow 僅在相關程式／規則路徑變更時觸發；純文件合併不會重跑 Firebase 部署。恢復時可由有權限的部署環境 checkout 最新 dev、核對其 CI 綠燈，再執行下面精確範圍的部署命令。不得為重跑而修改 `main`，也不得移除部署 SHA 檢查。

Node.js 22、Java 21（emulator）、Firebase CLI 15.30.0；backend project `four-symbols-jianghu`，region `us-central1`。

```bash
npm --prefix functions ci
npx --yes firebase-tools@15.30.0 emulators:exec --project demo-four-symbols-session --config firebase.session-emulators.json --only auth,firestore,functions 'node scripts/test-session-authority-emulator.mjs'
# 使用有權限的 ADC／正式 Secret，不把服務帳號 JSON 寫入 repo：
npx --yes firebase-tools@15.30.0 deploy --project four-symbols-jianghu --non-interactive --only 'functions:createGameSession,functions:revokeGameSession,functions:protectedTest,functions:bootstrapCloudSave,functions:submitLegacyMigrationCandidate,functions:createNativeAuthHandoff,functions:redeemNativeAuthHandoff,firestore:rules'
```

Cloudflare 的靜態部署不部署 Firebase。獨立部署明列三支新 session、兩支既有 save、兩支必要的 native handoff guard，共七支函式；禁止 `--force` 刪除其他函式。部署鎖沿用既有 native-auth backend concurrency group，避免兩個部署互相覆蓋。若需回退，不可部署回沒有 session check 的 protected writer 或沒有 source epoch 的 token issuer；應先停止受保護寫入並保留資料，再另修。

在 DEV 頁面登入後，可於自己的開發工具呼叫（不要貼出 raw credential／ID Token）：

```js
FourSymbolsFirebase.getUser().uid
FourSymbolsFirebase.getGameSessionState() // 不含 credential
await FourSymbolsFirebase.protectedTest() // {result:"SUCCESS",uid,sessionId,revision}
```

裝置 A 登入 UID X 並確認 SUCCESS；B **獨立重新登入**同 UID X（勿複製 sessionStorage），確認 B SUCCESS；A 再呼叫必須拋 `error.code === "SESSION_REVOKED"`（若憑證不存在／不一致為 SESSION_INVALID）；B 再呼叫仍 SUCCESS。A 可以停在原遊戲畫面。新 session 只影響 X，不能撤銷 UID Y。

Wire callable 名稱是 `protectedTest`（本文 protected-test 的正式 Firebase 名稱），不修改 game save，也不建立角色。payload UID 必須等於驗證身分；session 欄位包含 uid、sessionId、credential、schemaVersion。成功事件／狀態不是將來受保護寫入的通行證，每次仍需 transaction 驗證。

## G. Next Safe Step（每次結束必更新）

**先收尾 Phase 1；未驗收前不要開始 Phase 2。**

1. 先讀本文件、`AGENTS.md`、`ARCHITECTURE_RULES.md`、`SYSTEM_CONTRACTS.md`、`docs/BOOT_ARCHITECTURE.md`、本次 Requirement Batch。
2. 看 `functions/src/session-authority.js`、`functions/index.js`、`js/firebase/session-client.js`、`firebase-session.js`、兩個 Firebase client owners 與 `firestore.rules`。
3. 先處理 Firebase deploy run `35430858389`／job `105865475494` 的 Rules API 403；前置條件是專案管理者提供具有必要 Rules／Functions 部署權限的既有正式身分。依上方部署節從最新 dev 部署，不修改 `main`、不跳過規則或 SHA gate。
4. 核對部署 exact SHA、七支 Functions 與規則實際生效，再完成同 UID A/B／不同 UID 驗收並更新本文件。此前 Phase 1 保持 BLOCKED，Phase 2 不開工。
5. 前置條件滿足後，Phase 2 僅規劃 server-owned save envelope（ownerUid、schemaVersion、revision、server timestamps）、明確 empty/error/conflict 狀態；所有正式寫入接既有 session transaction 入口。
6. 不碰 `main`、戰鬥／VFX／UI 改版、全經濟／背包／秘寶遷移、支付、整份 local overwrite、無關 refactor；先完成可驗證的小步驟。

官方技術依據：[Callable 身分驗證](https://firebase.google.com/docs/functions/callable)、[Firebase auth_time／撤銷檢查](https://firebase.google.com/docs/auth/admin/manage-sessions)、[Firestore 原子交易與重跑](https://firebase.google.com/docs/firestore/manage-data/transactions)。
