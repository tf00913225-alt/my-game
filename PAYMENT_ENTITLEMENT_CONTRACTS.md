# PAYMENT_ENTITLEMENT_CONTRACTS.md

## 1. 文件地位與最高原則

本文件是《四象江湖傳》 Real Money（เงินจริง）付款、訂單、刷卡、金流、Sandbox（測試環境）、Production（正式環境）、Webhook（伺服器通知）、Server Verification（伺服器驗證）、Transaction ID（交易編號）、Idempotency（冪等性）、Entitlement（玩家付費權益）、發貨、退款、補發、人工補償、對帳與 Audit Log（稽核紀錄）的最高權威文件。

所有付款相關流程同時受 `SYSTEM_CONTRACTS.md` 的 Owner（擁有者）、Lifecycle（生命週期）、Mutation（狀態變更）、Transaction（交易）、Async（非同步）與 Test Fixture（測試夾具）規則，以及 `DATA_SECURITY_CONTRACTS.md` 的身份、安全、Secret（機密）、環境隔離與後台規則約束。

最高原則：

> **前端永遠不能自己宣布付款成功，也不能自己把付款成功等同於已成功發貨。**

---

## 2. Trusted Payment Result（可信付款結果）

以下都不能作為正式發貨依據：

- 「付款成功」頁面。
- URL Parameter（網址參數）。
- 前端 JavaScript（程式碼）狀態。
- 玩家自己回報成功。
- 單純跳轉回遊戲。
- 本機 Storage（儲存）中的付款旗標。
- UI（使用者介面）顯示。
- 自製測試碼。
- 客戶端自行組出的 Transaction ID（交易編號）。

正式發貨必須依據受信任 Server Verification（伺服器驗證）或正式 Payment Provider（金流服務商）確認。

若 Payment Provider（金流服務商）提供 Webhook（伺服器通知），Webhook（伺服器通知）仍必須驗證來源、簽章、事件內容與環境，不能只因收到 HTTP（網路協定）請求就信任。

---

## 3. Payment Lifecycle（付款生命週期）

正式 Payment Lifecycle（付款生命週期）至少區分：

1. Order Created（訂單建立）。
2. Pending Payment（等待付款）。
3. Provider Confirmed（金流服務商確認）。
4. Server Verified（伺服器驗證完成）。
5. Entitlement Granting（權益發放中）。
6. Entitlement Granted（權益已發放）。
7. Completed（完成）。

並必須能獨立表達必要例外狀態：

- Unpaid（未付款）。
- Payment Failed（付款失敗）。
- Grant Failed（發貨失敗）。
- Refunded（已退款）。
- Partially Refunded（部分退款）。
- Disputed（爭議中）。
- Cancelled（已取消）。
- Revocation Pending（回收中），若適用。
- Revoked（已回收），若適用。

不得把「付款成功」與「虛寶已成功發放」當成同一狀態。

系統必須能明確辨識「已付款，但尚未成功發貨」。

---

## 4. Order（訂單）與 Identity（身份）綁定

每筆正式 Order（訂單）至少必須可追溯：

- Order ID（訂單編號）。
- Player UID（玩家識別）。
- Product ID（商品識別）。
- Environment（環境）。
- 建立時間。
- 正式價格與幣別。
- Provider（金流服務商）。
- Payment Status（付款狀態）。
- Entitlement Status（權益狀態）。
- Transaction ID（交易編號），若已產生。

不得僅依賴前端傳入的 UID（使用者唯一識別）、價格或商品內容；伺服器端必須以可信資料與正式商品定義驗證。

---

## 5. Server Verification（伺服器驗證）永久規則

Server Verification（伺服器驗證）至少要確認：

- Order ID（訂單編號）存在。
- Order（訂單）屬於正確 Player UID（玩家識別）。
- Product ID（商品識別）符合正式訂單。
- 金額與幣別符合正式價格。
- Environment（環境）正確。
- Payment Provider（金流服務商）事件可信。
- Transaction ID（交易編號）有效。
- 該交易尚未被成功發貨。
- 訂單目前狀態允許進入發貨。
- 若有簽章或 Webhook Secret（通知驗證密鑰），驗證已通過。

前端不能跳過 Server Verification（伺服器驗證）。

---

## 6. Idempotency（冪等性）永久規則

同一筆 Transaction ID（交易編號）與 Order ID（訂單編號）只能成功發貨一次。

Webhook（伺服器通知）即使到達 2 次、5 次、10 次，玩家正式資產仍只能增加一次。

網路 Retry（重試）、伺服器 Retry（重試）、頁面 Reload（重新載入）、App（應用程式）重開或管理員重送都不能再次發貨。

Idempotency（冪等性）必須由正式後端／交易 Owner（擁有者）保證，不能只靠前端把按鈕 Disable（停用）。

