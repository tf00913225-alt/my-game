# Overlay回合標籤遮擋最小修法

已實看0b84cc6e 360技能與物品open圖：倒數19移到選單上緣，但正式獨立回合字樣仍留center，被選單遮住。這是CSS投影未共用既有row狀態，非timer未推進。

建議B：原fixedslot CSS依 #battleActionRegion:has(> .turn-target-row.skill-picker-open) 與 .battle-item-open 設單一局部 --battle-turn-bottom；既有row與獨立indicator消費相同底距，indicator另外加 (rowHeight - 20px)/2 以同行垂直置中。無overlay保原top，不加新JS/class/observer。item優先規則沿原後宣告，維持既有skill&&!item語意。兩種offset公式各只宣告一次，不複製兩套來源。

不選A的具體風險：把indicator搬進turnTargetRow會使其繼承整row的battle-hud-hidden/opacity狀態，原updateActionHudVisibility在auto/resolve/演出時藏row；這會改變原獨立常駐回合標籤生命週期，且max-content牌變寬可能遮敵方HUD。若不另重構visibility無法維持原語意，超出本遮擋必要修復。B保DOM/JS與獨立語意較小。

實作需確保無overlay top原值、overlay top:auto/bottom帶置中差，left/right保留且z-index足夠；不可拿row pointer-events/hidden同步到indicator。原最高overlay之上僅文字，不能攔截返回。:has支援需沿專案既有目標瀏覽器，正式Chrome已使用modernCSS；實際新head仍須四尺寸skill/item開/關、回到正常與自然timer前進，量ink與選單不相交/不裁screen、不蓋敵HUD；auto/resolve未操作不得批准。

僅source方案，不含修後畫面批准。未改產品、未開Chrome。
