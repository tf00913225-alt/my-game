# 第七段：玩法主框、鎖定資訊、自動戰鬥裁切縫

Work ID UI-SKILL-STANDARD-20261020；Draft PR #955。本段三方審核限定通過，仍不是全介面或全部狀態完成。

## 固定證據

- Before fa402d1c450fd0f7fb8b0e2492f54e2fbb8493ef：segment7-main-before-fa402d1c，四尺寸各21圖，實際 production loader、isolated fixture，來源乾淨、manifest不變。Auto before及同快照因果對照位於 segment7-before-fa402d1c/causal/393x873。
- 主框與原互動 e80f20802fd0d5dcfb782bdf6315303b59c0c76b：segment7-main-after-e80f2080，四尺寸各15展示圖；segment7-controls-e80f2080/resolved，四尺寸各18圖，正式入口、TAB、詳情、捲動、返回真觸控。父目錄舊失敗為 QA 在 Hub 捲底後未回頂即點 Tower，不作產品遮擋缺陷或成功證據。
- 最後 delta 087f59ab2c8315d821098368d425d52820d27b84：segment7-final-087f59ab/resolved，四尺寸各5圖，Auto頂／末／重開、塔overview末／返回；source、loaded bundle hash不變、clean、touch零阻塞。父目錄初次360 QA未捲至overview按鈕，不算完成證據。
- 代表前後圖與精簡原始 JSON 遠端保存在 evidence/UI-SKILL-STANDARD-20261020/segment7-accepted。e80原證據與087 delta分別標 Head，不把舊快照冒稱新Head實拍。

## 原 Owner 修改

- css/gameplay-boss-tower.css：玩法／Boss／塔外框與對稱標題沿用技能既有九宮格及鐵紋素材，不搬動已置中的標題、封面、立繪、內卡與底部導覽；Boss鎖定卡不再整張透明。展開塔overview實圖再發現11～100層禁用卡過暗，於原disabled規則改可讀灰金，保留禁用與可用層差異，未改鎖定判斷。
- css/48-v169-element-box-settings.css：Auto sticky top與scroll clip原同小數座標259.649963px；同393對照中radius0及top:-1 CSSpx仍穿字，負1個UI單位才消除。只改原sticky top，並在原box-shadow補1UI內側古銅上沿，避免原border位於clip外而缺頂線。沒有遮罩、wrapper、整體縮放或控制Owner。
- 無production JS、數值、成本、機率、效果、存檔或權威變更。生成CSS／manifest由正式build同步。

## 審核與驗證

art_review 實看四尺寸主框、標題、Boss鎖定及Auto／塔末端；第一次退回塔鎖定卡後補看087四尺寸8張，解除退回。interaction_review 真觸控四尺寸上述入口、捲動、TAB、返回，087最後20張及各5項action紀錄；Boss個人3／世界2卡維持disabled及aria語意，塔禁用層仍disabled。scope_review 檢查完整本段diff及四尺寸代表前後／delta，確認無過修、Boss HUD或封面誤改。

相關focused checks原7個entry中16項通過，medium modal 靜態舊top斷言更新後通過；Windows該entry的獨立fixture browser因locator未找到Chrome而自跳，不能作瀏覽器證據，以上production CDP真圖另驗。後續battle-missing-repair-recovery、shared-nav、gameplay-hub共10項通過。build與diff --check通過。舊battle test仍要求height:auto/max182，精確改為原第五段正式78／300變數，保留duration／stealth／round-end／turn公式等斷言。

最新 Head CI／部署仍待必要Gate，不拿本機focused或e80舊Head當087 GitHub通過。fa CI39384660259首敗core118502145869為上述舊182斷言；tower118502145884連接Chrome9928遭ECONNREFUSED，分流獨立#954、不盲重跑。087 CI39386916158及Session39386916000當時queued／in_progress，不能當成功。

未驗：真實戰鬥／解鎖／廣告／領獎交易／結算／真機。Creation兩步主框與標題另段處理；深淵／副本標題帶及獎勵完整內容仍待驗。training／dungeon展示圖未修改，不列成本段打磨成果。原封面、技能／英雄／說明頁及合格內卡保留。
