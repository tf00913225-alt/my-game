# 658 CI：詞條位置標籤與技能頁首契約

Work ID UI-SKILL-STANDARD-20261020 / 原Branch / PR955；base658f237c。正常CI40000524568/a1 core120575591997首錯為reforge-eligibility detail exact slots；ui120575591920首錯為run-skill-progression QA225標題與返回等高。只兩份test/QA修改，不重做商店或英雄已通過回歸，不改產品/Story/Chrome工具/PWA/loading。

冶煉正式Owner js/equipment-progression.js:952由既有productcommit3e9df4fe加入「詞條 N：」位置標籤；reforge-slot-presentation正式測試亦要求保留原位置。原eligibility測試只比slotText，故UI正確呈現標籤仍失敗。本輪三處（普通detail、locked、reload）精確比較canonical數值/順序加序號；不是刪除或模糊比對。第一次針對回歸又在reload同根因失敗，補齊同一Owner三處後PASS；隨機數值不硬編。原cost/gold/ore、base屬性、鎖定、不足資源、missing owner/save失敗回滾、UID與reload等保留。原browser12組驗收及slot-presentation共2tests PASS。

技能頁實畫四尺寸360×640/393×873/412×915/1280×800，以原production loader與原PREPARE_RUNTIME、原skin採集段執行。360雕牌38px、返回68.25×44px，中心同45；四尺寸字墨皆在原雕牌safe範圍，沒有產品布局故障證據。QA強制等高反而會鼓勵縮小返回或拉大雕牌；改驗垂直中心差<.1且返回screen寬高>=44，保留原無重疊、比例/三tracks、字墨安全區、原素材decode、分頁框穩定/關閉清理及唯一scroller等斷言。對四份實測skin執行原完整header assertion block全PASS，不將此稱完整技能玩法suite PASS；全套交最新Head必要CI，不重複先前高成本玩法。

Art/Input/Scope三獨審實看頁首與diff，皆確認窄範圍無新增問題；不延伸冶煉美術/完整技能操作/自然戰鬥/實機/全UI驗收。來源hash、header資料、四張圖與審核見evidence/UI-SKILL-STANDARD-20261020/ci-658-followup。首次採集helper定位字串失敗未啟Chrome、未作產品證據；修helper後有效四尺寸保留。syntax/diffcheck PASS。

本段不聲稱adventure失敗已重新判因或解除，仍待獨立確認Story相依；工具#987由原Owner交付。本工作未合併/部署。下一步只讀新Head必要CI真首錯，依Gate完成後才整合；不重跑舊SHA、不取消必要CI、不混探索接線。
