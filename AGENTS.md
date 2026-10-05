# 專案代理入口與 Routing

`tf00913225-alt/my-game` 的唯一 Agent 工程治理入口。先讀本文件，再依任務路由讀相關 Owner；不得把引用清單當成全部必讀。使用者明確指令優先，產品規格由使用者決定，工程判斷由代理依 Repository 證據負責。

## 核心安全底線

- `main` 是正式版、`dev` 是整合分支：禁止直接修改兩者；main 正式發布必須另有使用者正式授權。禁止 rebase、force push、改寫歷史或 blind overwrite。
- 新工作從即時最新 dev 建獨立 `fix/*`、`feature/*`、`docs/*` 或 `chore/*` 分支，經 PR → dev；建立前查同目的有效 PR／Branch，存在就續接。不同工程不得共用工作分支，一工作一條有效施工線。
- Scope isolation：只改已授權目標及必要相依。先查正式規格、直接程式與測試、既有 Owner／共用工具，再做最小安全修改；不順手重構、改數值、存檔或 UI。
- 同一責任只有一個正式 Owner；優先修原來源，禁止無理由疊 Wrapper／Patch。已證實多 Owner、覆蓋或 Lifecycle 衝突時依路由升級，不因猜測擴大 Audit。
- Cloud／Save／Auth／Payment／Security／Economy／Reward／Migration／不可逆資料操作依相關子系統正式 Gate；Session Authority、reauthentication、Cloud Save Authority、Firestore security、Protected lifecycle、revision、reward once-only、支付驗證與資料保留不得降級或 fail-open。靜態快取更新不得清除玩家資料。
- `assets-library` 僅素材，不改 HTML/CSS/JS/治理文件，不整分支合入 dev/main；指定素材依圖片 Owner 導入。
- 專案內部證據優先；必要外部查詢限直接相關官方技術資料。不自行研究其他遊戲實作。

## 工作生命週期／DEV PR 自動整合規則

已授權施工包含：最新 dev → 獨立分支 → 最小修改與必要驗證 → PR → Latest Head Required CI／任務 Gate → 合併 dev → 合併後確認 → 安全清理 → Closeout。不自動延伸為 dev → main 發布。

合併前重新核對 dev、PR Head、完整 diff／scope、可合併狀態與所有必要 checks。dev 前進時檢查新增差異、相關 Owner／衝突及驗證影響；需要吸收時用正常 merge，不 rebase／force push。Head 變動後重新驗證，禁止用舊 CI 替新 Head 背書。CI 不得取消、略過或降低，失敗先修必要阻塞。

條件全部通過且無未解除高風險阻塞時，直接正常合併 dev，不再要求 MERGE-DEV 二次授權。明令不得合併的 CI Validation Draft PR 維持不可合併；取消二次確認不取代高風險特定授權，也不授權 main 發布。Release Freeze 中依發布 Owner 限制候選整合；P0 發布阻塞及 P1/P2 不得自行變成正常開發禁令。

合併後，確認本工作內容仍存在及相關必要 checks；Runtime／部署特定修改再依風險驗證目標環境。文件-only 不要求 Gameplay Browser QA、Web 部署或玩家實機驗收。工作分支只有在內容已完整吸收、無獨立有效 commit/diff、無活躍 PR 或長期保留理由時才安全刪除，預設不再請示；舊 PR 只有已吸收／明確取代才可關閉。不得刪未吸收內容，永久／指定 backup 分支保留。

清理前檢查可用 Connector/API／已認證 git 等操作；工具未暴露刪除動作不等於沒有權限，若所有可用通道確實均無刪除能力，精確列為待清理及介面限制，不冒稱已結案。正式發布後的 main/dev 有效內容收斂依發布 Owner，不以 commit graph 差異代替實際 diff。

## Resumable Work Protocol

