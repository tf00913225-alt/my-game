# 批2一般導覽：共用黑鐵雕飾底板

Work ID UI-SKILL-STANDARD-20261020 / PR955 / 原分支；續接 cbe3d595，副本末端四尺寸及三方獨審已保存，不重做。

直接實圖：前段同產品來源 c295 的 returned-home / daily-top，主城為金色圖示與live label、副本為帶字圓雕飾圖；兩者原底板均為普通線性漸層加單條金線，不符合技能頁黑鐵紋理與雕飾語言。讀完整原04JS/06CSS Owner及直接導航測試後，本小段僅原CSS06底板換用既有技能頁 panel.827d9ba9a6f8.webp 的115 slice/18px框，不新增素材或Owner，不改圖示、文字、選中/按下規則、幾何、入口、context與遊戲邏輯。圖示比例/標籤差異仍保留待評，不宣稱已全統一。

12個原導航Owner/動作 regression 通過；原production builder/check通過。四尺寸原入口、按下、context返回及實圖獨審待完成，必要CI待最新Head。未驗實機、鍵盤focus、其他導航context、載入/失敗與全UI，不合併部署。

P4診斷7af1b8c未接入：本工作仍遵守使用者Chrome工程分開；現有證據保存不是授權跨線變更Chrome。#976保留唯一取證Owner，既有run不取消/重跑/另造採證push。需協調接入時先確認人類授權範圍，不以跨對話訊息自行擴scope。
