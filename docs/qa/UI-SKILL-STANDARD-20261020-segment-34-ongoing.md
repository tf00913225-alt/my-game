# 第34段：深淵實畫問題取證（施工中，未驗收）

Work UI-SKILL-STANDARD-20261020 / PR955；來源54c1eb0addb81476e38961547e0f9acb12a59439，僅360×640 before。不重做9獎勵預覽或11冒險地圖，兩者不是本次兩難度深淵實圖。

首兩次停在QA：未先捲玩法總覽到入口／誤將原捲動Owner自身class當作子節點；失敗完整保留，不歸咎產品。原Owner真touch到卡完整可見後，實測20/40挑戰與返回玩法均36px，不達44。唯讀CSSOM probe證明CSS46舊版min38!important壓CSS50/54正式52；不是單純猜font-size或宣告數值。

獨立diagnostic僅在可見/EFP真命中的已知不足44控制上繼續觀察，固定diagnosticOnly/completefalse，正式acceptance44 Gate沒有降低。到map20後，59內置返37.714px被原#v146AbyssReturn36px圖像控制遮住，EFP false；保留未點返回、未進map40。41與42都能建立同id topreturn，59內置返另到選擇；上方原Exit到玩法中心、底部04到選擇的兩種語意都必須保留，不以z-index互壓或刪除必要導航。

原時鐘t0/1s/3s：dungeonPage class始終正確v146-abyss-active，推翻class延遲猜測，不據此遷移class Owner。實際map CSS變數相對URL在build feature CSS處解析成/build/assets/dungeons/abyss/maps/floor-1.png，Network404。原角色span背景none，patrol source原src=null/currentSrc空/naturalWidth0維持3s；config feature-abyss缺feature-patrol執行相依，圖片prefetch不是module初始化。正式素材不重畫，待沿原URL/feature manifest Owner最小修復。

獨立美術看過selection與map具體before，scope核對正式Owner/兩返回語意/原CSS與時序證據，均非after批准。每次raw/meta/abyssKey/legacyKey/actors/inventory/loadouts/equipment/saveAPI九項精確還原；原select/back persist本機副作用保留，不冒稱零寫入，private mapEntered/cache完整還原未驗。沒有點map/encounter/chest/portal/reset或開戰，沒有真帳號Cloud交易。

下一步：舊CSS46 button規則退出新selection、原50/54恢復足夠觸控與技能同系方正古銅按鈕；41重複topreturn退役，42唯一頂部返回玩法及04底部返回選擇保留；59原render URL解析修正、正式manifest補patrol依賴。必要原回歸/四尺寸真入口與兩返回終點/地圖和角色decode/獨立after審核仍待完成。鎖定、通關、其他區域、戰鬥/獎勵及實機未驗。

其他路由核對：塔band直接startTowerFloor，不是唯讀詳情，不新造彈窗，實際戰場未驗；巡怪真home→training→zone info→進入，且須關閉原自動補給/巡怪前置；圖鑑bestiary資料/擊殺/存檔/任務讀取仍有效，未找到正式可見圖鑑頁，只候選頁N/A，不刪資料Owner。

證據evidence/UI-SKILL-STANDARD-20261020/segment34-before-observations；後續施工留同PR/Branch，Chrome獨立。
