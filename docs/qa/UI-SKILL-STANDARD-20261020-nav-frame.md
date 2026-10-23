# 批2一般導覽：共用黑鐵雕飾底板

Work ID UI-SKILL-STANDARD-20261020 / PR955 / 原分支；續接 cbe3d595，副本末端四尺寸及三方獨審已保存，不重做。

直接實圖：前段同產品來源 c295 的 returned-home / daily-top，主城為金色圖示與live label、副本為帶字圓雕飾圖；兩者原底板均為普通線性漸層加單條金線，不符合技能頁黑鐵紋理與雕飾語言。讀完整原04JS/06CSS Owner及直接導航測試後，本小段僅原CSS06底板換用既有技能頁 panel.827d9ba9a6f8.webp 的115 slice/18px框，不新增素材或Owner，不改圖示、文字、選中/按下規則、幾何、入口、context與遊戲邏輯。圖示比例/標籤差異仍保留待評，不宣稱已全統一。

12個原導航Owner/動作 regression 通過；原production builder/check通過。四尺寸原入口、按下、context返回及實圖獨審待完成，必要CI待最新Head。未驗實機、鍵盤focus、其他導航context、載入/失敗與全UI，不合併部署。

P4診斷7af1b8c未接入：本工作仍遵守使用者Chrome工程分開；現有證據保存不是授權跨線變更Chrome。#976保留唯一取證Owner，既有run不取消/重跑/另造採證push。需協調接入時先確認人類授權範圍，不以跨對話訊息自行擴scope。

## e496四尺寸限定驗收

原入口、按住副本、context返回手機touch/桌面mouse完成；四尺寸每狀態五控制≥44px且EFP=true，原單一shell。保存16張場景圖與原report壓縮/hash、nav幾何；美術各尺寸home/dungeon共8張，輸入4張，scope2張獨審均僅底板子項PASS。雕飾未蓋圖示、live文字、通知點或選中線。[證據](evidence/UI-SKILL-STANDARD-20261020/batch2-nav-frame-reviewed)。source clean/manifest不變，profileRemoved=true、runtimeRestoreExact=false。未驗全部context/鍵盤focus/實機，未批准全UI或圖示差異已解決。

最新dev bc7efd1c相對已吸收d2bd5fbd，無skills/角色配置或本段nav source變動；新增為CJK準備腳本/workflow與Cloud recovery後端。已讀直接workflow差異，不為dev前進重跑全套，不吸收未合併#984 story key修正；#984當前bfca39ba/open。必要整合前仍核對即時Head/Base。

美術審核補充：已看八圖未證實主城或context文字缺漏/裁切/不可讀，主城選中線清楚。108px live-icon與180px帶字藝術圖的差異本身不足以支持全換圖或裁字；保留原藝術品質，不以猜測擴修。按下圖本段已有保存，但獨審不以靜態圖替所有狀態背書。
