# PC loading 面板窄範圍修正

Work ID UI-SKILL-STANDARD-20261020；原Branch/PR955，base214dd58f。正式Owner index.html startupLoader DOM、css/51-v173.20-startup-loader.css；criticalStyles由原build-production衍生，無第二panel/scaler或全域patch。

使用者退件要求PC面板太大、標題排版與移除兩側菱形。原panel寬度受9:16場景56.25dvh限制，但padding/font/gap等用整個viewport vw，桌面達最大值。改panel內唯一尺度min(1vw,.5625dvh)，保留原min/max與手機尺寸；刪除原::before/after兩菱形。沒有改JS/state machine/Auth/Save/Chrome工具。index/manifest/bootCSS只為原builder衍生同步。

實畫：原index startup DOM/source CSS held presentation fixture；四尺寸360×640、393×873、412×915、1280×800，每尺寸initial/ready/failure修前後各一張，共24張。不是完整啟動流程或實機。PC initial高度158.05→123.375、ready265.05→172.875；三手機幾何/字級不變；initial單行、長失敗完整換行、無overflow，retry148×44且在viewport內，菱形pseudo均none。使用者裁切圖的兩行標題沒有在此Head重現，不偽稱已證同版本根因。

Art/Input/Scope三獨審實看接受窄範圍修改。限制：failure較高面板覆蓋部分logo下緣裝飾，未遮遊戲名及控制；READY提示沿原動畫有暗階段，未做對比度認證；沒有真retry/enter或EFP證據，不能宣稱流程驗收。截圖的base+dirty來源以review.json的CSS SHA256綁定，沒有假稱clean source實測。

boot-architecture、v173.52-real-startup-progress兩測試PASS；v173.20-startup-loader素材測試本機identify ENOENT未執行，沒有改斷言或假通過。production build及--check、diffcheck通過；Latest Head必要CI仍待，不以舊綠燈背書。

唯讀dev https://dev.four-symbols-dev.pages.dev/ HTTP200當下boot-core.3c6f6f5d87d2.css仍有菱形、未有新panelunit；HTTP回應無SHA證明，actual deployed SHA及退件圖版本未知。本工作尚未合併部署。證據見evidence/UI-SKILL-STANDARD-20261020/startup-panel-reviewed/；先前PWA214dd58f成果保留，手機PWA仍未驗。

下一步僅追本Head必要CI及相關原症狀實際啟動驗證；未完成不合併、不擴站。探索/Story/Chrome相依依原責任與序列，無本段接線。
