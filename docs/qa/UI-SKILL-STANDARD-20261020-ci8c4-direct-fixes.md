# CI8c4 首錯最小修正

Work ID UI-SKILL-STANDARD-20261020 / 原#955；parent8c4cd1d0。自然CI40094082451/a1、Head8c4、Base34c41385已實際存在；不再以舊無runs/422判現在狀態。core job120872778248 step30、Adventure job120872778405 step7為直接首錯。

## Core：不僅是測試過時

舊test要求item78px/300px及已退休的共用overlay selector。實畫確認新footer的116px timer offset讓倒數壓補品卡片；因此先修原slot Owner：把原css00已實際生效的78/300 fallback明確宣告，item-open timer依該bottom+height+8px gap定位。選單本身、24px turn/46px prompt、party與skill header規格不變。四個原test檔同步8處退休selector斷言，保留兩狀態各自錨點/visible及所有target/status/relic等原斷言，不以縮字/透明或移除倒數掩蓋。

四尺寸空/滿/真touch或wheel末項/返回：倒數20清楚在menu上方，卡片與末項歸元丹完整，close命中且≥44，gold/inventory前後相同。沒有使用補品/攻擊/施法/結算；timer靜態停止，不宣稱自然倒數驗收。

## Adventure：原角色modal未被guide辨識

原artifact12560246546的393失敗圖顯示角色技能modal及no-guide遮罩；state是c1_02 guidance skill，trace最後為openTutorialSystem。原guide只找skillPage.active，借入角色modal的skillPage不帶active；這是直接可見host差異。原Story Owner以991/d688交付有界legacy相容接口，本次只擴原selector接受homeFeatureModal.show[data-character-tab=skill]，沒有合併/複製991新flow、Core、Content或獎勵。

另一疑似返回mount問題未照抄：955已有原static footer/classic-shell Owner，原centerHit失敗當時受no-guide遮罩干擾。selector修後原學習/裝備/同顆footer返回均真touch通過，因此保留原掛載，不新增button/z-index/Close Gate。原四元素guide test擴standalone/modal8組，VM支援selector list但保原完整fixture優先，learning/equip/guard斷言保留。

只補393原失敗路徑：原隔離external transport、可信pointer新角色/原第一關/舊第二關技能學裝/原返回/同關重入，skillReady=true；原45秒與guard不改。終態battle=true，只代表成功重入c1_02，不是重試戰勝、五課或20關通過。新增3張modal實圖（學習/待裝/已裝返回）及trace獲獨審，未以轉場截圖代modal證據。一次截圖helper作用域錯誤已排除，產品未受影響，final helper才列證。

## 驗證／剩餘

95直接回歸、build/check、diffcheck通過。三類獨審及原始失敗/修前後/source hashes見[耐久證據](evidence/UI-SKILL-STANDARD-20261020/ci8c4-direct-fixes/)。保留原75與986有效證據，不重跑同快照高成本矩陣。

新Head自然CI仍須正常完成，不用舊Head背書、不rerun/dispatch/空提交。其他原台帳、創角元素窄按鈕、硬體/PWA/自然戰鬥狀態持續明列。955排程PAUSED；未合併dev、未部署、不動Git main或其他Owner工作樹。
