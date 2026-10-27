# 正常吸收已合併 dev 的必要啟動相依

Work ID UI-SKILL-STANDARD-20261020 / PR955 / 原branch。起點615bec78a580c2e51634e0fe5ae6134e9b6903a6 clean；GitHub核對#976 merged，final b400e8d11e59978e44412d4537984b91a3c0f7f0 / merge dev6d5e3ba030a0db625e437645346582fae9eda0fd。使用正常merge --no-commit --no-ff檢查再提交，沒有rebase/force/cherry-pick。

新增dev範圍已讀直接diff：相對已吸收d2bd5fbd，CJK準備/workflow與既有Cloud recovery上游檔，以及#976四處啟動caller/runtime helper/測試/證據文件。本線未修Cloud或其他工程；25個上游檔逐byte等dev，326個UI js/css/index/build/manifest/release檔逐byte等615，最近兩個文字預期修正也保留。共享helper自動合併無衝突，最終blob8c27c5d2918b23aad2be32ee27422d9102d1d156等dev；原被動collector測試2fad22e4保留，沒有第二Owner或另一套等待。

只有terminal、Tower challenge、Adventure兩處共四個既有啟動call顯式傳chromeProcess，這些預設30秒、process exit/error提前fail、到期仍fail；其他call仍15秒，原flags、profile、產品assert和生命周期不改。這是人類授權的有限容忍，底層I/O原因仍未宣稱已修。

同一上游blob有效CI39914066251/attempt1/pull_request/Headb400已success，13必要子Gate、classifier及Repository checks成功；既有devpush39918072192由Actions共用驗收，未當成已通過。本機不重跑其昂貴30秒/全Browser矩陣。合併的build/check、helper syntax、兩項直接UI regression通過；Latest本工作Head仍須自身正常Required CI，不能拿上游綠燈代替。

逐byte驗證helper初次因git show預設stdout buffer1MiB遇ENOBUFS中止；擴到有界32MiB後完成全部檔案檢查，不是產品故障或PASS證據遺失。沒有改源檔以迴避檢查。既有UI實圖/四尺寸/鍵盤/獨審引用不重做；本段沒有玩家畫面改動，不造新Browser截圖。

[整合證明與獨立scope審核](evidence/UI-SKILL-STANDARD-20261020/dev976-integration)。#983戰鬥布局/技能名/VFX、#984故事與新探索Owner均不在本次寫入範圍。未合併dev本UI、未部署、未main發布。
