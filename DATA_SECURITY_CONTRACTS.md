# DATA_SECURITY_CONTRACTS.md

## 1. 文件地位

本文件是《四象江湖傳》帳號、Firebase（雲端服務）、Firebase Auth（身分驗證）、UID（使用者唯一識別）、本機存檔、雲端存檔、多裝置同步、資料遷移、權限、Firestore Rules（資料庫安全規則）、Secret（機密）、管理員後台、個人資料、Log（紀錄）、環境隔離、備份、還原與 Disaster Recovery（災難復原）的最高權威文件。

凡涉及上述任一項，必須同時遵守 `SYSTEM_CONTRACTS.md` 的 Owner（擁有者）、Lifecycle（生命週期）、Mutation（狀態變更）、Invariant（不變條件）、Transaction（交易）與 Test Fixture（測試夾具）規則。

若同時涉及 Real Money（เงินจริง）、訂單或付費權益，還必須完整遵守 `PAYMENT_ENTITLEMENT_CONTRACTS.md`。

---

## 2. Identity Authority（身份權威）與 Account Ownership（帳號所有權）

Firebase Auth（身分驗證）與其已驗證 UID（使用者唯一識別）是帳號 Ownership（所有權）的權威來源。

不同 UID（使用者唯一識別）不得共享正式：

- Character（角色）。
- Inventory（背包）。
- Equipment（裝備）。
- Gold（金幣）。
- Relic（秘寶）。
- Progress（進度）。
- Paid Entitlement（付費權益）。
- 郵件、補償、訂單歸屬或其他玩家資產。

UI（使用者介面）顯示名稱、Facebook（社群登入）帳號名稱、Google（搜尋服務登入）電子郵件、Local Storage（本機儲存）中的舊 UID（使用者唯一識別）或網址參數都不得取代 Firebase Auth（身分驗證）對目前登入身份的權威。

Anonymous Auth（匿名登入）仍必須具有獨立 UID（使用者唯一識別）；不得以「訪客」為理由共用同一正式玩家資料。

---

## 3. Account Switch（帳號切換）永久規則

切換 UID（使用者唯一識別）時必須：

1. 停止或失效化舊帳號的 Async Callback（非同步回呼）。
2. 清除舊 Runtime Context（執行環境）中的可變玩家狀態。
3. 解除舊 Character（角色）、Inventory（背包）、Equipment（裝備）、Gold（金幣）、Relic（秘寶）、Progress（進度）與其他資產 Owner（擁有者）。
4. 重新以新 UID（使用者唯一識別）解析正式存檔。
5. 完成新帳號資料 Hydration（資料載入）後，才可進入 READY（就緒）。
6. 任何舊 UID（使用者唯一識別）的 Callback（回呼）抵達時，都必須被 Token（權杖）／Context（上下文）檢查拒絕。

禁止在 UID（使用者唯一識別）切換後沿用前一帳號的記憶體資料，等待「之後再覆蓋」。

---

## 4. Session（登入工作階段）與第三方登入

Facebook（社群登入）、Google（搜尋服務登入）或其他登入方式只負責取得可信身份並交由 Firebase Auth（身分驗證）建立或恢復正式 Session（登入工作階段）。

第三方登入 Token（權杖）不得被當作遊戲內玩家資產 Owner（擁有者）或直接用來決定玩家存檔。

Session（登入工作階段）相關永久規則：

- 不得把 Token（權杖）寫入不安全 Log（紀錄）。
- 不得把 Token（權杖）當網址長期參數。
- 不得跨 UID（使用者唯一識別）重用舊 Session Context（登入工作階段上下文）。
- 登出後，舊 Session（登入工作階段）的非同步結果不得重新 Hydrate（載入）玩家資料。
- 開發、測試與正式環境的登入設定必須遵守環境隔離。

---

## 5. Cloud Save（雲端存檔）Source of Truth（唯一真實資料）

任何實作都必須明確定義：

- Local Save（本機存檔）是否為快取、離線副本、候選版本或正式真相。
- Cloud Save（雲端存檔）是否為正式真相、同步端或備份端。
- 衝突時由誰決策。
- 版本、時間戳、Revision（修訂版本）或其他衝突資訊由誰產生。

