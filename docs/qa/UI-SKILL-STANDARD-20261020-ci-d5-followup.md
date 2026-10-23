# d5 必要 CI 直接失敗續修

Work UI-SKILL-STANDARD-20261020 / PR955 / 原分支，base d5f09731267b1a3ba8374fb451b5557f15d2a92e。保留既有副本、導覽、Modal與32B證據，不開新批次。

CI39908022928/attempt1/pull_request：core120264761212首失敗 battle-status-info-assets:133，退休skill-picker +8px公式。直接同字串檢索另命中battle-ui-status-vfx-followup；兩者改綁原CSS完整command+menu+row+24公式、item公式與共享bottom/opacity消費者，保留其他全部斷言，不改runtime CSS。14項focused測試通過。

ui_browser120264761021原responsive-item:367三列不足，height467/slot182/gap12/populated24/slots6。用原Phase2 populated fixture及原production loader在360×640精確重現並保存圖，第三列實際被footer裁住，非Chrome失敗。原立繪364native row、5欄182格、字級與所有控制保持；隔離對照移動既有金幣列至頁首並回收right-panel top12與category bottom21→9兩處空白，物品區467→572，滿足原570門檻，不調門檻、不縮立繪。正式改動只index原wallet DOM搬移與CSS22原Owner；金幣允許換行保留長值。完整source/bundle逆向證明及原圖見 [source evidence](evidence/UI-SKILL-STANDARD-20261020/ci-d5-density-source)。當時已有tests/collector未提交修改，before/candidate raw report dirty=true，不能標成clean或CI成功。

依實際人類特定授權6358394561，於本來必要的UI修復Head接入#976兩檔原blob：7af1b8c6（父a2689622、原helperc7809e9b）；不整分支合入。精確patch與既有獨審6358007521；六項原focused tests全通過，首次沙盒junction EPERM，於允許自有junction的環境補驗原六項，無跳過/放寬。Chrome參數、15秒期限、worker200ms、Gate、部署與成本不變。接入scope獨審確認兩blob byte exact；獨審當時六項尚待，最終結果以本段補驗為準。#955唯一Head/CI tracker，#976唯一分析者；待本Head正常CI提供實際terminal artifact，未宣稱根因或修復Chrome。

adventure等待原manual turn/guide沿#984直接依賴，不改故事/Auth。四尺寸修後實圖、長金幣、三列/scroll/footer及獨審尚待；必要CI/Gate未通過不合併部署，未驗實機與全UI。
