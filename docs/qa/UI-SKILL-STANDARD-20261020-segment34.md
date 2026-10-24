# 第34段：深淵靜態地圖與返回（限定驗收）

Work ID UI-SKILL-STANDARD-20261020；PR #955；source Head 7025fe9664709590451526f2b3f1b390cffb34a8。四尺寸 360x640、393x873、412x915、1280x800，36張實圖、44項真輸入，三方獨立圖證審核見 evidence。

原問題與七組未通過診斷保留於 segment34-before-observations：舊CSS46誤壓新按鈕、兩個頂部返回Owner/內部返回遮擋、CSS相對素材解析404、cold深淵未執行原patrol素材Owner。未以延遲假說遷移頁面class。

修原來源：舊規則排除新selection，52px原控件沿技能色系；42原頂部返回放大且標示返回玩法，41移除重複建立；59保留公用返回API、刪重複內部按鈕並以document.baseURI解析原素材；manifest引用原feature-patrol相依，未新增繪圖Owner。HUD沿用黑鐵/雕框，保留進度資訊布局。

正式路徑20地圖→頂部返回玩法、重新進入40地圖→原生底部返回選擇→返回玩法，真輸入與正式DOM終點均確認。地圖及原人物decoded/HTTP正常、唯一頂部返回、原44px與命中門檻保留、無戰鬥操作。首個after360因QA誤找主導覽bossNav失敗，完整排除證據與helper封存；修QA為正式情境返回且核對原onclick，未改產品。

針對性測試14+15+8+6通過，production build/check通過；本機v169資產測試identify不存在，未冒稱通過。Source/bundle獨立逐byte核對見審核。

- 僅隔離帳號兩個ready難度20/40首領域選擇/地圖靜態顯示、原頂部返回玩法及底部返回選擇；不驗整個深淵玩法
- 未驗locked/completed/replay、其他領域、map移動、戰鬥、寶箱、portal、reset、獎勵或交易
- 九項raw/meta/abyss/legacy/actors/inventory/loadouts/equipment/saveAPI精確還原；private mapEntered/runtime caches未主張還原，隔離profile丟棄
- 未驗實體手機硬體；桌面原生wheel，手機CDP觸控
- v169 assets-flow本機identify ENOENT未算通過；最新Head必要Actions待核對
- 未合併dev，未部署本工作；新dev cc2842技能來源無新增差異，戰鬥樣式/builder LF正規化合併需保留上游