同一交易的去重紀錄必須具有持久化能力，不能只存在單一程序記憶體。

---

## 7. Payment（付款）與 Entitlement（玩家付費權益）必須分離

Payment（付款）回答：「錢是否成功收到／交易是否成立」。

Entitlement（玩家付費權益）回答：「玩家是否已取得購買內容」。

兩者必須獨立記錄。

永久 Invariant（不變條件）：

- 未完成可信付款驗證，不得進入正式發貨。
- 已付款但發貨失敗時，付款狀態不得被改回未付款來掩蓋。
- 已發貨但回應遺失時，Retry（重試）不得再次發貨。
- 已退款時，必須依商品規格進入對應回收／保留流程，不能只改付款旗標。

---

## 8. Entitlement Grant（權益發放）永久規則

正式 Entitlement Grant（權益發放）必須走唯一 Grant Owner（發放擁有者）／Grant API（發放介面）。

禁止：

- 直接手改 Inventory（背包）。
- 直接改 Gold（金幣）或付費幣。
- 直接改 Relic（秘寶）數量。
- 直接改月卡日期。
- 直接在 UI（使用者介面）寫入權益。
- 以 URL（網址）成功參數觸發資產增加。

Grant（發放）必須具備：

- 唯一 Grant ID（發放識別）或可由 Order ID（訂單編號）／Transaction ID（交易編號）唯一去重。
- Player UID（玩家識別）。
- Product ID（商品識別）。
- 發放內容。
- Source（來源）=`payment-grant`（付款發貨）或更精確的正式來源。
- 發放結果。
- 時間。
- 可稽核資訊。

---

## 9. Sandbox（測試環境）與 Production（正式環境）永久隔離

Sandbox（測試環境）與 Production（正式環境）必須隔離：

- 測試商店代號。
- 測試 API（介面）。
- 測試 Secret（密鑰）。
- 測試卡號。
- 測試驗證碼。
- 測試 Webhook（通知）。
- 測試 Order（訂單）。
- 測試 Transaction（交易）。
- 測試玩家資料。
- 測試 Entitlement（玩家付費權益）。

正式 Secret（密鑰）不得拿去測試。

測試卡不得誤進正式付款流程。

Sandbox（測試環境）的成功事件不得發放 Production（正式環境）玩家資產。

Production（正式環境）不得保留「輸入某個碼就視為付款成功」的後門。

---

## 10. Double Spend（重複扣款）／Double Grant（重複發貨）永久規則

必須防止下列情境造成重複訂單、重複扣款或重複發貨：

- 玩家連點兩次。
- 頁面 Reload（重新載入）。
- 網路 Retry（重試）。
- Webhook（通知）重送。
- 瀏覽器返回上一頁。
- App（應用程式）重新開啟。
- Server（伺服器）重啟後重試。
- 客服人工再送一次。
- Callback（回呼）重複執行。

前端可做 Button Lock（按鈕鎖定）提升體驗，但真正防重必須在正式訂單與伺服器交易層完成。

對「建立訂單」與「發貨」應分別設計適當的 Idempotency（冪等性）策略。

---

## 11. Refund（退款）永久規則

每種付費商品在上線前必須明確定義：

- 是否可退款。
- 退款後 Entitlement（玩家付費權益）是否回收。
- 已消耗虛寶如何處理。
- 是否允許負餘額。
- 月卡／期限型權益如何處理。
- 部分退款如何處理。
- 爭議款如何處理。
- Chargeback（拒付／爭議扣款）如何處理。
- 人工客服何時介入。
- 是否需要封鎖後續消耗或暫停權益。

收到退款通知後不得直接刪除玩家全部資料。

Refund（退款）必須以 Order（訂單）與 Entitlement（玩家付費權益）為範圍處理，並留下 Audit Log（稽核紀錄）。

---

## 12. Revocation（權益回收）永久規則

若退款需要回收權益，必須走正式 Revocation（回收）流程，而不是直接手改玩家資料。

回收流程至少必須：

- 指向原 Order ID（訂單編號）。
- 指向原 Transaction ID（交易編號）。
- 指向 Player UID（玩家識別）。
- 指向原 Grant（發放）紀錄。
- 定義回收內容。
- 記錄回收結果。
- 防止重複回收。
- 處理已消耗或不足的情況。
- 必要時產生人工審核狀態。

---

## 13. 漏發／補發永久規則

若玩家付款成功但未收到虛寶，補發不得直接手改 Inventory（背包）或其他資產。

必須走正式 Grant（發放）流程，並記錄：

- 原 Order ID（訂單編號）。
- Transaction ID（交易編號）。
- Player UID（玩家識別）。
- 補發內容。
- 補發原因。
- 操作者。
- 時間。
- 是否已完成。
- 原發貨失敗原因，若可得。
- 新 Grant ID（發放識別）或與原訂單綁定的去重依據。

