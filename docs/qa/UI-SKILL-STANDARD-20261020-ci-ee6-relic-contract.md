# ee6 core：秘寶裝備控制殘留34px預期

Work ID UI-SKILL-STANDARD-20261020 / 原Branch / PR955，baseee6d56180d6b9a6ae697af0c32e2a9fa7ba7774f。正常CI40003608728/a1 core120588757997首錯tests/relic-battle-cutin-icon-readability-20260919.test.js115，殘留min-height34px。

直接判因：正式css/55-team-relic-system.css107經git blame指向已存在productcommitf817bf18，.team-relic-card .team-relic-equip採calc(44 * var(--ui-length-unit,1px))。本測試第9行已有正式authoredUiCss單位換算helper，所以實際待驗值44，不是單位讀錯或本輪臨時放大。只把殘留34更新為44並寫清觸控契約；正式裝備/已裝備文字、能力限制、內部診斷不外露、canonical teamLoadout save路徑、圖示/cutin timing等原斷言完整保留。不改runtimeCSS/JS/數值/存檔/Chrome工具或其他UI。

focused兩suite（relic-battle-cutin-icon-readability、v174-relic-navigation-button-polish）PASS，diffcheck PASS。引用segment16既有四尺寸呈現/操作證據，已實看360x640-main-relic-owned-20-top.png；該圖是歷史detail，不能假稱本Headoverview card新pointer驗證。本輪不重做已通過高成本UI矩陣，也不新增產品畫面驗收結論。

GitHub即時ee6快照：同run ui_browser120588757770、portrait120588757920、battle120588758020、Session120588758687、daily/tower/AdventurePhase2E success。這僅支持該快照；新Head仍須正常必要CI，不以舊Head綠燈代新Head。core/adventure_ui failure，Boss/Abyss仍in_progress於讀取時；未取消。Adventure formalguide由Story原Owner負責，未在此修；#987工具獨立，未混入。

獨立Scope審核只針對此一預期與直接產品來源，列明歷史畫面限制。未合併或部署；待最新Head必要checks及其他尚未解除Gate。PWA/loading/先前測試修正全保留，無探索接線或範圍擴大。

Reviewer /root/daily_scope已實看歷史detail圖、核對一行diff與f817bf18來源，窄scope通過；沒有把歷史detail當新卡片input證據。GitHub狀態由主Owner本輪API讀取，非審核代理另跑測試。工作樹除本測試與本狀態報告無其他修改。
