# b772 core：背包與共享窗框真實繪製來源

Work ID UI-SKILL-STANDARD-20261020 / 原Branch / PR955，baseb772bd3c67069b7de89b65afe5b925f1e8b00d91。正常CI40007338007/a1 core120600050945首錯ui-black-gold-window-browser120，期待linear-gradient而actual none。本段只修此fixture的陳舊呈現檢查，不改產品CSS/DOM/JS或Chrome工具。

正式css22 inventory-classic-shell背景是#151515與skill-iron-bronze/panel.827d9ba9a6f8.webp border-image115fill，並非backgroundImage gradient；shared css49:1598–1625亦沿同一紋理fill。因此none不能直接當缺圖，更不能改產品回普通漸層來迎合舊測試。測試仍讀原兩CSS與legacy authored-unit fixture，沒有少載正式來源。

最小補強：採集backgroundColor/borderImageSource/borderImageSlice；原load事件後核對同一canonical圖complete/naturalWidth/naturalHeight及與computed URL相同。背包before/after style deepEqual、幾何與陰影完整保留；改驗21,21,21底色、精確panel素材及115fill，不接受任意none或blank。原舊metal border-color檢查由真材質frame來源取代（正式border透明是border-image必要底層）。其餘共享窗框同一gradient假設於reward揭露，補齊同根因frame/fill/base檢查；保留全部幾何、陰影、tabs及button區別斷言。

第一次補強採集輸出空JSON，屬未通過fixture嘗試，未拿來證明產品結果；修為load事件後同步採集，原target browser PASS。再只為獨審保存同一before/after結果與實圖；沒有改Chrome flags/timeout或別處helper。fixture實畫黑鐵紋理/雕框可見、素材同來源載入；證據見evidence/UI-SKILL-STANDARD-20261020/ci-b772-background。

此420×746是人工geometry fixture（內含人工34px sample buttons），不是正式遊戲新實機/觸控驗收。歷史ci-d5-density-reviewed等正式背包證據保留不重做。本段沒有降低既有正式觸控標準；不冒稱所有裝置/狀態或部署PASS。Latest Head必要CI待新checkpoint；Story教學與Boss DevTools failure依各自Owner，未混改或重跑舊SHA。

獨立 /root/daily_scope已實看fixture圖、核對diff與before/afterJSON：五類窗框/內容正常，無缺圖或框壓內容；新增精確素材載入核對且保留舊幾何與隔離斷言，窄scope無阻塞。未啟額外Browser或改產品。
