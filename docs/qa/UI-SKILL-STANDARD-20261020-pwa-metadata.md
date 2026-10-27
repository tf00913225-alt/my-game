# 原第五批 PWA 最小 metadata 段

沿用 UI-SKILL-STANDARD-20261020 / fix/ui-skill-standard-polish-20261020 / PR955，base f9078aed94a90d12e6887ef910eb662cc21295f2。這是原授權第五批的獨立可恢復施工段，不另開第二有效線；沒有同目的PWA PR接管本責任。只app.webmanifest、index manifest link、manifest MIME/no-store header與必要針對測試，沒有新增SW、scaler、安裝提示UI或Auth/Save/update邏輯。

manifest採相對id/scope ./、start_url ./index.html、standalone，root與project prefix都指同一app入口，沒有存檔/帳號/release query或新路由。直接重用已正式runtime使用的四象元素圖樣 assets/relics/icons/relic_all_returning_array.webp，1254×1254 WebP，purpose any；沒有複製/轉檔/裁切/縮放源像素、alpha變更、重製logo或不實宣告maskable。OS實際裁切/圖示呈現仍待Android實機，本段不假造192/512天然尺寸。

Boot契約160–170的hash cache、index/release no-store、no-SW保持；正式release-update的safe reload/critical operation與Firebase popup/UID/Save權威不動。standalone metadata只影響安裝後開啟，不保證普通分頁永久隱藏網址列，也不等於FullScreen API或Android系統列已驗證。

本段Session分流：f907正常CI39919086247/a1 job120302571165，822/822 node tests PASS。null.textContent堆疊由 scripts/monster-balance-shadow-matrix.mjs loadLegacyRuntime→tests/v170 makeUniversalNode的querySelector固定null引發，屬非fatal fixture診斷，不是預期負例，也不是job首失敗。真正失敗為後續Boot QA自有waitForJson30s（run-boot-architecture-browser-qa:217–220/317，原spawn312），07:52:55 DevTools timeout；不是#976共用waitJson的四個call。已精確路由P4/CI-Boot Owner，無PSI不推同根因，不改Cloud權限、Save、測試斷言或等待期限，不重跑舊SHA。Adventure guide等待仍沿#984。

先完成同source桌面manifest解析、原圖decode、root/prefix URL與entry HTTP、原Startup可操作/Display不變檢查及獨審，再協調手機空檔驗證安裝、啟動無網址列、安全區、登入返回、存檔/更新重載。不搶#983/#985裝置；實機未完成前明列pending，不宣稱已安裝/全螢幕或整批PWA完成。Latest Head必要CI未齊不合併部署。

## 9e101df2 桌面實測：部分通過，安裝阻塞

1280×800 原 Startup READY、原1080×1920 scaler、ordinary browser standalone=false、無SW；manifest解析零錯誤、圖示Image.decode=1254×1254、root與模擬project-prefix的manifest/entry/icon皆HTTP200。針對性metadata兩測試通過，但這些僅證明宣告/路徑正確，不代表安裝適用性。

實際CDP Page.getInstallabilityErrors 回傳 manifest-missing-suitable-icon（minimum-icon-size-in-pixels=144）。正式QA server原MIME已有image/webp，非MIME遺漏。Chromium官方 installable_evaluator.cc 的 DoesManifestContainRequiredIcon 使用 maximum_icon_size_in_px；installable_evaluator.h 非Android上限1024。現有1254圖示超限，不能以能decode或靜態測試PASS掩蓋。相同素材icons/fragments/battle-icons皆1254平方；vfx版本1448×1086。尚未選用其他不相關功能圖示、假報尺寸或改動像素。

原始證據保留於 artifacts/ui-skill-standard/pwa-metadata-qualified-9e101df2/1280x800：manifest-proof.json、ordinary-browser-ready.png、icon-preview.png、report.json、cleanup.json。report腳本exit0只表示採集完成，安裝結果以上述CDP錯誤為準。原 pwa-metadata-desktop-9e101df2 helper的gameStage ReferenceError屬排除的QA失敗；只修helper變數與未消費回應清理，不算產品修復。

下一步：先決定是否擴充此metadata段，導入同圖PWA專用合格尺寸；須沿用素材Owner、保留原圖、實測安裝檢查及獨審。實機安裝/系統列/登入返回/存檔更新仍未驗。PR維持Draft，不能合併或宣稱PWA完成。

官方來源：[尺寸上限](https://github.com/chromium/chromium/blob/main/components/webapps/browser/installable/installable_evaluator.h)、[適用性判定](https://github.com/chromium/chromium/blob/main/components/webapps/browser/installable/installable_evaluator.cc)。

三項獨立審核均已實看畫面：map_review確認192/512預覽細節清晰、64細節較密但四色輪廓可辨；map_input_review確認實際CDP錯誤及未驗裝置界線；daily_scope確認無遊戲邏輯或其他Owner變更。全部拒絕以此作安裝/Android/全UI通過。耐久證據：`evidence/UI-SKILL-STANDARD-20261020/pwa-metadata-desktop-partial/`。現用manifest保持未驗收狀態，沒有為測試通過換不相關圖示。

## 探索相依邊界（尚未接線）

已讀指定 exploration-formal-ui-contract.txt（#985 0f51f383）：接受 section#explorationPage.page.explore-corner 在既有game-overlay-layer與game-ui同層，不加scaler。探索Owner交付classic單一來源與 mount(root,{requestExit,dialoguePresentation})/enter/leave/destroy；UI只負責正式註冊、導航、原頁保留、stale取消、焦點與既有nav同步。Story純呈現adapter尚待正式交付，不假造簽名或呼叫劇情推進。當前沒有探索source修改。

## 877abcac：授權專用尺寸後解除桌面圖示阻塞

使用者明確同意加入同圖PWA專用尺寸，保留原圖與既有用途。新增192/512平方lossless WebP，完整畫面等比縮小、不裁切/trim/旋轉/重畫；原素材SHA256仍183c2bf9d9473d379d369c50c79eec244d5d949fb6685f90f5dd7c82366d00bd。衍生縮圖raw pixels與其lossless WebP解碼結果逐byte相同；母圖不含alpha，衍生保持RGB。這是已授權尺寸變體，不是擅改一般轉檔尺寸。

manifest宣告真實192x192/512x512與purpose any。兩focused tests通過，回歸新增精確尺寸及桌面144–1024上限；production build --check與diff check通過。原Chrome隔離QA實測1280×800：manifest解析、root/prefix路徑、READY、9:16/noSW正常，Page.getInstallabilityErrors=[]，原1254錯誤不再出現。

三位獨審已確認最小scope、來源不變與實際畫面。Art/Input發現首次512預覽使用192來源造成柔糊；僅修QA按尺寸選真實檔案並重新拍攝，所有preview Image.decode均已等待；產品SHA不變。有效證據在 `evidence/UI-SKILL-STANDARD-20261020/pwa-metadata-sized-reviewed/`，舊失敗及誤放大預覽不當成新圖品質證據。

只通過桌面metadata/CDP安裝條件，沒有聲稱真正安裝或standalone啟動；Android系統圖示裁切、安全區、登入返回、存檔/更新重載仍未驗。Latest Head Required CI未完成，PR維持Draft不合併。探索classic接口已由協調者回報#985 d8a895b5 ready；本段不混入接線，下一段先核對正式來源與Story純呈現相依。
