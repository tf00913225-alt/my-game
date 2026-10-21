# e5e307 預合併相依核對（歷史快照）

Work ID UI-SKILL-STANDARD-20261020 / PR #955。2026-10-21 即時 GitHub dev 為 e5e307122f84edd3fda7d12c6395336c8b2a51c9（#977），施工仍基於正常合併的 758fe75。

已 fetch 並完整列出新增 commits／檔案。技能核心 `functions/src/skill-progression-core.js`、`skill-loadout-policy-v1.json`、`canonical-skill-loadout.js`、`js/60-v173.64-skill-progression-rebalance.js` 與兩份 loadout/parity fixture 在 758→e5e307 的 `git diff --exit-code` 無差異。這是直接相依核對，不宣稱新 dev 已驗收。

新增章節工程包含地圖素材／節點與引導、物品位置唯讀入口、hero qualification 與生成 policy、CI fixtures。已讀 `js/00-main.js` 完整新增 diff：有原教學 input-guide hold，以及 tutorial 下關閉自動入口；非本 UI 工程修改。`js/35` 新增唯讀物品 locator/data attributes，不改共用獎勵 toast 函式。尚未完成其他新增直接 Owner／生成 policy 語義及 merge 衝突審查，故不盲吸收，也不能用現有 00936719 圖片背書 e5e307。

此為當時未吸收的預審紀錄；後續正常合併來源與未驗清單以 [e5e307 integration](UI-SKILL-STANDARD-20261020-dev-e5e307-integration.md) 及 PR #955 最新狀態為準。保留所有 UI 成果，不重建分支，不 rebase／force push，不混入 Chrome 工程。新快照必要 CI／相關原症狀驗證仍需完成。
