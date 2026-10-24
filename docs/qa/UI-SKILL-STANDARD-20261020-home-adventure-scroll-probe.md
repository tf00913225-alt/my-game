# 主城冒險入口局部遮住：有界核實

Work ID UI-SKILL-STANDARD-20261020 / 原Branch / PR955，source7dbff7a3。沿上段360×640長名隔離fixture，不改任何產品或測試來源，專門核實截圖觀察；未重跑CI或全主城矩陣。

Owner：css/00-main.css581–590原#homePage高度100%-216、overflow-y:auto與grid；js/16-stage-v54-main-city-runtime.js正式角色renderer；css/adventure-entry-v1-20260915.css入口axis在row3，js/adventure/adventure-entry-v1-20260915.js提供正式按鈕；css06單一216native導航。沒有新scroller/nav/scaler或patch。

原觀察可重現：長中文/英文名時scrollTop0，入口y546.53–599.06、nav top568，入口中心命中nav。但#homePage原本可捲（scrollHeight2123/clientHeight1704原生單位），真Input.dispatchMouseEvent wheel deltaY260後scrollTop260，入口完整y459.86–512.39、200×52.53，EFP命中入口。接續真mouse pressed/released，實際adventurePage active、模組載入，截圖確認章節地圖，不只是呼叫onclick或程式showPage。

結論限此案例：入口可正常捲至操作，沒有不可達/不能點擊的產品故障證據，不需改原佈局。首屏只露部分確實存在，發現性未證良好；不把可捲等同所有視覺品質完成，也不直接把局部截圖觀察叫根因。

獨立/root/map_input_review實看before/after/click三圖與JSON，支持窄結論並保留限制：本輪wheel/pointer不是手機touch/實機；story=false，不驗劇情/戰鬥/返回或其他尺寸/狀態。完整Story仍另有Gate。本段沒有新增永久測試、產品修復或擴全主城審計；有效姓名/黑鐵/PWA/loading成果不重做。

證據evidence/UI-SKILL-STANDARD-20261020/home-adventure-scroll-probe，綁定原source/fixture；runtimeRestoreExact=false如實保留。此有界觀察處理完成，剩餘正常Latest Head必要CI與原台帳不變；未合併部署。