- 可寫入施工前建立唯一且穩定的 Work ID；工作身份是 Work ID＋Branch＋PR，不是對話；建議 `<DOMAIN>-<PURPOSE>-YYYYMMDD`。換 Agent／對話保留身份與既有成果，不重做、不無故建立第二條有效線；取代舊線須留下 replacement 關係。
- GitHub 是耐久狀態，本機／scratch 是暫存。每完成可獨立恢復的最小施工段就 commit 並保存遠端 checkpoint；多步驟／跨對話工作儘早開 PR，未完成可 Draft。續接若有未推本機 commit，先核對並安全保存，不能因遠端未找到就重做。
- PR 是每條 Work ID 的即時狀態 Owner；PR body／最新狀態至少包含 Work ID、Target、Base dev SHA、Branch、Latest Head、Status、Completed、Pending、Next、CI / Deploy。聊天及舊摘要僅線索，不能凌駕即時 Repository。
- 續接順序：使用者指定 PR → Work ID → 任務名稱對照有效 Open PR/Branch → 本輪已知 PR/Branch → HANDOFF 交叉確認 → 歷史 archive 最後才查。不以最新 PR 或 HANDOFF 第一筆猜任務；證據唯一就自主續接，僅多個有效候選無法區分時列候選釐清。
- 每次實際寫入前重新核對工作分支最新 Head；意外前進先讀新增 commit/diff 並安全吸收，禁止盲覆蓋。dev 前進不代表丟棄 checkpoint 或從頭重做。
- 使用者不用維護 SHA、CI、分支表或長篇交接。暫停時留下 `Work ID / Branch / PR / Latest Head / CI / Next`；結案留下 `Work ID / PR / Final Head / Merge SHA / 最新 dev SHA / 清理狀態`。Repository 仍是權威。

## 任務分類與文件 Routing

先選主要任務，再疊加**實際涉及**的子系統路由；沒有符合條件就不載入。一般 Bug 不因數值／文字改成另一值而自動視為架構 Replacement；「以新 Owner 取代舊 Owner／移除功能」才走取代路由。文件存在不表示須完整讀其歷史。

| 任務／證據 | 必要入口與讀取範圍 |
|---|---|
| 普通 Bug／fix／failure／CI failure | `docs/BUG_FIX_FAST_PATH.md`＋直接相關程式、測試、正式規格；不預設讀 HANDOFF、CLAUDE、自主修復、全架構、完整 Gate 或 Release |
| UI／CSS／DOM／Canvas／viewport／responsive／modal／navigation／touch／interaction／玩家可見畫面 | 完整 `UI_GUIDELINES.md`；只改純後端／資料公式不觸及畫面時不讀 |
| 物品階級／稀有度 | 額外 `docs/ITEM_RARITY_UI_SPEC.md`；僅補品數值或物品邏輯不觸發稀有度規格 |
| 點陣圖片新增／替換／轉檔／導入 | `docs/IMAGE_ASSET_SPEC.md` |
| 怪物立繪 | `MONSTER_PORTRAIT_SPEC.md`＋`docs/MONSTER_PORTRAIT_SPEC_V1.md`；已生成素材走既有快速導入，不重做生成。Boss 術語僅讀後者第 0 節 |
| Replacement／Convergence／Removal／已證實多 Owner、Wrapper/Patch 疊加、Lifecycle 衝突、跨模組責任重整／明確架構工程 | 完整 `ARCHITECTURE_RULES.md`＋`docs/CHANGE_SAFETY_REPLACEMENT_CONTRACT.md`；單純 Additive、小型 Bug／數值修正不預設觸發 |
| Bug 達 Fast Path 第四節升級證據／明確架構級 Bug 修復 | 再完整讀 `docs/BUG_REPAIR_DOD_OWNER_CONVERGENCE_GATE.md`；普通 Bug 完成狀態與原症狀驗證依 Fast Path，不啟用完整 Gate |
| 明確指定 tests-only 受控自主修復模式／CI Validation-only | `AUTONOMOUS_REPAIR_CONTRACT.md`；一般 Bug 不自動啟用此舊受限模式 |
| Gameplay／Combat／屬性／狀態／技能／怪物數值 | `SYSTEM_CONTRACTS.md` **相關章節**＋該玩法正式 Owner／測試；不讀無關玩法或 Cloud 歷史 |
| Auth／Session Authority／reauthentication | `DATA_SECURITY_CONTRACTS.md`＋`docs/FIREBASE_AUTH_CLOUD_SAVE.md`；Session 加讀 `docs/CLOUD_SAVE_IMPLEMENTATION_PROGRESS.md` 的「Session Authority owner」「Backend 部署與 protected-test 操作」及直接 Owner／emulator tests，不讀整份進度歷史 |
| Cloud Save／Firestore／server envelope | `DATA_SECURITY_CONTRACTS.md`＋`docs/FIREBASE_TRUSTED_CLOUD_SAVE_BACKEND.md`＋實際影響的 save／rules Owner／tests |
| Save migration／schema／recovery／restore | `DATA_SECURITY_CONTRACTS.md`；按範圍讀 `docs/CLOUD_SAVE_PHASE4_CONTRACT.md`、`docs/CLOUD_CANONICAL_SCHEMA_AND_RECOVERY.md`、`docs/CLOUD_CHARACTER_AUTHORITY_MIGRATION_DESIGN.md`；持久化 key/schema 改動加讀 `docs/PERSISTED_STATE_REGISTRY.md` |
| Protected battle lifecycle／Economy／Reward／once-only transaction | `DATA_SECURITY_CONTRACTS.md`＋`docs/CLOUD_OPERATION_SETTLEMENT_CONTRACT.md` 的相關子系統章節與直接正式 Owner／integration/emulator tests；offline 權威加讀 `docs/OFFLINE_AUTHORITY_POLICY.md` |
| Payment／Security／不可逆資料操作 | `DATA_SECURITY_CONTRACTS.md`＋直接相關子系統正式契約、驗證／授權 Gate；找不到正式支付／不可逆操作契約不得猜測或放寬 |
| Boot／startup | `docs/BOOT_ARCHITECTURE.md`；涉及身份／存檔再疊加對應高風險路由 |
| Release／Candidate／Freeze／dev → main／正式版本／P0/P1/P2 Release Readiness／Exact-HEAD production verification | 完整 `docs/RELEASE_VERIFICATION_RULES.md`；一般 dev Bug 不觸發完整發布契約，既有 CI/deploy gate 仍正常執行 |
| docs／governance-only | 直接相關文件與交叉引用、文件 checks；不要求 Gameplay QA |
| 接續既有 PR | 先 PR／Branch／Latest Head／CI／Next，再走上述實際工作路由；HANDOFF 只交叉確認，archive 不自動讀 |

