# 1b2b750c 指令材質初審

已實看360 battle-hud/skill-open/battle-hud-restored三圖：五欄共用黑鐵雕框底軌，文字及隔線完整；技能展開/返回時未見舊底軌浮在選單上。這是360單子集初審，不是四尺寸或按下狀態終審。

dbb3→1b原CSS00只targeted mainBattleMenu偽元素材質與button皮：原尺寸、五欄位置、font16/line22、JS與onclick皆無變；底軌pointer-events:none保留，button點擊層與原active::after金光保持，未刪disabled/hidden狀態守衛。border1px仍原寬度，transparent不取消點擊框。新兄弟divider限原五指令，不擴全域button。完整bootCSS以原source替換回去逐byte相同；index只正式生成href、manifest/docs對應，無新素材/Owner。

來源scope可接受，無玩法/經濟/存檔改動或過修證據。仍須四尺寸五button實測rect/hit及原skill安全pointerdown/cancel，確認共用底軌不攔截/按下feedback可辨；未實按其餘會執行戰鬥動作按鍵。技能/補品使用、auto/resolve/結算/波次與硬體仍未驗，不批准全battle。未改產品、未開Chrome。
