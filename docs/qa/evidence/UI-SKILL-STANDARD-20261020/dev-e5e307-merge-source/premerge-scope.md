# e5e307 合併前範圍與相依審核

唯讀UI 1b2b750c2b5baf161cb9febbaefaefa5121b9e2a、dev e5e307122f84edd3fda7d12c6395336c8b2a51c9；merge-base758。已讀GitHub #977即時body（merged、Head03dd03bd、merge e5），不是把其舊驗收當UI新合併畫面結論。PR明列新教學/地圖/資金購護具/精確UID穿戴及inputGuideHold；部署驗收仍pending。未merge、未開Chrome或改產品。

## 真正衝突
獨立git merge-file預演保存 artifacts/e5-premerge/report.json 和各expected檔（有marker只作證據）：
- adventure CSS四處；有舊save提示lane vs新guide樣式、原normalflow tutorial-return vs上游absolute、舊map/caption與padding44 vs新不捲9:16地圖、舊雕框sheet vs新地圖/picker預覽。不能整檔ours/theirs。新地圖已是dev正式改版，不應把舊map重疊回去；但保本UI已驗之可讀字級/44targets/材質/正常流借頁返回/非map44底提示lane，按新DOM語意逐規則取捨，map專用layout以dev為基準。需要實畫，不可宣稱舊segment11/28全通繼承新map。
- runtime一處：保UI正式home→character modal→switch skill，不回退休skill頁；同時保dev新增equipment未購分支（有intent驗證後home→shop），不改資金/交易/條件。return close borrowed modal與既有同步Owner不得丟。
- UIrenderer一處：保samePanel閱讀位置/換panel回頂；新map DOM/viewport與舊mapScroll判斷不同，需核現有新map是否仍用adventure-map-canvas，不把舊selector不存在當已驗scroll保存。保新guide/render/back.hidden/reading lifecycle，避免把舊map滾動機制硬套新固定地圖。
- js00/js27/js35/equipment-progression皆獨立三方預演status0，可用完整expected逐byte核合併；其中js35舊重複reforge退休與新inventory binder dataset/locator必須並存。

## 相依與安全界線
JS00新增battleInputGuideHolds僅教學宣告timer hold，startBattle清hold，tutorial getPartyAutoConfig投影false/禁toggle；25/27配套不得漏。教學active smoke不應關掉正式guard造可操作；一般非tutorial自然倒數不能被hold。equipment-progression新增正式購置750護具transaction/rollback與offer，屬dev業務Owner，UI線只保原碼，不點buy/equip/claim驗layout。js45 registry增加8秒timeout/abort/retry正式Owner，保持dev exact。hero兩個generated資格policy/hero-source/qualification generator保dev exact（歷史catalog retention非UI來源摘要），不能整體拿舊UI蓋掉；restricted policy只sourceDigest重建，排除摘要後語意比兩端。skill/core/loadout/config/fixture在758→dev實際變更列表無新delta，不為此重跑SDK或600案例全矩陣。

## 合併後來源保護proof
把兩端/base SHA固定：共用自動檔逐byte等獨立merge-file；三個adventure衝突逐hunk保存選擇與理由，禁止盲覆。未incoming之UI css00/31/49/53/fixedslot及35 js17/26/41/42/59應等UI，非衝突UI source字串/scroll/hero/busy保留。dev獨有content、25/45、hero權威/交易新增與builder完整保持；生成bundle/manifest/indexhref從合併來源正式build。政策摘要重建後實算，不能用stale manifest。

## 最小必要驗證
正式build/check；chapter1-story-finalization、adventure-node、panel-scroll-transition、battle-input-guide-hold，以及原比較/reforgeslot/boot相關focused按衝突影響跑；最新Head required CI負責完整SDK/章節玩法，不本機重做20關。必要實際隔離smoke限短手機/桌面：新地圖開啟/原picker查看已可讀節點/非末句故事與返回、inactive回城與active隱藏返回、借頁真character技能入口→關閉→回教學、教學購護具畫面只讀及正常流返回不蓋最後列。active guide不可硬繞，不做交易。一般非tutorial HUD/空技能開關做20→19最小依賴smoke，證hold沒污染普通宣告；不能外推auto/resolve/結算。

原28全20對話內容/行數已被上游內容/教學調整影響，精確標新版待驗子集並引用#977自身有效CI證據，不重標舊圖新Head；全UI/真硬體/Cloud配置權威不在本核對。
