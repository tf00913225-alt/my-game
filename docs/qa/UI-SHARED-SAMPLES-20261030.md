# 共用 UI 母版第一階段盤點（2026-10-30）

Work ID: UI-SHARED-SAMPLES-20261030
Base: 2d6fae07b437e65e0ce3fb027b99135fabc1eb1b
Status: INVENTORY / prototype pending; no runtime change or visual acceptance.

## 已確認的基準

- 共同設計參考為 docs/ART_DIRECTION.md 所列已批准主城及背包圖片，兩圖必須一起比對；保留現有遊戲資料、功能與 9:16 Display Owner。
- 一般主框、次級彈窗不以大龍頭為裝飾；少數高階視窗的角飾及使用範圍需審核。樣張的短長內容、標題、返回、按鈕及頁籤必須可檢視及操作。
- #1016 已合 dev，商店／經驗池外框、標題及返回只代表該批成果；正式部署與實機仍依其工作狀態追蹤。

## 既有 Owner 與施工交界

- 一般功能彈窗：index.html、js/00-main.js 的生命週期；css/49-v169-rpg-ui.css 的共用視覺。
- 底部導航：css/06-stage-v11-native-bottom-nav.css 幾何；js/04-stage-v11-native-bottom-nav-runtime.js 語意及生命週期。
- 觸控、防誤觸與捲動：js/01-stage-v8-touch-lock.js 原 Owner，沿 data-scroll-owner 或現有 overflow 契約。
- 獎勵視窗：css/33-v132-content-expansion.css、js/27-v132-content-expansion.js 原 Owner；交易／獎勵與玩家資料 Gate 不因樣張省略。
- 背包版面：css/22-stage-v78-character-inventory-core.css；捲動：css/24-stage-v85-inventory-inner-grid-scroll-root.css。
- #955 open Head 6bb25293e80f7e097989d7bd268d88fcabf62b31，保留台帳與成果，不整包合併。#1004 Head 22ea18eb、#1007 Head d1de50c1 明確暫停，兩者有與 #955 重疊修改；本項授權不自動解除。

## 可續與待審

- 先核對既有三款樣張及其受支援的呈現方式；不要重做已存在的樣張或用其他方式繞過被拒的本機 comparison.html 開啟動作。
- 已授權建立不改正式玩法、帳號或資料的可操作共用母版樣張；依實際內容與操作重用既有 CSS，避免在 runtime 建立第二套 owner、wrapper 或監聽器。
- 核對主框、次級框、高階框、標題、返回、按鈕、頁籤、色字與伸縮後，先做 360x800、393x873、412x915 畫面及操作、獨立審核；未實機不得稱實機通過。
- 高階龍頭角飾的具體呈現與適用場景、樣張美術及觸控驗收仍待審；先不套入全遊戲。
- 新增產物的工具與安全邊界、共用 manifest/bundle 寫入窗口，施工前再次確認；不同工作不覆蓋。
