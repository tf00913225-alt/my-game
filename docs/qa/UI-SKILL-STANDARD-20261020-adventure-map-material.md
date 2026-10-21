# 新章節地圖：標題／返回／材質待驗

Work ID UI-SKILL-STANDARD-20261020 / PR #955。正常合併來源 b389e184f07a2de2ff1969f437f7e1e806ed5a10。

原既有 PREPARE 角色沒有寫入/強制關閉 onboarding，原migration得到inactive。真出城→map→原picker→c1_01預覽→首句故事，返回可操作但arrow僅32.57px寬；44gate拒絕，沒有降低門檻或假稱返回成功。失敗圖只是首句故事，不是error場景。7項raw/meta/actors/inventory/loadout/equipment/save API於同task還原、source不變、自有profile移除；private cache不聲稱精確。證據 [adventure-map-material-source](evidence/UI-SKILL-STANDARD-20261020/adventure-map-material-source)。

獨立美術實看五圖後確認：頂框「出城冒險」偏左且字級層級弱；預覽/picker為綠漸層與多重普通細框，未達技能基準。僅原adventure CSS Owner修：back最小寬52保位置；map頂框對稱52寫字區置中、20px/1.4/900，章節strong仍左置；預覽與picker沿既有技能黑鐵115fill/6px與4px材質，移除冗餘內框/綠多線。保新地圖地理/路徑/節點座標、原縮圖與文字獎勵/CTA布局、原story雕框/立繪。沒有遊戲JS/數值/交易/獎勵/進度變更。

待驗：四尺寸實圖、原picker真捲至末鎖列及回首、原story首句合法返回、標題完整/置中與素材實載、三方審核、遠端checkpoint；不以CSS數值批准。教學active/新shop借頁/滿progress等其他相關狀態未驗，不能放寬guard來測取消；原20pointer CI與新Head證據分開。b389必要CI39530951275僅queued未通過，後續Head要重新核對，沒有手動取消/派送。未合併PR到dev、未部署。
