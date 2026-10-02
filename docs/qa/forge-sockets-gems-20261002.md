# 鍛造與寶石第一階段驗證（2026-10-02）

Work ID：FORGE-SOCKETS-GEMS-20261002；PR #751；Game／Cache Version：173.72。

## 範圍與正式控制來源
js/36-v141-content-systems.js：鍛造頁籤、冶煉、裝備／寶石選擇與鑲嵌；js/00-main.js：階級孔數與裝備寶石屬性匯總；css/49-premium-functional-ui.css：合成／鍛造面板底部間距。CSS38 與 JS58 的衝突間距設定已移除，沒有新增包覆控制來源。

1. 圖鑑可見入口改為鍛造，冶煉與鑲嵌在鍛造；擊殺資料保留。
2. 冶煉不再檢查或扣圖紙，礦石與金幣原規則保留。
3. 白／藍／紫0、橙1、紅／粉2、萬象／四象3孔，舊裝備缺省 sockets 為空。
4. 最小 gemVitalityI 體質+1，可辨識及選擇。
5. UID 本機原型扣一顆、填孔、持久化；拒絕滿孔／未知資料／重複 UID；失敗回滾；裝備加成、卸下移除。
6. 遊戲風格 details／button 選擇器，單一內文捲動，390×844／412×915 實際觸控事件選末端裝備、導覽避讓及無水平溢出。

## 候選證據
Head e269070dd1f90097525da8f4720557316fad9b05；CI run 36966366859 Repository checks SUCCESS。
測試用合併快照 5ed93eaf04c2fbee7a09b6a139e9177d92f76baf；artifact 11209726733：forge/evidence.json passed=true，forge-390.png／forge-412.png 已視覺核對。
正式打包同步、必要鍛造／冶煉／背包／主城／導覽回歸通過；全套 Node suites 在 main CI 才執行，本紀錄未宣稱全套通過。

## 開發環境部署證據
dev 合併提交 b61f87d804edcbb8202c16bfd17f9d8cd78bf115；CI run 36967167176 attempt 2 Repository checks SUCCESS。第一次既有版面測試未回傳 Chrome DOM；同 SHA 未改程式重跑成功。
固定網址 https://dev.four-symbols-dev.pages.dev 的 manifest SHA、Game／Cache 173.72 閘門通過；artifact 11210577025 的 forge/evidence.json：environment=deployed-dev，sha=b61f87d804edcbb8202c16bfd17f9d8cd78bf115，passed=true；兩個手機尺寸的扣料／持久化／穿卸加成／雲端權威拒絕皆通過，截圖已核對。
第一階段 Requirements：6/6 VERIFIED。

## 驗收界線
Chrome 模擬手機尺寸與觸控事件，不代表 Android 實體裝置驗收。使用一次性測試 UID、唯讀雲端測試回應及本機物品，沒有寫入玩家雲端或發送玩家物品。第二尺寸沿用已 READY 的 Runtime，重新放入測試物品，避免固定唯讀雲端回應與測試本機修改存檔衝突。

正式可信後端鑲嵌交易與寶石取得來源仍未實作；帶雲端權威基底／指紋的角色拒絕本機鑲嵌。這些後續功能不在第一階段最小模型的驗收範圍。main 未修改，未正式發布。
