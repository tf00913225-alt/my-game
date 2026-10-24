# 2b96 CI 直接文字契約續修

Work ID UI-SKILL-STANDARD-20261020 / branch fix/ui-skill-standard-polish-20261020 / PR955。續接clean/pushed2b96e1c0672b1218800bf8ab3014387cd61cf184，沒有既有未提交修復，不重做背包三列/美術/導覽/Modal與32B。

CI39911255408/attempt1/pull_request已failure：core120275618344在06:35:03 UTC首失敗hit-evasion-final-percent-status-formula:136（186/408退出）；ui120275618328在06:35:48 UTC首失敗forge-sockets-browser-qa:174。兩者不是Chrome錯誤。[兩份直接失敗excerpt及exact source proof](evidence/UI-SKILL-STANDARD-20261020/ci-2b-string-contracts)。

前者原正式技能描述Owner js/60-v173.64-skill-progression-rebalance.js:373–375，既有06739572明確把Boss中文化為首領，非公式/清除對象變更。測試只同步相同完整句子的「首領」一詞，仍斷言永久被動、EX、裝備效果、首領機制、HP／SP與死亡狀態全部保留。沒有改技能數值、淨化邏輯或fallback資料。

後者原equipment-progression.js appendReforgeMarkers:942–952（3e9df4fe正式單一呈現Owner）對滿/空格一律加原索引詞條標籤。CI actual四個滿格是詞條1攻擊40、2攻擊38、3攻擊36、4攻擊35，第5空格與remaining1/unchangedtrue均相同，只有舊expected漏四個標籤。保留整個deepEqual、五格順序、數值、空格、remaining與不寫入斷言；不正規化/排序實際輸出，不刪assert，不改存檔或任何產品source。既有reforge-slot-presentation測試同時覆蓋獨立滿/空格、legacy欄位、重複數值位置及JSON不變。

兩套直接focused regression PASS，forge runner syntax/diffcheck PASS。只有測試預期字串變動，沒有新產品畫面；引用既有segment33c equipped-filled-end實圖確認原編號列，不能當成此次新Browser或交易驗收。不本機重跑既有冶煉交易/全Gameplay；仍等最新Head必要CI，不能用舊Head或本機小測試代替。

## 目前其餘批次與依賴

- 一般導覽：技能黑鐵底板、四尺寸原入口/按下/context返回已驗證保存；其他context/鍵盤/實機仍未驗。主城live icon與context帶字藝術差異未證實裁字或不可讀，不為一致全換圖。
- 元素匣入口批次：尚未啟動，仍依原入口Owner與既定順序；不趁測試修復刪AI設定、時數、儲存key或其他邏輯。
- 倍率批次：尚未啟動；須核正式共用時間Owner與#983新戰鬥布局/VFX責任，未做倍率/冷卻/一次性結算驗證，不另造timer。
- PWA批次：尚未啟動；涉及原scaler、安全區與Auth/Save/cache返回相依，實機仍未驗，不強制全螢幕或另設scaler。
- #976 b400e8d1有限等待由原Owner追蹤CI39914066251；本線不提前cherry-pick、不改另一套Chrome等待，待正常dev整合再按必要相依吸收。既有7af被動採證保留。
- #984故事guide依賴另列；#983正調整戰鬥布局/技能名，本線此次完全不改布局或名稱。

此段待獨立scope審核及遠端checkpoint，Latest Head必要CI/Gate未齊不合併、不部署；全UI/實機/其他未驗狀態仍未完成。

獨立scope審核已PASS：精確兩行預期、所有語意與不寫入斷言保留；實看既有編號列畫面，未假稱本輪Browser。證據同目錄independent-review.md。原兩套focused與syntax/diffcheck已通過，不重跑。保存遠端後只追蹤最新Head正常必要CI，不重跑舊SHA。
