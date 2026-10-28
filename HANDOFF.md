# 《四象江湖傳》目前專案交接摘要

本文件提供專案級現在狀態、重要跨工程結果與索引。治理／讀取路由由 `AGENTS.md` 唯一控制；HANDOFF 不再是每次施工必讀，也不承擔個別 Work 的即時 checkpoint。

## 正式版本與發布狀態（2026-10-12 核對）

- 正式 main：V173.73；SHA `f63d69dbfa66ba75637d1c3cd7fcc7d74782e356`。2026-10-03 [main CI](https://github.com/tf00913225-alt/my-game/actions/runs/37120857492) 與 [Production deployment](https://github.com/tf00913225-alt/my-game/actions/runs/37121755907) 均 SUCCESS，部署日誌直接核對同一 SHA；正式 Requirements 23／23 VERIFIED。
- 正式驗證基線：Node 263／263、JS 352／352、靜態資源 405、HTML ID 255；六尺寸 responsive、鍛造 390×844／412×915、戰鬥／音效正式瀏覽器 QA PASS。詳細基線及歷史 V173.72 證據見 [CHECK_REPORT.txt](CHECK_REPORT.txt)，本次只核對既有證據，不重新宣稱真機驗收。
- V173.73 已發布、Freeze 已結束；dev 維持 NORMAL DEVELOPMENT，沒有本次啟動的新候選。發布結果、當時有效內容收斂與邊界見 [發布後結案紀錄](docs/v17373-post-release-closeout-20261003.json) 及 [scope](release/v17373-scope.json)；scope 的 releaseCandidateSha 與 historicalReleaseFreeze 是歷史證據，不是有效施工限制。
- Game／Cache 唯一來源 `release/release.json`：173.73／173.73；dev 根 npm metadata 173.73.0 已正確投影。main 舊 package metadata 不另行直接修改，隨未來授權的正式發布整合。
- dev 後續功能不因仍顯示 V173.73 而視為已正式發布。本次僅更新 dev 文件，沒有 main 發布授權，也沒有修改 main／玩家公告／Runtime。

## 施工狀態與續接入口

### 2026-10-26 週報驗收界線

- 已發布 main 仍為上列 V173.73／`f63d69dbfa66ba75637d1c3cd7fcc7d74782e356`；本週工作沒有正式發布。dev 文件整理基線為 `3d74c4aae68c9dcf21df4319d7bea1f4d3dc16aa`；Note9 實測及已完成部署驗收僅對應 `2e2de82eb0c80f4ba24796fd20b033bafcd81f6d`，不得用其結果替新 SHA 背書。
- CI 初始化 fixture 修正 #1002、桃溪／Story 觸控修正 #1003 已合入 dev。後續使用者決定 UI／版面問題略過待整體改版；元素匣捲動 #1004 只保存成果，不合併或部署，#955 仍暫停。
- Android：Note9 SM-N960F／Android 10／Chrome 155.0.8059.79，28.94 分鐘流程及短程補驗完成部分項目；自動戰鬥透過既有免費模擬廣告正常取得時數、出手與停止。燃燒完整持續時間、專用 Buff 與實際冶煉交易仍未驗證；完整記錄與條件見 [本週證據](docs/qa/WEEKLY-ANDROID-20261026.txt)。不得標記 P1-3 全過。
- 不建立發布候選：大型 UI／戰鬥 UI／Cloud 工作尚未收斂，仍缺固定候選及其完整 CI、main-target、exact-SHA 部署、正式網址／快取讀回與完整 Android 驗收。Cloud Save 完整跨裝置恢復、權威驗證與一次性獎勵保護仍依原 Gate，維持 fail-closed。

即時 Work ID／Branch／PR／Latest Head／CI／Next 由各工作 PR 管理；依 `AGENTS.md` 續接，不把本文件或舊 Open PR 表當成有效施工清單。2026-10-05 的 #806 與治理瘦身施工索引已是歷史觀測，其紀錄保留於 Git history／原 PR。

DEV 固定驗證站：`https://dev.four-symbols-dev.pages.dev`。部署 SHA、必要 checks 及驗收查對應 workflow／Work PR，不從版本字串或本文件推定。main/dev 歷史分叉與提交數不能單獨證明有正式內容尚未吸收；回流需核對實際有效 diff。

## 近期重要架構／migration 結果

- HERO-ACQUISITION-20261012（PR #871）施工永久取得來源：同 UID 的登入日期／章節票券、唯一 claims／receipts／ledger 與既有 Core 快取投影。普通戰鬥仍由 Client 模擬，不證明戰鬥結果、不延伸 frozen Server Battle；舊本機旗標不直接取得 Hero。後續 Cloud restore／migration／publication 必須保留並明確映射這些權益來源，不能以舊角色快照回滾或重開領取。完整 Cloud Save／空白換機角色恢復仍未完成；功能驗收與部署狀態查該 PR，正式契約見 docs/HERO_SYSTEM_V1.md。

- HERO-CORE-PHASE1-20261007 建立 `functions/src/hero-core.js` 唯一英雄 Domain 與既有 UID main-save extension；HERO-BATTLE-PHASE2A-20261007 接入既有 Battle Owner 的 `heroNpc` 身份、6-unit 容量、普攻／受擊／死亡／合法復活／Initiative／Statistics，不重設 Core 或永久 schema。HERO-BATTLE-PHASE2B-20261008（PR #833）接續同一 Owner 的戰鬥暫存怒氣、技能、兩項被動與指定立繪；完整契約／後續邊界見 `docs/HERO_SYSTEM_V1.md`。[PR #866](https://github.com/tf00913225-alt/my-game/pull/866) 已將主城英雄入口、資料頁與 session-only 最多三人編隊合入 dev；[PR #867](https://github.com/tf00913225-alt/my-game/pull/867) 收斂立繪 decode 驗收。這些尚未發布 main，不宣稱正式編隊持久化或 Reward／Equipment 已完成；CI／整合／驗收即時結果查各 Work PR。

- Monster Balance Owner Phase 1–2F 已收斂七模式：Wild、Daily、Tower、Abyss、Adventure、Personal Boss、World Boss。後續平衡校正是新工程，不重開 migration；`docs/MONSTER_BALANCE_OWNER_FINAL.md` 為總結果索引，`SYSTEM_CONTRACTS.md` 的七模式章節為跨模式契約；退場圖 `docs/monster-balance-owner-retirement-map.json`。
- Level Suppression V2 已採 `1.01 ^ levelDiff`、無人工 cap/floor，唯一 `js/00-main.js::getDamageLevelMultiplier()`；正式規格 `docs/LEVEL_SUPPRESSION_V2_20261005.md` 及 `SYSTEM_CONTRACTS.md` 相關章節。與 Hit／Evasion／Status 分離。
- Battle target identity 已由 Core snapshot 收斂；PR #804 及後續 Fire #805 已合併。擊殺後追擊只能轉移至原合法存活快照，稍後復活者不加入；規格 `docs/FIRE_FOLLOWUP_LETHAL_RETARGET_20261005.md` 及 `SYSTEM_CONTRACTS.md` 戰鬥目標章節。合併不代表部署／清理已完成，查 PR 最新證據。
- 前景導覽與補品恢復已收斂同一正式 Owner；詳見 `docs/FOREGROUND_NAV_STARTER_POTION_20261004.md`、`UI_GUIDELINES.md` 的背包與物品 Owner 章節。不要恢復舊導覽/CSS 或另增恢復公式。
- Session CI wait 與 package metadata 已有正式控制來源：`.github/scripts/wait-session-repository-checks.mjs`、發布 Owner 第 4A 節；不要恢復舊 wait loop 或新增版本檔。

## 高風險雲端結果與边界索引

- Cloud Save 與 Session 仍採伺服器權威及 fail-closed；相關 Owner／部署／protected-test 操作在 `docs/CLOUD_SAVE_IMPLEMENTATION_PROGRESS.md` 的對應章節，安全底線由 `DATA_SECURITY_CONTRACTS.md` 控制。舊進度候選不等於已開放能力。
- PR #802 已建立受保護 restricted Forest PREPARED instance；這不是完整多回合裁決、勝利或獎勵授權。後續工程從該 PR 最新證據與 `docs/CLOUD_OPERATION_SETTLEMENT_CONTRACT.md` 的 restricted lifecycle 章節接續，不重做已封存來源，也不擅自開放 reward／舊資料採納／第二裝置恢復。
- 整體 Phase 4 不從單一已合併工程推定完成。帳號／存檔／migration／支付／reward once-only 的剩餘 Gate 查相關契約與 Work PR；本治理工作未修改、未重新驗收其 Runtime。

## 跨工程注意事項與維護

- PR 是每條 Work 的即時狀態 Owner，保存 CI、SHA、部署、Pending、Next 與 Closeout；續接解析／安全分支清理依 `AGENTS.md`，不要求使用者維護交接。
- HANDOFF 只在重要跨工程狀態或架構結果改變時更新摘要；普通 Bug 的逐步 checkpoint／舊 CI／舊 SHA 留 PR。已被後續 PR 取代的 pending 不帶進目前摘要。
- `SYSTEM_CONTRACTS.md` 只讀任務相關章節；UI、圖片、立繪、Cloud、安全、Release 依 AGENTS 路由按需載入，各專項 Owner 不由 HANDOFF 複製。

## 歷史證據

完整原始 HANDOFF（4929 行、2026-08-25～2026-10-05）安全歸檔於 [2026-08-25_2026-10-05.md](docs/handoff/archive/2026-08-25_2026-10-05.md)，含原始 source SHA／內容 SHA-256；原文逐字保留，沒有丟棄施工、CI、版本或歷史限制證據。

archive 僅供最後階段交叉查證，其「每次必讀／每次追加紀錄／main 最新才算結束」等舊指令已退休，不再生效。原始相對路徑以 Repository 根目錄解讀，舊 anchor 可從 archive 所指 source commit 檢索，不要求預讀完整歷史。
