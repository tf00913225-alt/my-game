# 第十八段：逐件秘寶詳情與正式中文

Work ID UI-SKILL-STANDARD-20261020；PR #955。基準 ff7e8cb671119e1053f56abaf090a317b793ae80；最終純文案 3b4963f8a1fdb5ea699432220a853f8ec5c0cf4b。正式catalog共20件，天罡戰旗沿用第16段，其餘19件逐ID/name真卡overlay點入，在360×640、393×873、412×915、1280×800各完成47圖/70筆操作與捲動紀錄。隔離owned Lv20，四件長文補中段；另49/75/100專屬碎片且通用0、Lv19下一級20與已裝備為呈現fixture，未提交交易。

現有雕框/品階/內卡與五字長名安全，未修改CSS或強套排版。原js60的9件限制或效果含floor、Barrier、普通加算桶、工程標記、成功寫入等不適合玩家措辭。只替換11行顯示字串：返還小數無條件捨去、結界完全抵擋、持續傷害/未命中/狀態結算、傷害加成相加計算（合計上限50%）、有效一般負面與Boss排除、可淨化負面成功生效後。保留最少1、不得超過已消耗量、零消耗、輪次/一次/例外、95%爆擊等原條件。結界依正式Owner；成功生效後對應status_written提交後淨化，沒有改成提前免疫。

白名單10對替換（floor兩次）逆向重建與原檔逐位元相同，證據display-copy-proof.json。所有計算、事件、數值、成本與交易原樣。既有14項秘寶Owner/hardening/system focused tests與正式build/check通過。僅九件受影響middle/end補驗，每尺寸18圖/28筆紀錄；無裁切、末區完整、真返回，來源與bundle hash前後一致、clean取證、Chrome退出。三方美術/操作/scope看實畫限定接受；未修改11件保留基準。

所有基準與修後PNG、report、all-text及copy proof耐久保存在evidence/UI-SKILL-STANDARD-20261020/segment18-accepted，台帳新增19個個別ID條目，不以一件代表20件。最早fixture未等待正式renderer就點入的準備失敗不計驗收；resolved才是基準。

限制：未執行裝備/卸下/強化/合成/選箱交易或獎勵；實體裝置/真帳號/真網路事故未驗；localhost DEV卡片unlocked不代表正式production locked卡驗收；其他未列level/state組合未驗；catalog均runtimeReady，未造未覺醒狀態。原UI mark-seen/saveRelics副作用保留，不宣稱零存檔呼叫。未宣稱全遊戲/全業務完成。

CI：3b4963f8對應CI39412845585 queued、Session Authority39412845557 in_progress（本段最後讀取），均非通過；下一checkpoint仍須查即時Latest Head Gate。未合併、未部署。Next：委託TAB/末端/返回與材料合成真TAB，接背包材料/寶箱詳情等剩餘台帳，不重做已驗部分。
