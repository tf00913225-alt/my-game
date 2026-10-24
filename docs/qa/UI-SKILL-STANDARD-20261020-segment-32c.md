# 第32C段：英雄成長讀取失敗末端與返回

Work UI-SKILL-STANDARD-20261020 / PR955；實際來源89ec4b167df6482f7509451b64072150acb0d3ac。32B已驗busy/503/重試保留，本段只補其未驗失敗態末端，不重跑正常全矩陣。

四尺寸360×640、393×873、412×915、1280×800，原同步鍵觸發隔離GET單次503後，用手機真touch／桌面原生wheel捲到最後被動，完整Range在原單一scroller內，返回鍵不壓末行。真返回原列表，保留兩個owned英雄ID、神犬卡全文與EFP命中/44px。三位獨立審核實看畫面與報告限定通過：art/input各8圖，scope四尺寸代表4圖。

初次補驗要求返回同像素而失敗，原報告與helper保留排除。查正式Owner：503清除proof後列表變短，returnHeroOverview仍將scrollTop賦原heroPageListScroll，瀏覽器正常clamp。新契約精確驗證savedAnchor1353保留、newMax1299、expected/actual1299；不修改產品、不以任意位置放行。

每尺寸clean/source hashes不變、mutation零、raw/meta/actors/inventory/selection/saveAPI六項精確還原。privateHeroCachesExact=false明列，隨隔離profile丟棄。未驗私人cache完整還原、其他失敗類型／中間內容、真雲端可用性、成長/領獎/裝備業務及實體裝置。清理證據是finally實作及執行成功，未聲稱獨立OS PID驗收。

證據：`evidence/UI-SKILL-STANDARD-20261020/segment32c-failure-end-accepted`。最新89ec CI39503981510/a1尚未通過：Session job118909111934案例749的600-case parity摘要不符，待分類具體domain/DOM差異；Boss/Adventure等Linux Chrome啟動失敗另由既有根因Owner處理，未混入UI工程。不得用本段畫面批准Required CI。

dev後續前進d6e81026（#975 recovery raw publication，7個後端/測試/規格檔）已讀diff範圍，未改UI/技能配置Client Owner，本checkpoint不為此重跑UI矩陣或自行修改其工程。技能相依整合仍是5e306322吸收190d249e及89ec限定實際補驗；待合併前按最新快照重新核對。