不得同時把本機與雲端都視為無條件 Source of Truth（唯一真實資料）。

現有實作若採取「已驗證 UID（使用者唯一識別）下的本機完整存檔可離線進入」等策略，施工前必須先確認正式 Owner（擁有者）、解析流程與 `ARCHITECTURE_RULES.md` 的 Boot（啟動）契約，不得自行重定義。

---

## 6. Cloud Save（雲端存檔）衝突與失敗模式

必須明確處理：

- 多裝置。
- 同時修改。
- Offline（離線）。
- 網路恢復。
- 雲端舊資料。
- 本機新資料。
- 雲端新資料。
- 本機舊資料。
- 版本衝突。
- Migration（資料遷移）。
- 讀取失敗。
- 寫入失敗。
- 部分同步失敗。
- 重複同步回呼。
- Stale Callback（過期回呼）。

資料讀取失敗不得直接被當成「新玩家」。

不得因 Firebase（雲端服務）、Firestore（雲端資料庫）、Auth（身分驗證）、網路或 Migration（資料遷移）暫時失敗而：

- 清空玩家進度。
- 顯示創角並覆蓋舊玩家資料。
- 建立新的空白正式存檔。
- 將錯誤狀態上傳覆蓋原本有效雲端資料。

若無法證明資料為「已驗證不存在」，就不得把它當成空資料。

---

## 7. Multi-device Sync（多裝置同步）永久規則

多裝置同步必須具備可判斷先後與衝突的正式機制，不能只依賴「最後一個回呼覆蓋」。

至少要能回答：

1. 每份存檔的版本如何識別。
2. 兩台裝置同時修改時如何偵測。
3. 是否允許 Last Write Wins（最後寫入者優先）；若允許，哪些資料可以接受。
4. 玩家資產是否需要更嚴格的交易或伺服器驗證。
5. Offline（離線）變更恢復連線後如何合併或拒絕。
6. Stale Write（過期寫入）如何防止。
7. 衝突需要人工介入時如何保留雙方證據。

高價值玩家資產不得僅靠客戶端時間戳決定勝負。

---

## 8. Persistence（持久化）與 Migration（資料遷移）

任何持久化 Schema（資料結構）變更必須：

- 有明確版本。
- 有 Migration（資料遷移）入口。
- 可辨識舊版本。
- 對讀取失敗與寫入失敗有安全處理。
- 不因 Migration（資料遷移）異常誤判成新玩家。
- 在寫回前保留足夠驗證，避免把錯誤資料永久化。
- 需要時保留可回復版本或備份。

Migration（資料遷移）不得由 UI（使用者介面）隨意觸發或分散到多個畫面。

---

## 9. Environment Isolation（環境隔離）

Development（開發環境）與 Production（正式環境）不得共用正式玩家資料庫。

必須有明確隔離策略涵蓋：

- Firebase Project（雲端專案）。
- Firestore（雲端資料庫）。
- Auth（身分驗證）設定。
- Storage（儲存服務）。
- Functions（雲端函式）或其他 Backend（後端）。
- 管理員後台。
- Payment Sandbox（付款測試環境）。
- 測試玩家資料。

永久規則：

- 測試帳號不得污染正式玩家資料。
- 測試付款不得產生正式 Entitlement（玩家付費權益）。
- Sandbox（測試環境）資料不得流入 Production（正式環境）。
- Production（正式環境）資料不得複製到開發環境，除非已完成必要去識別化、權限批准與安全流程。
- 自動化 Test（測試）不得對正式玩家資料執行破壞性操作。

---

## 10. Firestore Rules（資料庫安全規則）與 Authorization（授權）

Firestore Rules（資料庫安全規則）與其他後端 Authorization（授權）必須以已驗證身份與最小權限為原則。

不得只靠前端隱藏按鈕或路由來保護資料。

所有可寫玩家資料的規則必須能回答：

- 哪個 UID（使用者唯一識別）可寫。
- 可寫哪些欄位。
- 是否允許跨 UID（使用者唯一識別）。
- 是否能直接增加高價值資產。
- 是否允許客戶端偽造管理員欄位。
- 是否允許覆蓋 Ownership（所有權）欄位。
- 是否會繞過 Server Verification（伺服器驗證）。

