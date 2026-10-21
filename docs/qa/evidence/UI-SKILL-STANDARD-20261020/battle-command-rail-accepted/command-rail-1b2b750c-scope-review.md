# 1b2b750c 指令鐵軌限定終審

已實看四尺寸battle-hud/skill-open/battle-hud-restored共12圖；原五欄共用黑鐵雕框、字與分隔完整，技能開啟時底軌留在選單後方，返回恢復原狀。未見此子集新增遮角色HUD或錯位。原source及完整bootCSS逆向proof已核，command-skin-source-proof另保留正式可復現程式；僅targeted skin，JS/handlers/尺寸未改。

四report complete/clean/sourceUnchanged同Head1b2b；五控件幾何與前版對照保留。原native技能press→cancel沒有click，手機CSS active=false如實記錄，不能據此稱手機active金光已實驗成功，也不能把一個技能鍵的按下推及普通攻擊/背包/防禦/逃脫。舊native-press的Range含decorativeglow失敗保留為診斷，新text-only量測沒有改產品掩蓋。

獨立baseline/final actors/gold/inventory/equipment/monsters/token/turn/config/auto/元素匣相同；宣告窗口save0→0，不能外推入口零副作用。自然倒數觀測及owned profile teardown保留，runtime exact還原不claim。

可接受本次純材質、原空技能真開關與已測五控件幾何子集；未用技能/物品，未驗其他按鍵pressed/active完整狀態、auto/resolve/實際攻擊/結算/波次/真硬體。未改產品、未開Chrome。

## 新skin後相關入口最小smoke

另實看1b2同Head360/1280的item-open及normal battle-target-prompt共4圖，核4report complete/clean/sourceUnchanged同Head與baseline/final監測domain無差。補品空選單及普通攻擊提示/原返回在新skin下完整，回合/倒數牌可見。限定接受這兩尺寸相關入口smoke；393/412此兩case仍只引用舊cc224快照，不重標成1b2已驗。沒有補品使用、攻擊、符咒/填滿或結算操作，既有全部未驗界限保持。
