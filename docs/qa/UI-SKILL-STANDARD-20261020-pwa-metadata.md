# 原第五批 PWA 最小 metadata 段

沿用 UI-SKILL-STANDARD-20261020 / fix/ui-skill-standard-polish-20261020 / PR955，base f9078aed94a90d12e6887ef910eb662cc21295f2。這是原授權第五批的獨立可恢復施工段，不另開第二有效線；沒有同目的PWA PR接管本責任。只app.webmanifest、index manifest link、manifest MIME/no-store header與必要針對測試，沒有新增SW、scaler、安裝提示UI或Auth/Save/update邏輯。

manifest採相對id/scope ./、start_url ./index.html、standalone，root與project prefix都指同一app入口，沒有存檔/帳號/release query或新路由。直接重用已正式runtime使用的四象元素圖樣 assets/relics/icons/relic_all_returning_array.webp，1254×1254 WebP，purpose any；沒有複製/轉檔/裁切/縮放源像素、alpha變更、重製logo或不實宣告maskable。OS實際裁切/圖示呈現仍待Android實機，本段不假造192/512天然尺寸。

Boot契約160–170的hash cache、index/release no-store、no-SW保持；正式release-update的safe reload/critical operation與Firebase popup/UID/Save權威不動。standalone metadata只影響安裝後開啟，不保證普通分頁永久隱藏網址列，也不等於FullScreen API或Android系統列已驗證。

本段Session分流：f907正常CI39919086247/a1 job120302571165，822/822 node tests PASS。null.textContent堆疊由 scripts/monster-balance-shadow-matrix.mjs loadLegacyRuntime→tests/v170 makeUniversalNode的querySelector固定null引發，屬非fatal fixture診斷，不是預期負例，也不是job首失敗。真正失敗為後續Boot QA自有waitForJson30s（run-boot-architecture-browser-qa:217–220/317，原spawn312），07:52:55 DevTools timeout；不是#976共用waitJson的四個call。已精確路由P4/CI-Boot Owner，無PSI不推同根因，不改Cloud權限、Save、測試斷言或等待期限，不重跑舊SHA。Adventure guide等待仍沿#984。

先完成同source桌面manifest解析、原圖decode、root/prefix URL與entry HTTP、原Startup可操作/Display不變檢查及獨審，再協調手機空檔驗證安裝、啟動無網址列、安全區、登入返回、存檔/更新重載。不搶#983/#985裝置；實機未完成前明列pending，不宣稱已安裝/全螢幕或整批PWA完成。Latest Head必要CI未齊不合併部署。