付費權益、人工補償、管理員資產修改等高風險寫入，原則上不得只依賴一般玩家客戶端權限。

---

## 11. Secret（機密）永久規則

以下資料不得硬寫在前端 Repository（程式庫）或可公開下載的前端資產：

- 私密 API Secret（介面密鑰）。
- Payment Secret（金流密鑰）。
- Webhook Secret（通知驗證密鑰）。
- Admin Token（管理員權杖）。
- 私鑰。
- 可直接操作正式玩家資料的 Credentials（憑證）。
- Service Account（服務帳號）私鑰。
- 其他具伺服器權限的認證資料。

前端可公開設定，例如部分 Firebase Web Config（網頁設定），必須與真正 Secret（機密）明確區分；「出現在設定檔」不等於它是 Secret（機密），而是否具有敏感能力才是判斷依據。

禁止因為某個 Secret（機密）已意外進入 Git（版本控制）就繼續使用；一旦洩漏，必須視為已暴露並進行 Rotate（輪替）。

---

## 12. Personal Data（個人資料）與 Log（紀錄）

不得在 Log（紀錄）、Console（主控台）、Crash Report（崩潰報告）或 Analytics（分析）中隨意輸出：

- 密碼。
- Token（權杖）。
- Cookie（登入識別）。
- 完整付款資訊。
- CVV（信用卡安全碼）。
- Secret（密鑰）。
- 私鑰。
- 敏感身份資料。
- 不必要的完整個人資料。

Log（紀錄）應採 Data Minimization（資料最小化）：

- 只記除錯所需資訊。
- 能用內部識別就不要輸出完整個資。
- 有保存期限與權限控制。
- Production（正式環境）不得長期保留不必要敏感內容。

付款卡號與 CVV（信用卡安全碼）原則上不得由遊戲自行保存，應交由正式 Payment Provider（金流服務商）處理。

---

## 13. Admin Backend（管理員後台）永久規則

任何管理員後台功能，例如：

- 補償。
- 補發。
- 查詢帳號。
- 查訂單。
- 修改玩家資產。
- 封鎖。
- 退款處理。
- 權益調整。
- 郵件補償。

都必須具有：

- Authentication（身分驗證）。
- Authorization（授權）。
- Audit Log（稽核紀錄）。

不得設計成「知道網址就能進」。

管理員權限應遵循 Least Privilege（最小權限）；查詢權、補償權、退款權、資產修改權可依風險拆分，不應預設所有管理員都有最高權限。

---

## 14. Admin Audit Log（管理員稽核紀錄）

每次管理員高風險操作至少記錄：

- 誰操作。
- 何時操作。
- 對哪個 Player UID（玩家識別）。
- 修改前後或至少修改內容。
- 修改原因。
- 關聯 Order ID（訂單編號）／Transaction ID（交易編號），若適用。
- 操作結果。
- 失敗原因，若失敗。
- Request ID（請求識別）或等價追蹤資訊。

Audit Log（稽核紀錄）本身不得讓一般玩家修改或刪除。

---

## 15. Backup（備份）、Restore（還原）與 Disaster Recovery（災難復原）

高價值玩家資料必須有與風險相稱的備份與還原策略。

至少應明確定義：

- 備份範圍。
- 備份頻率。
- 保存期限。
- 誰可以存取。
- 如何驗證備份可用。
- 如何執行 Restore（還原）。
- 如何避免還原時覆蓋較新的合法交易。
- 付款與 Entitlement（玩家付費權益）資料如何與遊戲資產對齊。
- Disaster Recovery（災難復原）時的 Recovery Point Objective（復原點目標）與 Recovery Time Objective（復原時間目標），若系統規模已需要正式定義。

不得只「有備份」但從未驗證可還原。

Restore（還原）屬高風險 Mutation（狀態變更），必須有授權、稽核與對帳。

---

## 16. Security Failure Mode（安全失敗模式）

