# d5 必要 CI 直接失敗續修

Work UI-SKILL-STANDARD-20261020 / PR955 / 原分支，base d5f09731267b1a3ba8374fb451b5557f15d2a92e。保留既有副本、導覽、Modal與32B證據，不開新批次。

CI39908022928/attempt1/pull_request：core120264761212首失敗 battle-status-info-assets:133，退休skill-picker +8px公式。直接同字串檢索另命中battle-ui-status-vfx-followup；兩者改綁原CSS完整command+menu+row+24公式、item公式與共享bottom/opacity消費者，保留其他全部斷言，不改runtime CSS。14項focused測試通過。

ui_browser120264761021原responsive-item:367三列不足，height467/slot182/gap12/populated24/slots6。用原Phase2 populated fixture及原production loader在360×640精確重現並保存圖，第三列實際被footer裁住，非Chrome失敗。原立繪364native row、5欄182格、字級與所有控制保持；隔離對照移動既有金幣列至頁首並回收right-panel top12與category bottom21→9兩處空白，物品區467→572，滿足原570門檻，不調門檻、不縮立繪。正式改動只index原wallet DOM搬移與CSS22原Owner；金幣允許換行保留長值。完整source/bundle逆向證明及原圖見 [source evidence](evidence/UI-SKILL-STANDARD-20261020/ci-d5-density-source)。當時已有tests/collector未提交修改，before/candidate raw report dirty=true，不能標成clean或CI成功。

依實際人類特定授權6358394561，於本來必要的UI修復Head接入#976兩檔原blob：7af1b8c6（父a2689622、原helperc7809e9b）；不整分支合入。精確patch與既有獨審6358007521；六項原focused tests全通過，首次沙盒junction EPERM，於允許自有junction的環境補驗原六項，無跳過/放寬。Chrome參數、15秒期限、worker200ms、Gate、部署與成本不變。接入scope獨審確認兩blob byte exact；獨審當時六項尚待，最終結果以本段補驗為準。#955唯一Head/CI tracker，#976唯一分析者；待本Head正常CI提供實際terminal artifact，未宣稱根因或修復Chrome。

adventure等待原manual turn/guide沿#984直接依賴，不改故事/Auth。四尺寸修後實圖、長金幣、三列/scroll/footer及獨審尚待；必要CI/Gate未通過不合併部署，未驗實機與全UI。

## 2da 四尺寸限定實際驗收

360×640、393×873、412×915、1280×800同一clean Head/manifest不變，原density皆572/182/12、24個真物品圖與六裝備位；原三列Gate不變，長金幣9,999,999,999完整位於頁首、控制≥44px且EFP true，手機touch/桌面wheel到當前頁真末端，再原關閉真touch/mouse返回主城。[20張場景圖、原JSON/hash與三方獨審](evidence/UI-SKILL-STANDARD-20261020/ci-d5-density-reviewed)。美術實看4尺寸normal及360長金幣/末端共6圖；輸入4圖，scope2圖；均只此子項PASS，無立繪縮小、欄/格/字/handler/交易變更。2套既有inventory static及build/check通過。

一次性helper先用b的18px行盒判斷26.33px字型ink為裁切，實際ink完整在44px header中，無裁切；修正為真可見header邊界，未改產品或原Gate。兩次失敗另存excluded，非通過。runtimeRestoreExact=false/profileRemoved=true；非實機/交易/全UI或重做120格。

必要正常CI：source2da run39910644355/attempt1/pull_request，保存時pending，沒有terminal artifact可交#976；已回報精確接入Head/run與限制。此證據checkpoint仍需自己的Latest Head必要checks；不手動取消/dispatch/盲重跑。d5 run39908022928已知兩失敗已最小修復，adventure仍沿#984；其他未讀Gate不概稱通過。