同一訂單不得人工補發兩次。

人工補發仍必須經 Authorization（授權）與 Audit Log（稽核紀錄）。

---

## 14. Mail Compensation（郵件補償）與人工補償

郵件補償、全服補償與個別人工補償若會增加玩家資產，都必須走正式資產 Grant（發放）流程。

不得讓「郵件附件」本身成為無限制直接修改 Inventory（背包）的第二個 Owner（擁有者）。

每筆補償至少需要：

- Compensation ID（補償識別）。
- Player UID（玩家識別）或正式目標集合。
- 發放內容。
- Source（來源）=`mail-compensation`（郵件補償）或更精確來源。
- 原因。
- 操作者／系統來源。
- 發放狀態。
- 領取狀態，若採領取制。
- 去重依據。

若補償與特定付款漏發有關，必須關聯原 Order ID（訂單編號）與 Transaction ID（交易編號）。

---

## 15. Reconciliation（對帳）永久規則

系統必須能對照：

1. 遊戲 Order（訂單）。
2. Payment Provider（金流服務商）紀錄。
3. Entitlement Grant（權益發放）紀錄。
4. 玩家實際資產。
5. Refund（退款）／Dispute（爭議）紀錄。
6. 人工補發／補償紀錄。

不能只靠玩家說「沒有收到」。

對帳必須能查出：

- 付款是否成功。
- Server Verification（伺服器驗證）是否成功。
- 發貨是否成功。
- 發貨是否重複。
- 是否存在「已付款未發貨」。
- 是否退款。
- 是否已回收。
- 是否人工補發。
- 玩家資產是否與正式交易紀錄一致。

對帳工具不得直接成為修改玩家資產的捷徑；需要修正時仍必須走正式 Grant（發放）／Revocation（回收）流程。

---

## 16. Webhook（伺服器通知）永久規則

Webhook（伺服器通知）是外部非同步輸入，必須視為高風險 Async Callback（非同步回呼）。

處理前必須：

- 驗證簽章或 Payment Provider（金流服務商）規定的正式驗證方式。
- 驗證 Environment（環境）。
- 驗證事件類型。
- 驗證 Order ID（訂單編號）／Transaction ID（交易編號）。
- 驗證事件與玩家／商品的綁定。
- 執行 Idempotency（冪等性）檢查。
- 防止過期、偽造或重放事件造成非法發貨。

Webhook Secret（通知驗證密鑰）不得出現在前端 Repository（程式庫）。

Webhook（伺服器通知）處理成功與 Entitlement Grant（權益發放）成功是兩個可分離狀態；必要時應可重試後者而不重複前者的付款認列。

---

## 17. Payment Test Code（付款測試碼）永久規則

任何：

- 測試卡號。
- 測試驗證碼。
- 測試商店編號。
- 測試 Secret（密鑰）。
- 測試 Webhook（通知）。

只能用於正式 Payment Provider（金流服務商）提供的 Sandbox（測試環境）。

不得自行發明「測試成功訊號」。

不得在 Production（正式環境）加入：

- 輸入某個碼就視為付款成功。
- 特定網址參數就自動發貨。
- 特定 UID（使用者唯一識別）跳過伺服器驗證。
- 隱藏按鈕直接增加付費資產。

任何測試 Backdoor（後門）不得進入正式 Runtime（執行程式）。

---

## 18. Payment Secret（付款機密）與前後端邊界

以下資料只能存在於受保護的 Server（伺服器）或正式 Secret Management（機密管理）：

- Payment Secret（金流密鑰）。
- Webhook Secret（通知驗證密鑰）。
- 私鑰。
- 能代表商戶執行高權限操作的 Credentials（憑證）。

前端只能持有 Payment Provider（金流服務商）明確設計為公開使用的識別或公鑰型設定。

即使前端程式碼被完整查看，也不得能偽造正式付款成功或直接發放 Entitlement（玩家付費權益）。

---

## 19. Audit Log（稽核紀錄）永久規則

以下高風險操作必須留下不可由一般玩家修改的 Audit Log（稽核紀錄）：

- 付款認列。
- 發貨。
- 發貨失敗。
- Retry（重試）。
- 退款。
- 部分退款。
- 爭議款。
- 權益回收。
- 人工補發。
- 郵件補償。
- 管理員手動調整。
- 對帳修正。

紀錄至少包含：

- 誰或哪個系統操作。
- 時間。
- Player UID（玩家識別）。
- Order ID（訂單編號）。
- Transaction ID（交易編號）。
- Product ID（商品識別）。
- 變更內容。
- 原因。
- 結果。
- Request ID（請求識別）或等價追蹤資訊。

