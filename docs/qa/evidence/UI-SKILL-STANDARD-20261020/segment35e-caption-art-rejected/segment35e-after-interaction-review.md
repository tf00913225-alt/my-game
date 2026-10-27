# Segment35E independent interaction review

結論：四尺寸真實OFF caption與相關靜態版面限定通過。Reviewer interaction_review實際逐張看8圖（各尺寸patrol-map-static/appearance-open），獨立讀四report的inputs、Range/font、重疊Gate、domain及restore；未Chrome、未改tracked。

Head `99b39edc496a9f4706c99695855c512ed59cc93e`，證據 `artifacts/ui-skill-standard/segment35e-patrol-caption-99b39edc/caption-after/{size}/`。四report complete/clean/sourceUnchanged true；不重做35D列表長矩陣。

- 兩個實際DOM標籤「自動戰鬥／自動巡怪」及「關閉」完整可見。Range在原button內、不裁字，原caption native18px投影15.43/16.84/17.66/19.29screen px；關閉狀態投影13.71/14.97/15.70/17.14screen px。原78native bitmap尺寸保留，新增可讀caption不依賴讀取bitmap小字。
- 每個原button實際70.29x96.63至87.86x120.79screen px，EFP真命中。兩quick互不相疊，與原形象switch、開啟面板及人物無quick-control重疊；新增高度未遮人物或其他控制。
- .active=false，OFF顯示、ON display:none且0rect，沒有QA setactive或點擊quicktoggle。aria分別自動戰鬥/自動巡怪，原onclick精確toggleAutoBattle()/toggleAutoPatrol()保持。這是實際OFF呈現，不是ON模擬驗收。
- 六個原導航/forest進入/形象switch開關/leaveMap返回真tap均EFP及44Gate通過。原返回綁leaveMap()，回trainingActive=true/mapActive=false，選中形象local bytes未變。未選角色、未點map/monster。
- 全phase選定domain對baseline不變：三autoConfig false、autoPatrol/autoBattle/battleActive false、token0/timernull、元素匣0，既有actorsHP/SP/level、gold、inventory/equipment不變。raw/meta/actors/inventory/loadouts/equipment/patrolKey/saveApi八restore true。原背景timer與save委派保留，不稱全系統零副作用或privatecacheexact。

限制：只真實OFF caption與兩張受影響靜態狀態；ON、auto啟動/停止/交易均未驗。原bitmap小字本身仍保留，不據此批准素材品質或整個map美術；長名、三角色、形象選取、其他區域沿35D限制未驗。
