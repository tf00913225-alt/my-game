# 倒數64px行高必要修正預審

已實看 ab82ea30 natural-entry-qualified/360x640/battle-hud.png：倒數20被原窄橫框上下裁切，常駐回合標籤已只剩一處。此實證支持修原行高；不應縮字、停動畫或改倒數生命週期。

已核未提交精確diff：固定格位CSS僅turn-row-height20→64、既有獨立indicator的top按行高置中及註解；DOM/JS/font26/timerTick1.55完全保留，原center-min公式自然納入較大行高。64 native對360約54.86 screen，可容納報告46.48 screen字形；仍必須真動畫峰值實圖核實，不能僅由數字批准。

test例外 centerHeight===centerMinimum 或舊21%上限：此為允許原最低可讀/動畫空間優先於壓縮美觀目標，並非任意高度放寬。原無重疊下限、enemy/ally正值、24底帶及總預算守衛全保留；新min在當前tokens為164 native。不存在回合、計時器、技能成本或玩法邏輯更動。可接受此必要source/test調整。

限制：原21%斷言本來幾乎等於強制center track比例，無法與較大合法minimum並存；新例外仍精確等於公式minimum，不接受任意高度。尚未證實新較小enemy/ally區在短屏的HUD/腳下status/人物、指令、提示與元素匣間距合格。修後需短手機/桌面真自然入口、動畫峰值倒數與目標/技能/物品狀態實圖及相應幾何Gate；此筆記不批准修後美術或全戰場。未改tracked、未開Chrome。
