# cc224766 Overlay回合呈現限定審核

實看四尺寸skill-open/item-open各8圖，及各尺寸battle-hud4圖，共12圖。倒數與獨立回合字樣現在隨選單移到同牌，選單不再蓋住回合；三手機及桌面牌與screen/敵方名稱條可區分，未見本子集文字裁切。空技能四列/空補品內容與返回完整；不得據空資料擴稱已填技能/補品效果合格。

原0b84→cc CSS diff核實：共享局部--battle-turn-overlay-bottom由既有row兩種class投影、item後宣告優先；row/indicator消費同一offset；牌寬180、字樣left68/z-index調整沿原Owner。index/JS diff空，indicator仍是原row兄弟，原auto/resolve/presentation生命週期未移入auto-hidden row。沒有新timer/flag/observer/DOM或遊戲邏輯更動。技能牌另預留敵身份上方clear band，屬已證遮擋的必要布局，不是全域補丁。

8報告complete/clean/sourceUnchanged true、同Headcc224766；獨立比對baseline→final actors/gold/inventory/equipment/monsters/token/turn/config/auto/元素匣相同。真自然timer20→19，該declare窗口saveCalls均0→0，raw/meta相同；不外推startup/entry零副作用。runtimeRestoreExact false、owned profileRemoved true，不假稱還原戰鬥私有狀態。

可限定接受原技能/補品空overlay真開關、常駐回合/倒數可見與返回HUD子集。未使用技能/物品，未切符咒/填滿/長名、未auto/resolution/結算/波次/真硬體；normal攻擊prompt同Head仍待另補。來源保留auto生命週期不等於auto畫面已驗。未改產品、未開Chrome。

## 同Head普通攻擊提示補驗

另實看 fixedslot-prompt88-cc224766/natural-entry-qualified 四尺寸各targetprompt，共4圖，核4report complete/clean/sourceUnchanged且相同Head，受監測domain baseline/final相同。新同牌回合/倒數完整，普通攻擊提示與返回不重疊該牌，未見我方HUD遮擋。限定解除本筆記normalprompt待補項；其他未驗項不變。根代理所述final targeted尚待跑，不冒稱其已通過。
