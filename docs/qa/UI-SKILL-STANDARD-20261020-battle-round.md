# 戰場回合標籤：相依核對後的實畫問題

Work ID: UI-SKILL-STANDARD-20261020；Branch: fix/ui-skill-standard-polish-20261020；PR: #955。

來源基準 9b584af2909008d82da52a26332dd0247bc59c8a 已正常吸收 dev 758fe75。技能配置相依未變更；兩裝置輸入 smoke 已另存，不能替代戰場四尺寸。

原 bee66 360 採集仍有入場動畫，不能驗收提示；後續 9b 自然入場完成診斷圖才可見真提示，complete=false、diagnosticOnly=true。舊行盒 Range 外溢不代表重要文字遭裁切。兩輪原報告、圖與診斷審核保留於 battle-round-duplicate-source。

實際缺陷：舊 turnTargetRow .turn-number 與正式 battleTurnIndicator 同時顯示第 1 回合。SYSTEM_CONTRACTS 要求正式獨立回合標籤；本段只於原 fixed-slot 樣式隱藏舊文字，保留 DOM 與 turnNumber 直接更新相容、原 timer/updateTimer/turn/戰鬥流程。沒有縮小字體、改倒數或更動隊伍/數值。正式產物由原 builder 生成。

必要 targeted tests：battle-information-removal + fixed-slot-battlefield-rendering-v2，4 通過；build/check 通過。尚未驗收：修後四尺寸真提示/倒數裁切/唯一可見回合標籤、三方獨立審核、Latest Head 必要 CI、部署。原自然計時 QA 不清 timer、不凍結時鐘、不暖機，獨立 profile 結束不冒稱正式戰鬥完整還原或勝敗流程驗收。Chrome 工程維持獨立。