Audit Log（稽核紀錄）不應記錄完整卡號、CVV（信用卡安全碼）或 Secret（密鑰）。

---

## 20. 玩家資產 Source（來源）永久規則

所有由付款、退款、補發或補償造成的玩家資產變更必須具有 Source（來源）。

至少應能表達：

- `payment-grant`（付款發貨）。
- `refund-revoke`（退款回收）。
- `mail-compensation`（郵件補償）。
- `manual-regrant`（人工補發），若專案採此命名。
- 其他經正式規格批准的來源。

Source（來源）必須與 Order ID（訂單編號）、Transaction ID（交易編號）、Grant ID（發放識別）或 Compensation ID（補償識別）等可追溯識別連結。

---

## 21. Failure Mode（失敗模式）永久規則

付款流程必須預先定義至少以下 Failure Mode（失敗模式）：

- 訂單建立成功，但前端未收到回應。
- 付款成功，但 Webhook（伺服器通知）延遲。
- Webhook（伺服器通知）收到，但 Server Verification（伺服器驗證）失敗。
- 付款已驗證，但 Grant（發放）失敗。
- Grant（發放）成功，但伺服器回應遺失。
- Webhook（伺服器通知）重送。
- 玩家重開 App（應用程式）。
- 退款通知早於或晚於發貨。
- 部分退款。
- 管理員補發途中失敗。
- 對帳發現資產與交易紀錄不一致。

每個 Failure Mode（失敗模式）都必須確保不會產生重複扣款、重複發貨、無法追蹤的資產或資料破壞。

---

## 22. AI（人工智慧）施工前 Payment Contract Check（付款契約檢查）

任何涉及 Real Money（เงินจริง）、訂單、付款、付費虛寶、退款、補發、對帳、Webhook（伺服器通知）或 Sandbox（測試環境）的修改，在 `SYSTEM_CONTRACTS.md` 與 `DATA_SECURITY_CONTRACTS.md` 的檢查之外，還必須回答：

1. Order Owner（訂單擁有者）是誰？
2. Order ID（訂單編號）如何產生與持久化？
3. Payment Provider（金流服務商）是誰？
4. Server Verification（伺服器驗證）在哪裡？
5. 哪個欄位證明已付款？
6. 哪個欄位證明已發貨？
7. Idempotency（冪等性）鍵是什麼？
8. Transaction ID（交易編號）如何去重？
9. Entitlement Grant（權益發放）正式入口在哪裡？
10. 發貨失敗如何重試而不重複？
11. Refund（退款）如何處理？
12. Revocation（回收）如何處理？
13. Sandbox（測試環境）與 Production（正式環境）如何隔離？
14. Secret（密鑰）是否只在受信任 Server（伺服器）？
15. Webhook（伺服器通知）如何驗證？
16. Audit Log（稽核紀錄）記錄什麼？
17. Reconciliation（對帳）如何執行？
18. 玩家資產變更的 Source（來源）是什麼？

任一項無法回答，先調查；不得施工。

---

## 23. Definition of Done（完成定義）補充

付款相關修改只有以下全部成立才算完成：

- 前端不能自行宣布付款成功。
- Server Verification（伺服器驗證）已確認。
- Payment（付款）與 Entitlement（玩家付費權益）狀態分離。
- 同一 Order ID（訂單編號）／Transaction ID（交易編號）不會重複發貨。
- Retry（重試）安全。
- Webhook（伺服器通知）重送安全。
- Sandbox（測試環境）與 Production（正式環境）完全隔離。
- Production（正式環境）沒有測試成功後門。
- Secret（密鑰）不在前端或 Repository（程式庫）。
- 漏發可走正式 Grant（發放）流程補發。
- Refund（退款）與 Revocation（回收）有正式規則。
- Audit Log（稽核紀錄）完整。
- Reconciliation（對帳）可查出付款、發貨、退款與玩家資產差異。
- 必要 Regression Test（回歸測試）通過。
- 測試付款不會污染正式玩家資料。

---

## 24. 與其他規範的責任邊界

- 本文件只負責付款、訂單、Webhook（伺服器通知）、Server Verification（伺服器驗證）、Entitlement（玩家付費權益）、退款、補發、對帳與付款稽核。
- 一般遊戲狀態 Owner（擁有者）、Lifecycle（生命週期）、Mutation（狀態變更）與 Test Fixture（測試夾具）以 `SYSTEM_CONTRACTS.md` 為最高權威。
- UID（使用者唯一識別）、雲端資料、Secret（機密）、後台權限與環境隔離以 `DATA_SECURITY_CONTRACTS.md` 為最高權威。
- 其他文件不得複製本文件整份內容，只保留交叉引用與自己的專項責任。
