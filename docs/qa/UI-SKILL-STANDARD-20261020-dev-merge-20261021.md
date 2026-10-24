# UI施工正常吸收dev：2026-10-21

UI原checkpoint1017c909；吸收dev b153e3f0269cf61bd8b4814e17f32277aae9df42，正常merge，不改寫歷史。目的為解除PR #955的dirty合併狀態，保留同一Work ID，未另建Chrome施工線。

唯一手寫來源衝突是css/adventure-v1-20260915.css檔首：UI既有autosave獨立提示列與dev新故事／教學樣式皆保留，沒有二選一覆蓋。生成bundle的rename／manifest與restricted policy sourceDigest衝突交正式build重建，policy權威規則不手改。dev其他已整合來源原樣吸收，並非本UI工程新增帳號／存檔／戰鬥邏輯修改。

必要focused驗證：build/check通過；chapter1-story-finalization17通過、character-creation-feedback4通過、EXP既有回歸通過。adventure-panel-scroll-transition最初因舊VM假頁面缺dataset而失敗，僅補root.dataset:{}後原跨頁重置／同頁與map保留斷言全通過。skill詳情既有real-opener檢查執行，Chrome locator子測試本機仍skip，不冒稱瀏覽器通過。

合併後需以新Head正常Required CI並補相應載入／UI原症狀驗證；不以舊Head綠燈或舊實圖代替新Head。新故事頁納入全介面剩餘範圍，舊技能標準與既有有限驗收保留。