`HANDOFF.md` 僅保留專案級現在狀態、重大架構／migration 結果與跨工程注意事項，**不是每次施工必讀**；普通 Bug 流水帳、舊 SHA/CI/checkpoint 留 PR／既有歷史位置。不同 Owner 不複製完整規範，僅引用；不得用「較嚴格優先」重新啟用已退休的 blanket-read／全面 Audit。

## 最小必要驗證

| 風險 | 驗證 |
|---|---|
| 低：純文案、静態文字、圖片替換、低風險 CSS 微調、無邏輯文件修正 | focused verification／targeted test／static check＋必要 GitHub CI；圖片仍遵守資產 Gate，畫面實際變化仍驗證相應症狀 |
| 中：一般邏輯／UI 互動修改 | targeted regression＋相關 build/check＋Required CI＋必要 Browser QA |
| 高：核心 Combat／Save／Cloud／Auth／Economy／Reward／Migration／Payment／Security | 子系統正式 Gate、完整必要 regression、integration／emulator／Browser QA／部署驗證（按相關性） |

Gameplay 核心／Combat／Save／Cloud／Auth／Economy／Reward／data migration、同根因復發或容易再被修改破壞的故障機制必須保留 regression test。低風險無邏輯修改可依證據 focused verification，不強制每次新建永久 automated test；不得刪除既有有效測試或放寬斷言掩蓋錯誤。

驗證與風險成比例：不為小文字跑全 Browser、小 CSS 跑全 Gameplay；CI 已涵蓋的高成本驗證不在本機重複全套，除非除錯／環境差異有具體必要。不得為一次性 QA 新增永久 workflow 或無限擴張測試。CI 必須維持 Latest Head，合併快照 checks 需能綁定當前 PR Head/Base；原症狀驗證不能由 CI 綠燈代替，未取得證據就如實報目前階段。

## GitHub 遠端操作與開發站

已連線 Connector/API 與本機 git/gh 憑證不同；遠端寫入優先已授權 Connector/API（branch/blob/tree/commit/ref/PR/checks/merge），本機 Git 用於檢查、diff、修改與測試。CLI 沒憑證不能誤報 GitHub 未授權，改走可用已授權通道；僅通道明確 authentication/permission 錯誤或缺能力才列阻塞。

DEV 固定 SHA 驗證網址：`https://dev.four-symbols-dev.pages.dev`；不得用 root `https://four-symbols-dev.pages.dev` 或 GitHack/RawCDN 當 dev commit 證據。既有 Repository checks／Release Gate／部署 workflow 維持；Game/Cache 版本唯一來源 `release/release.json`，不得因普通修復自動升正式版。

## Permanent Rule Growth Control

單一 Bug 不預設新增永久規範。新增前先查已有 Owner、能否修改它、是否為反覆系統風險、不新增是否有實際安全／維護問題；優先 replace/consolidate，避免 append。同一責任一規範 Owner，其他文件只引用；發現重複、衝突、過時規則主動收斂。Agent 自行依風險與證據決定 Owner、退場、文件與測試，不要求非技術負責人處理工程治理；使用者主要決定產品／遊戲結果。
