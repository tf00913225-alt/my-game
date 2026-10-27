# #981 必要地圖相依整合

Work ID UI-SKILL-STANDARD-20261020 / PR955。續接97db6f6a，最新git remote dev d2bd5fbdcca8fe53b036065ff815fe8e020fb294。GitHub PR API一度回報舊base e5e307與dirty、exactHead checks空；不當CI通過。

dev僅新增#981地圖英雄同步時保留同一selectedNode的picker open/scroll，重開map重設瀏覽，以及原測試與生成物。正常merge，手寫唯一衝突為冒險UI render：保留原UI的samePanel閱讀scroll及map0，並保留上游mapKey/browsing/同選項還原與show reset。未另修遊戲數值、教程流程或交易。

兩份manifest衝突各兩處都是生成runtime/UI包hash與描述符。自動審核拒絕最初整份HEAD覆寫方案，該方案未執行；替代方案先保存原衝突gz、逐行限制僅生成hash/bytes，保留所有auto-merged內容，再由原builder從合併來源重建。舊rename衝突包被新ecc7fc來源包取代，來源及history未刪。完整衝突及處理摘要見 [source evidence](evidence/UI-SKILL-STANDARD-20261020/dev981-conflict-source)。

build/check通過；chapter1-story-finalization及adventure-panel-scroll-transition共52tests通過，原save-denied負向診斷不隱藏。驗證相依修正的獨立審核另存本目錄來源證據。原四尺寸8fb實圖仍為歷史有效視覺證據，不冒稱新JS已完整Browser驗證。

下一步：最新merge Head必要CI，僅讀新快照第一失敗；未解除guide pointer、far-row geometry及其他必要失敗前禁止合併PR到dev。新active教學、其他新劇情、交易結算與實機仍未驗。Chrome維持#976單一歸屬。沒有需使用者處理的決策或權限阻塞。
