# UI-SKILL-STANDARD-20261020 — 第三施工段（驗收中）

- 實圖證實詳情、預覽、比較及一般對話框仍是普通細框。只在既有 css49 共用視覺 Owner 使用技能原 panel 九宮格與黑鐵中心，取代原普通漸層；對稱標題採原素材雕框，保留文字置中和原頁資訊排版，不強套龍牌。
- 共用背景/邊框來源仍只有 css49；圖檔無新增。原顏色狀態、固定操作列、內容捲動及尺寸 Owner 保留。
- interaction_review 從正式 `showRewardedAd` 本地純callback實圖抓到廣告面板約130px寬，標題區88px。原 css53 將390px上限放入native三倍座標，造成瘦框；改用既有 ui-length-unit 並以 border-box 計算。原 border shorthand 拆為等值三屬性，讓共用正式雕框不被清除。不改倒數、獎勵、callback或交易。
- dialog-review-4d5c2ac6 發生於施工期間，未綁載入bundle雜湊，明列為before線索，不拿來批准新Head。

待驗：新checkpoint固定來源的四尺寸詳情／預覽／比較／dialog／廣告實圖與操作、長名稱、內容末端、三方審核。此段尚未批准，不代表全介面品質完成。

4558 審圖退回細節已修：原 css33 預覽標題、原 css49 物品標題補雕框內留白；原 css53 鎖定裝備操作改佔完整一列，避免單字掉行；原票券2×5卡片把圖標/機率與完整名稱分列，保留字級、圖標及十件內容。最初試作使短屏關閉列裁切，未批准；調整卡片內留白後360實圖顯示完整十件與關閉，仍待固定來源四尺寸複審。

四尺寸正式dialog/AD API補驗32圖及本地純callback通過（4558三手機、bda29302 test-only桌面，production/bundle雜湊一致）；非廣告獎勵交易驗證。AD未有正式failure入口，未自造失敗流程。`ui-reward-dialog-layout.test.js`在Windows無which/Chrome locator而跳過其fixture，不能稱為browser通過；改以真正production loader詳情/預覽實圖驗證，Linux必要CI仍保留。
