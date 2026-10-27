# 一般導覽：非戰鬥 context 桌面鍵盤補驗

Work ID UI-SKILL-STANDARD-20261020 / 原branch / PR955，固定source2f685fa79fabbd8a59b707dedcd3c68e8b3fb71a。續接前本機clean；正常CI39915800014/attempt1/pull_request queued，未有新首失敗，不用舊2b96失敗為本Head背書。上段兩個預期修復已保存，不重做。

精確本段只有1280×800隔離桌面：原Tab聚焦+Enter進野怪區→原底nav返回主城；原玩法入口→首領總覽→底nav返回玩法；四象塔總覽→底nav返回玩法→主城。沒有程式click/focus替代，也沒有啟動挑戰/戰鬥/交易。8個焦點目標focus-visible/EFP/≥44px，8個context場景單一shell、game-overlay-layer、無隱藏/遮擋、battleActive=false；原nav兩個Owner與e496逐byte相同。引用既有主城/副本四尺寸底板/按下/返回，不重新全套。

[16張場景圖、原keyboard steps/幾何/部分trusted nav事件、report/hash與三方獨審](evidence/UI-SKILL-STANDARD-20261020/nav-keyboard-context-reviewed)。美術看4張原返回focus，輸入4focus與2returned共6張，scope2張；皆僅此nav子項，不批准整個頁面的文字或美術。QA capture的nav可見文字採藝術圖/aria-hidden，0 text nodes不等於字級測試通過。

首輪helper漏送Enter的CDP text carriage return，沒有原生keypress/click而未切頁；補正原生封包後trusted事件與切頁成立。沒有修改產品處理鍵盤，首輪失敗圖/JSON獨立excluded，非PASS；早期helper擷取marker錯誤未啟動Chrome，不作產品證據。隔離profile已清除、runtimeRestoreExact=false，不冒稱精確還原真帳號。

停止於本精確剩項實際補驗＋獨審＋遠端證據保存；無已證實產品故障，不猜測改碼、不新增Gate。Latest Head必要CI仍待，不合併部署。手機鍵盤、Escape、瀏覽器返回、patrol/abyss等其他context與禁用/載入/失敗、實體裝置仍未在本段驗證；已有對應舊證據照清單引用，不能外推本次。

元素匣入口移除、倍率及PWA未開新批；倍率須與#983正式時間/VFX Owner協調，PWA依原scaler/安全區/Auth-Save-cache返回；本段不接觸#983底部操作區/敵我間距/技能名，也不提前吸收尚未正常dev整合的#976 b400。Chrome共同Gate不取代此UI獨立補驗，其他未驗狀態仍保留ledger。
