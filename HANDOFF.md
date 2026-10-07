# 《四象江湖傳》目前專案交接摘要

本文件提供專案級現在狀態、重要跨工程結果與索引。治理／讀取路由由 `AGENTS.md` 唯一控制；HANDOFF 不再是每次施工必讀，也不承擔個別 Work 的即時 checkpoint。

## 版本與分支狀態

- Game / Cache：`173.73 / 173.73`，來源 `release/release.json`；根 npm metadata `173.73.0` 為單向投影，不是另一個遊戲版本 Owner。
- 正式 main：V173.73。開工觀測 `f63d69dbfa66ba75637d1c3cd7fcc7d74782e356`；本治理工程禁止修改。
- dev：NORMAL DEVELOPMENT；沒有本輪啟動的 Release Freeze。本治理工程開工觀測 `76f35f0014a6a87ef7d821eb243bfd892f9ed5c1`（已合併 Fire #805）。以上為 dated observation，續接必須重新查即時 refs／checks，不提交自指 latest SHA 迴圈。
- DEV 固定驗證站：`https://dev.four-symbols-dev.pages.dev`；部署最新 SHA／CI 狀態查對應 workflow／Work PR，不從舊版本或本文件推定。

## 有效工程索引（2026-10-05 UTC 開工觀測）

| 工程 | 即時狀態 Owner／下一步 |
|---|---|
| WIND-EX-LOW-HP-EVASION-20261005 | PR #806；`fix: make Wind EX low-HP bonus additive final evasion`。既有風 EX 工作續接該 PR／Branch／Latest Head／CI，不重開；未合併的規格讀該 PR Head，不假定 dev 已存在 |
| ENGINEERING-GOVERNANCE-SLIMDOWN-20261005 | `docs/engineering-governance-slimdown-20261005` → dev；本工作 PR 管理規範瘦身的 CI／整合／清理，不接手 #806 Runtime |

Open PR 清單只反映觀測時點。沒有 Open PR 不代表整個子系統已完成：續接仍依 Work ID／任務查有效 Branch 與已合併 PR 的最新結案證據。

## 近期重要架構／migration 結果

- HERO-CORE-PHASE1-20261007 建立 `functions/src/hero-core.js` 唯一英雄 Domain 與既有 UID main-save extension；HERO-BATTLE-PHASE2A-20261007 接入既有 Battle Owner 的 `heroNpc` 身份、6-unit 容量、普攻／受擊／死亡／合法復活／Initiative／Statistics，不重設 Core 或永久 schema。HERO-BATTLE-PHASE2B-20261008（PR #833）接續同一 Owner 的戰鬥暫存怒氣、技能、兩項被動與指定立繪；完整契約／後續邊界見 `docs/HERO_SYSTEM_V1.md`。英雄頁／Reward／Equipment 未施工；CI／整合／驗收即時結果查 Work PR。

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
