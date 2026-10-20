# UI-SKILL-STANDARD-20261020 — 第五施工段（驗收中）

實圖與正式DOM證實戰鬥子介面問題：補品卡片原55px垂直flex把名稱/效果縮到高度0；回合提示canonical公式命中卻落在面板內；元素匣位於補品右下格上；狀態主標題靠左且關閉太小；技能與目標返回字/觸控小。角色、血條、戰場槽位與準星原樣保留，只修子介面及開啟時回合提示位置。

原css00補品Owner改可讀兩欄卡片、保留文字與效果全內容和原scroll owner；原fixed-slot幾何Owner以共用高度/bottom變數同步回合牌，空/滿保留同面板高度，技能選擇加大內容與返回。原css40狀態主標題對稱雕框，保留段落閱讀左齊。原css49共用技能素材Owner增加battle子面板與reward純展示外框。目標主副文字保留可讀對比與換行，原閃爍不再壓暗重要指示。獎勵保持原viewport座標、顯示時間與dismiss流程，僅外框與文字。

破圖確證為原 `battleItemIconMarkup` 把既有✦字元當src；只在該格式化函式區分字元/圖片路徑並escape，未改物品資料或usePotion。新增focused正式函式回歸保留glyph、空值、原markup、escaped文字/圖片路徑。原幾何測試同步新同Owner公式，仍嚴格檢查回合可見；共12focused entries通過。Restricted policy僅來源digest正常同步，未改policy或玩法。

before權威：`battle-before-8b6857ae/393x873`12圖與`battle-before-a83339b0/360x640`首輪空態7圖。取trial時腳本輸出失誤曾覆寫8b before360，已明列INVALID-AS-BEFORE，不作原始圖或批准依據。`battle-trial-r1/360x640`是dirty試排：文字恢復，真swipe至末項、關閉返回命中，回合/元素匣遮擋解除；此後又收斂高度變數、空滿一致與glyph修復，須新固定Head驗收。

待驗：固定checkpoint四尺寸實圖與真touch、空滿切換、技能/背包互斥、文字與最後一列、狀態關閉、選目標返回、reward穩定動畫後展示/點擊dismiss、三方審核。已退休統計主頁不自造入口，現只保留正式Boss檢視；符咒尚無正式施放契約，保留disabled庫存，不發明玩法。未做真勝敗/獎勵結算、真交易、非空戰鬥狀態、硬體驗收，不能稱全戰鬥通過。
