# fb055 相鄰靜態背包框契約

Work ID UI-SKILL-STANDARD-20261020 / 原Branch / PR955，basefb055f0ff83a5cb85ca950abc2a32e20262861cf。正常CI40010319714/a1 core120610244540首錯ui-black-gold-window-skin.test.js16，仍要求舊bag-frame細框及inset背景框；與前段同一正式繪製來源，不是新產品缺陷。

只同步此一相鄰來源檢查：解析精確#game-ui #inventoryPage .inventory-classic-shell規則，明確要求#151515底色、1px透明版面邊界、skill-iron-bronze/panel.827d9ba9a6f8.webp/115fill/10px/0/stretch及0 0 10px#000c深度陰影。不是接受none或刪除可見框底；共享skin禁止接管背包、palette、無important/新pseudo、全部forbidden geometry與border-width檢查保留。

node --test tests/ui-black-gold-window-skin.test.js PASS，diffcheck PASS。引用同一有效產品來源上段ci-b772-background fixture.png、before/afterJSON及真實素材載入證據，不重跑已通過Browser。產品CSS/DOM/JS、數值/交易、loading/PWA及其他Owner未改；來源/畫面非新裝置或完整背包互動驗收。

Latest Head必要CI待正常新checkpoint，不以舊SHA綠燈背書；Story與工具分開，不取消未完jobs、不重跑舊SHA。工作仍Draft未合併部署。本段僅此相鄰靜態契約，沒有全面審計或探索/手機施工。

獨立 /root/daily_scope核對diff並實看上段有效fixture，確認精確素材/填滿/底色/邊界/陰影皆要求，原隔離/geometry防線保留，窄review無阻塞；未啟新Browser或修改來源。
