# 第29B段：取消技能後清除教學返回（限定驗收）

Work UI-SKILL-STANDARD-20261020 / PR955。Production a078c8bfc9a271666a72cf03fa2289db17146cec。

810e14a1/360真教學→技能→原header取消→商店實圖證實『返回故事』殘留商店底部，該候選失敗保留。只在原closeHomeFeature、原強制公告close阻擋早退之後，通知既有UI syncTutorialReturn('home')；同步Owner對非系統頁先hide並return，不讀冒險state、不建立按鈕，沒有新CSS遮罩或平行Owner。

360×640、393×873、412×915、1280×800真取消再開商店及公告，共4case/16PNG，三方限定通過。art與input實看兩目的頁共8圖，scope看before與四尺寸代表及完整diff；兩目的頁return均hidden/display:none/0×0，沒有殘留空列，原雕框/題牌/內容保留。7次真操作命中；same-task observer只記故事入口與前往技能2次，不能外推其餘取消／商店／公告點擊同步域皆驗。raw/meta/playerId精確還原，來源hash不變。

19故事、2UI renderer、14公告 targeted cases及build/check通過。新增回歸確保非系統頁清理不讀getView、單一button，原強制更新Gate未降。生成forest policy只有js00 sourceDigest變更，沒有成本、獎勵、戰鬥、存檔契約變更。

證據：segment29b-stale-return-accepted，含before810失敗原PNG/report及實際執行stale-return helper gzip。滿120/頁碼/其他取消路徑與業務流程仍待；後續full120單360已走五頁/末格119開詳情，因QA點隱藏舊返回selector而停止，尚未批准，另保留待補。比較頁英文副標EQUIPMENT COMPARE亦留待後續正式語言打磨，不在本生命週期修正順改。