涉及身份、存檔、權限與高價值資產時，原則上採 Fail Closed（安全關閉）而非 Fail Open（失敗放行）。

例如：

- 無法驗證 UID（使用者唯一識別）時，不得猜測帳號。
- 雲端資料讀取失敗時，不得當成新玩家。
- 無法驗證管理員權限時，不得允許操作。
- 無法驗證付款狀態時，不得發貨。
- Secret（機密）設定缺失時，不得以硬編碼後門繞過。

對玩家體驗可以 Graceful Degradation（優雅降級），但不得降低資料所有權與安全邊界。

---

## 17. Security Test（安全測試）與 Test Fixture（測試夾具）

測試帳號、測試 UID（使用者唯一識別）、測試 Firebase Project（雲端專案）與測試資料必須與 Production（正式環境）隔離。

安全測試至少要避免：

- 使用正式玩家 UID（使用者唯一識別）作為可寫測試目標。
- 讓測試 Rules（規則）比正式規則更寬鬆卻誤宣稱正式安全。
- 在測試 Fixture（測試夾具）中硬塞管理員權限繞過正式 Authorization（授權）流程。
- 把 Production Secret（正式機密）放入測試 Repository（程式庫）。
- 測試完留下可用的後門帳號或測試碼。

---

## 18. AI（人工智慧）施工前 Security Contract Check（安全契約檢查）

只要本次修改涉及 Firebase（雲端服務）、帳號、UID（使用者唯一識別）、本機／雲端同步、雲端資料、權限、Secret（機密）、管理員後台或玩家高價值資產，除 `SYSTEM_CONTRACTS.md` 的 System Contract Check（系統契約檢查）外，還必須回答：

1. 目前身份權威是什麼？
2. 本次資料屬於哪個 UID（使用者唯一識別）？
3. 哪一端是 Source of Truth（唯一真實資料）？
4. 本機／雲端衝突如何處理？
5. 讀取失敗是否可能被誤判成空資料？
6. 寫入失敗是否可能造成資料遺失？
7. 是否有 Stale Callback（過期回呼）跨帳號污染？
8. Development（開發）與 Production（正式）是否隔離？
9. Firestore Rules（資料庫安全規則）或後端 Authorization（授權）是否需要改動？
10. 是否涉及 Secret（機密）？
11. Log（紀錄）是否可能洩漏敏感資料？
12. 是否需要 Admin Audit Log（管理員稽核紀錄）？
13. Migration（資料遷移）是否安全？
14. Backup（備份）／Restore（還原）是否受影響？

無法回答時，先調查；不得施工。

---

## 19. Definition of Done（完成定義）補充

涉及帳號、雲端、安全或後台的修改，除 `SYSTEM_CONTRACTS.md` 外，只有以下全部成立才算完成：

- UID（使用者唯一識別）所有權不會跨帳號。
- 舊 Runtime Context（執行環境）不會污染新帳號。
- 讀取失敗不會被誤判成新玩家。
- 寫入失敗不會無聲覆蓋合法資料。
- 多裝置衝突有正式處理。
- Migration（資料遷移）有版本與失敗模式。
- Development（開發）與 Production（正式）資料隔離。
- Secret（機密）未進入前端或 Repository（程式庫）。
- Log（紀錄）未輸出敏感資料。
- 後台具 Authentication（身分驗證）、Authorization（授權）與 Audit Log（稽核紀錄）。
- 必要 Backup（備份）與 Restore（還原）策略未被破壞。
- 必要 Regression Test（回歸測試）通過。

---

## 20. 與其他規範的責任邊界

- 本文件不重新定義一般遊戲邏輯 Owner（擁有者）；跨系統狀態契約以 `SYSTEM_CONTRACTS.md` 為準。
- 本文件不重新定義付款發貨與退款細節； Real Money（เงินจริง）與 Entitlement（玩家付費權益）以 `PAYMENT_ENTITLEMENT_CONTRACTS.md` 為準。
- Boot（啟動）與現有 UID（使用者唯一識別）啟動架構仍受 `ARCHITECTURE_RULES.md` 與相關專項文件約束。
- 其他文件不得複製本文件整份內容；只保留交叉引用與自己的專項責任。
