# 戰鬥重複回合標籤只讀診斷

已實看9b584af2/natural-entry-diagnostic/360x640/battle-target-prompt.png：左側古銅倒數框「第1回合 20」及其右方獨立金色「第1回合」同時出現。這是兩個既有文字節點同時投影，非兩個回合計時器證據。該圖是diagnostic，不據此批准新88prompt戰場布局。

正式契約 SYSTEM72：回合標籤由正式戰場獨立顯示；147的500ms Auto round prompt為另有正式時限的observer，不應移除或改其生命週期。index1408 #battleTurnIndicator 為獨立標籤；JS00 startTurn11411更新第N回合+wave字樣，換波3985更新wave，clearBattleLog32166初值。固定格位CSS77定位該獨立標籤。JS54沒有第二個回合文字Owner。

index1419 #turnTargetRow另存舊.turn-number（含 #turnNumber）和 #timer；JS00開始角色宣告11662設timer20、11665更新turnNumber、呼叫updateTimer；updateTimer12354只投影原timer、danger與tick動畫。syncTurnTimerWithBattlePickers12035及updateActionHudVisibility32236沿原row套picker/item/hidden狀態。不能刪整個row、timer節點、更新函式、timeout或auto/manual守衛。

最小純UI建議：在既有固定格位CSS正式Owner內，對固定格位戰場的 #turnTargetRow > .turn-number 設display:none；保留DOM/#turnNumber原更新相容與獨立#battleTurnIndicator（含wave資訊），#timer及其動畫、row原定位與picker狀態不動。不需新JS/timer/wrapper或新回合Owner，也不應隱藏正式auto500ms提示。這是退役重複可見文字，不是縮字或遮擋必要資訊。

必要驗證：原回合/timeout/auto lifecycle相關targeted不變；真手動自然入口看只一個常駐回合標籤、倒數仍更新且不被提示/選單蓋住；至少最短手機與桌面確認timer-only原row縮寬後定位/元素匣/提示不碰撞；真auto500ms提示與wave標籤未改。尚無修後實圖，不預批。未改tracked、未開Chrome。
