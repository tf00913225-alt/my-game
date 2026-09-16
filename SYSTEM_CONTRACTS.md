# SYSTEM_CONTRACTS.md

## 1. 文件地位與永久最高原則

本文件是《四象江湖傳》跨系統狀態正確性、Canonical Owner（唯一正式擁有者）、Source of Truth（唯一真實資料）、Lifecycle（生命週期）、Mutation（狀態變更）、Invariant（不變條件）、Transaction（交易一致性）、Derived State（衍生狀態）、Async（非同步）、Test Fixture（測試夾具）與 Regression（回歸驗證）的最高權威文件。

適用範圍包含現在與未來所有涉及 State（狀態）的系統，不限於戰鬥、Fixed Slot（固定格位）、技能、狀態、VFX（視覺特效）、背包、道具、裝備、合成、冶煉、商店、貨幣、經驗、掉落、寶箱、獎勵、秘寶、冒險、NPC（非玩家角色）、英雄、Boss（頭目）、深淵、副本、援軍、換波、帳號、存檔、雲端、後台、付款，以及尚未存在的新功能。

永久最高原則：

> **先證明一個狀態如何合法形成，再修改使用這個狀態的程式。**

禁止流程：

> 看到症狀 → 加 `if` → 測試通過 → 宣稱修好。

正式流程：

> Owner（擁有者） → Source of Truth（唯一真實資料） → Lifecycle（生命週期） → Mutation（狀態變更） → Invariant（不變條件） → Failure Mode（失敗模式） → Security Boundary（安全邊界） → Test Fixture（測試夾具） → 最小修改 → Regression（回歸驗證）。

若涉及 Real Money（เงินจริง），還必須遵守 `PAYMENT_ENTITLEMENT_CONTRACTS.md`，增加 Order（訂單） → Server Verification（伺服器驗證） → Idempotency（冪等性） → Entitlement（玩家付費權益） → Audit（稽核） → Reconciliation（對帳）。

---

## 2. Canonical Owner（唯一正式擁有者）與 Source of Truth（唯一真實資料）

任何重要遊戲狀態都必須有且只能有一個 Canonical Owner（唯一正式擁有者）。

任何系統施工前必須能回答：

1. 誰擁有這份狀態？
2. Source of Truth（唯一真實資料）在哪裡？
3. 正式建立入口在哪裡？
4. 什麼時候才算 READY（就緒）？
5. 誰可以修改？
6. 誰只能讀？
7. 是否有 Snapshot（快照）？
8. 是否有 Cache（快取）？
9. 是否有 Derived State（衍生狀態）？
10. 如何同步？
11. 何時清除？
12. 如何保存？
13. 如何重新建立？
14. Test（測試）如何建立 Production-equivalent State（正式等價狀態）？

任一項無法回答時，必須先調查；禁止直接施工。

Canonical Owner（唯一正式擁有者）不是「最常被呼叫的函式」，而是對該份正式狀態具有最終建立、驗證、變更與一致性責任的唯一權威。UI（使用者介面）、VFX（視覺特效）、Cache（快取）、Snapshot（快照）、排序結果、預覽資料與測試替身不得自行升格為第二個 Owner（擁有者）。

---

## 3. Lifecycle Contract（生命週期契約）

不能只確認「變數存在」，還必須確認「它在這個時間點依法是否應該存在」。

每個重要系統至少要能描述下列等價階段：

- 未初始化。
- 初始化中。
- 可使用／READY（就緒）。
- 執行中。
- 結算中。
- 清理中。
- 未啟用／已停用。

不要求實作一定使用上述字串或列舉名稱，但設計、施工、測試與除錯時必須能指出目前位於哪個等價階段，以及允許哪些 Mutation（狀態變更）。

Lifecycle（生命週期）跨階段時必須有清楚入口。不得靠 UI（使用者介面）顯示、布林值、DOM（文件物件模型）存在、VFX（視覺特效）出現或某個 Timer（計時器）來暗示正式生命週期已成立。

---

## 4. Runtime Invariant（執行期不變條件）

只要系統進入某一正式狀態，該狀態的 Invariant（不變條件）就必須永久成立，直到合法離開該狀態。

至少包含下列永久例子：

- 戰鬥正式開始且敵人存在時，在第一個 Battle Action（戰鬥行動）以前，正式 Fixed Slot Snapshot（固定格位快照）必須已存在。
- Inventory（背包）中的物品數量為 0 時，不得同時被判定為可使用。
- Craft（合成）成功後，材料扣除與成品增加必須同時成立。
- Shop Purchase（商店購買）成功後，貨幣減少與商品增加必須同時成立。
- Equipment（裝備）效果不得因重新 Render（渲染）而重複套用。
- Reward（獎勵）一旦正式標記已領取，Reload（重新載入）後不得再次領取。
- 帳號正式切換後，不得仍持有上一個 UID（使用者唯一識別）的可變 Runtime Context（執行環境）。
- Async Callback（非同步回呼）執行時，必須能證明原始 Context（上下文）仍有效。

新增或修改系統時，Invariant（不變條件）必須寫入 System Contract Card（系統契約卡）或同等規格。

---

## 5. Mutation Contract（狀態變更契約）

任何正式狀態變更只能經過正式 Mutation API（狀態變更介面）或 Canonical Owner（唯一正式擁有者）提供的等價入口。

禁止因為方便直接修改底層：

- Array（陣列）。
- Object（物件）。
- 金幣或其他貨幣。
- Inventory（背包）。
- Equipment（裝備）。
- EXP（經驗值）。
- 角色等級。
- 技能等級。
- Battle Roster（戰鬥陣容）。
- Snapshot（快照）。
- 雲端資料。
- 任何已有 Owner（擁有者）的正式狀態。

只要已有正式 API（介面）／Owner（擁有者）函式，Production Runtime（正式執行程式）與 Test（測試）原則上都必須走正式等價路徑。

直接寫底層資料只允許在明確的資料遷移工具、離線分析工具或特別批准的維修工具中存在，而且必須與正式 Runtime（執行程式）隔離並留下稽核依據；不得成為一般遊戲施工捷徑。

---

## 6. Derived State（衍生狀態）不得成為第二個真相

以下資料預設皆屬 Derived State（衍生狀態）：

- Snapshot（快照）。
- Cache（快取）。
- UI（使用者介面）顯示資料。
- 排序結果。
- 合成預覽。
- 商店預覽。
- 裝備後能力值。
- 戰鬥隊形的顯示投影。
- VFX（視覺特效）位置。
- 任何可由正式資料重新計算的暫存結果。

每一份 Derived State（衍生狀態）必須知道：

1. 由哪一份 Source of Truth（唯一真實資料）產生。
2. 何時建立。
3. 何時失效。
4. 誰負責更新。
5. 何時清除。
6. 是否允許重新計算。
7. 失效時是 Fail Fast（快速失敗）還是重新建立。

不得把 Snapshot（快照）、Cache（快取）或 UI（使用者介面）當作正式資料反寫來源，除非 Canonical Owner（唯一正式擁有者）的契約明確規定該路徑。

---

## 7. Transaction（交易）與跨系統一致性

任何一次操作若同時改變兩份以上正式狀態，預設視為 Transaction（交易）。

典型例子：

- 使用補品：物品 -1 + HP（生命值）恢復。
- 購買：貨幣減少 + 商品增加。
- 合成：材料減少 + 成品增加。
- 冶煉：原裝備 + 設計圖 + 材料 + 金幣扣除，再產生新裝備。
- 開寶箱：寶箱減少 + 獎勵增加。
- 領取獎勵：領取資格失效 + 玩家資產增加。
- 付款發貨：Entitlement Grant（權益發放）紀錄 + 玩家資產變更。

Transaction（交易）的永久規則：

1. 全部成功，或全部不發生。
2. 禁止半套成功。
3. 執行前一次驗證全部前置條件。
4. 不可先改一部分資料，再發現後續條件不成立。
5. Retry（重試）不得造成重複 Mutation（狀態變更）。
6. 對玩家資產的跨系統交易必須可追溯其 Source（來源）。
7. 若底層儲存技術無法提供真正原子交易，Owner（擁有者）必須提供具等價一致性、可重試、可回復且可驗證的正式流程。

---

## 8. Inventory（背包）與 Item（道具）永久規則

Inventory（背包）必須只有一個正式 Owner（擁有者）。

UI（使用者介面）不得自行保存正式物品數量。

物品使用前必須驗證：

- 物品是否存在。
- 數量是否足夠。
- 使用對象是否合法。
- 使用場景是否合法。
- 效果是否合法。
- 是否已在處理另一筆相同或衝突 Transaction（交易）。
- 是否會超過目標上限或資產上限。

只有效果真正成功後才可扣除物品。若效果失敗，物品不得消失。

必須防止快速雙擊、重複事件、重入呼叫造成一次使用卻扣除多份物品。

任何 UI（使用者介面）顯示的數量只能是 Inventory Owner（背包擁有者）正式資料的投影。

---

## 9. Equipment（裝備）永久規則

每件需要個別追蹤的裝備必須具有 Stable Identity（穩定唯一身分）。

裝備在背包、裝備欄、冶煉、出售、合成或其他系統之間移動時，不得失去、重建或混淆其唯一身分，除非正式規格明確定義該操作會消耗舊實體並建立新實體。

裝備能力必須由正式資料計算；UI（使用者介面）不得直接修改角色正式能力值。

永久 Invariant（不變條件）：

- 穿上裝備後效果只套用一次。
- 卸下裝備後效果完整移除。
- 登入、切換角色、Reload（重新載入）或重新 Render（渲染）不得重複套用。
- 裝備的顯示能力與正式計算來源必須可追溯。
- 裝備預覽不得修改正式角色能力。

---

## 10. Craft（合成）／Smelt（冶煉）永久規則

執行前必須一次驗證全部材料、原裝備、設計圖、貨幣、數量上限與其他正式條件。

禁止先扣一部分，再發現其他材料不足。

快速連點、事件重入或網路 Retry（重試）不得重複執行同一筆正式操作。

Preview（預覽）只能讀取與計算，不得修改正式資料。

成功後所有消耗與產出必須符合 Transaction（交易）規則；失敗則不得留下半套消耗或半套產出。

---

## 11. Shop（商店）／Currency（貨幣）永久規則

Gold（金幣）與任何未來貨幣都必須有唯一正式 Owner（擁有者）。

購買前至少驗證：

- 商品存在。
- 正式價格。
- 玩家餘額。
- 商品數量。
- 背包條件。
- 購買限制。
- 目前帳號與角色 Context（上下文）。
- 是否存在衝突中的相同 Transaction（交易）。

價格必須讀正式資料，禁止信任 UI（使用者介面）文字、按鈕屬性、網址參數或玩家端暫存值作為正式價格。

---

## 12. Reward（獎勵）／Drop（掉落）／Chest（寶箱）永久規則

Reward Generation（獎勵產生）與 Reward Grant（獎勵發放）必須分離。

「算出應該給什麼」不等於「已經成功發給玩家」。

所有正式獎勵都必須防止：

- 重複領取。
- 只領一半。
- Reload（重新載入）後再領。
- 網路 Retry（重試）再領。
- 重複 Callback（回呼）再領。
- UI（使用者介面）顯示成功但正式資產未落地。
- 正式資產已落地但領取狀態未完成。

若獎勵屬重要玩家資產，必須有唯一 Grant ID（發放識別）或等價去重機制，以及 Source（來源）。

---

## 13. Battle Lifecycle（戰鬥生命週期）永久規則

戰鬥必須走正式 Battle Lifecycle（戰鬥生命週期）。

禁止 Test（測試）只設定 `battleActive = true` 就宣稱已建立正式戰鬥。

正式戰鬥至少必須由現行正式入口建立並完成其必要初始化，包含等價於：

- Roster（陣容）。
- Formation（隊形）。
- Fixed Slot Snapshot（固定格位快照）。
- Battle Token（戰鬥識別）。
- Turn State（回合狀態）。
- Target State（目標狀態）。

若現有 Runtime（執行程式）實際還有其他必要 Owner State（擁有者狀態），亦自動納入正式戰鬥 READY（就緒）條件。

第一個 Battle Action（戰鬥行動）不得發生在正式戰鬥尚未 READY（就緒）時。

---

## 14. Fixed Slot（固定格位）永久規則

Fixed Slot Owner（固定格位擁有者）是戰場幾何與隊形的唯一正式 Owner（擁有者）。

禁止下列系統另外建立自己的位置系統：

- VFX（視覺特效）。
- Skill（技能）。
- Boss（頭目）。
- Target Resolver（目標解析器）。
- UI（使用者介面）。
- 其他戰鬥子系統。

Snapshot（快照）只能透過正式 Slot Owner API（格位擁有者介面）建立、更新、失效或重建。

Test（測試）禁止手工捏造 Snapshot Object（快照物件）來模擬正式狀態。

若正式 Snapshot（快照）不存在，而 Lifecycle（生命週期）要求它應存在，該問題屬 Lifecycle Violation（生命週期違規）或 Owner State（擁有者狀態）錯誤；不得由消費端偷偷補建。

---

## 15. Roster Mutation（陣容變更）永久規則

任何 Boss（頭目）援軍、召喚、復活、換波、深淵、副本、下一場戰鬥或其他會改變 Roster（陣容）的操作，必須明確屬於以下之一：

A. 單位仍留在原 Slot（格位），不需重建。

B. 透過 Slot Owner API（格位擁有者介面）正式加入、移除或移動。

C. 依正式規格重新建立 Snapshot（快照）。

禁止直接改 Array（陣列）後假設其他系統會自行察覺。

每次 Roster Mutation（陣容變更）都必須確認 Target State（目標狀態）、Turn State（回合狀態）、VFX Derived State（視覺特效衍生狀態）與其他依賴是否需要同步或失效。

---

## 16. VFX（視覺特效）永久規則

VFX（視覺特效）只負責顯示。

VFX（視覺特效）不得成為：

- Battle Owner（戰鬥擁有者）。
- Target Owner（目標擁有者）。
- Formation Owner（隊形擁有者）。
- Damage Owner（傷害擁有者）。
- Skill Owner（技能擁有者）。
- Status Owner（狀態擁有者）。

若 VFX（視覺特效）需要的正式狀態不存在，應視為 Lifecycle Violation（生命週期違規）、Owner State（擁有者狀態）錯誤或 Derived State（衍生狀態）同步錯誤。

禁止在 VFX（視覺特效）中偷偷：

- Create Snapshot（建立快照）。
- 補 Roster（陣容）。
- 修正式戰鬥資料。
- 改目標。
- 改傷害。
- 改技能結果。
- 改正式狀態。

---

## 17. Test Fixture（測試夾具）最高規則

Test Fixture（測試夾具）不得只是「長得像正式遊戲」，必須是 Production-equivalent State（正式等價狀態）。

如果 Production Runtime（正式執行程式）需要：

- `startBattle`（開始戰鬥）。
- Owner API（擁有者介面）。
- Snapshot（快照）。
- Initialization（初始化）。
- Lifecycle（生命週期）入口。

Test（測試）也必須經過正式等價方式。

禁止：

- 正式程式走 API（介面），測試直接 `splice`（陣列替換）底層 Array（陣列）。
- 正式程式走 `startBattle`（開始戰鬥），測試只改 `battleActive`（戰鬥啟用旗標）。
- 正式程式由 Snapshot Owner（快照擁有者）建立資料，測試自己手刻 Object（物件）。
- 為了讓測試方便而降低正式 Invariant（不變條件）。
- 測試依賴 Production Runtime（正式執行程式）永遠不可能出現的非法狀態。

若現有 Fixture（測試夾具）無法建立正式等價狀態，先修 Fixture（測試夾具）或測試入口，不得逼正式程式接受非法狀態。

---

## 18. Canonical Owner（唯一正式擁有者）變更時的 Legacy Fixture Audit（舊測試夾具稽核）

只要新增、替換或收斂 Canonical Owner（唯一正式擁有者），必須搜尋：

- Production Runtime（正式執行程式）。
- Test（測試）。
- Fixture（測試夾具）。
- Debug Tool（除錯工具）。

確認是否仍有人直接寫舊狀態。

不得只修改正式程式，卻留下舊測試、舊除錯工具或舊 Fixture（測試夾具）繞過新的 Owner（擁有者）。

稽核至少包含：舊欄位名、舊函式、舊 Array（陣列）寫入、舊 Snapshot（快照）建立、舊 Cache（快取）寫入與直接 Assignment（賦值）。

---

## 19. Async（非同步）永久規則

所有下列非同步來源在 Callback（回呼）真正執行時，都必須重新確認原始 Context（上下文）仍有效：

- `setTimeout`（延遲計時器）。
- `setInterval`（週期計時器）。
- Promise（非同步承諾）。
- Firebase Callback（雲端回呼）。
- Network Callback（網路回呼）。
- 動畫完成回呼。
- 延遲佇列。
- 使用者操作後延遲執行的任務。

必須確認原本的：

- 戰鬥。
- 頁面。
- 角色。
- 訂單。
- 帳號。
- Request（請求）。
- Action（行動）。

是否仍是同一份有效 Context（上下文）。

應使用 Battle Token（戰鬥識別）、Action Token（行動識別）、Request Token（請求識別）、Transaction ID（交易編號）或等價機制避免 Stale Callback（過期回呼）污染新狀態。

僅靠「變數現在還存在」不足以證明 Callback（回呼）仍合法。

---

## 20. Fail Fast（快速失敗）永久規則

Development（開發）與 Test（測試）遇到正式遊戲不可能存在的狀態時，應優先：

- Throw Error（拋出錯誤）。
- Assertion Failure（斷言失敗）。
- 明確拒絕進入下一個 Lifecycle（生命週期）階段。

禁止用下列行為掩蓋非法狀態：

- 沉默卡住。
- 無限等待。
- 無限遞迴。
- 無限同步。
- 最後只以 Timeout（逾時）結束。
- 消費端自動補建正式狀態。

Production（正式環境）需要 Graceful Failure（優雅失敗）時，也不得改寫正式真相；應安全中止操作並留下可追查資訊。

---

## 21. 玩家資產 Source（來源）與可追溯性

任何重要玩家資產變更都必須有 Source（來源）或等價來源欄位，至少涵蓋：

- Gold（金幣）。
- 未來付費幣。
- Inventory Item（背包物品）。
- 秘寶與秘寶碎片。
- 寶箱。
- Equipment（裝備）。
- 付費虛寶。
- 郵件補償。
- 重要進度資源。

建議來源類別至少能表達：

- `battle-reward`（戰鬥獎勵）。
- `shop-purchase`（商店購買）。
- `craft`（合成）。
- `smelt`（冶煉）。
- `mail-compensation`（郵件補償）。
- `payment-grant`（付款發貨）。
- `refund-revoke`（退款回收）。

Source（來源）不是 UI（使用者介面）顯示文字，而是正式 Mutation（狀態變更）可追溯資訊。

---

## 22. AI（人工智慧）施工前固定 System Contract Check（系統契約檢查）

任何邏輯修改前，AI（人工智慧）必須先回報：

1. 本次子系統。
2. Canonical Owner（唯一正式擁有者）。
3. Source of Truth（唯一真實資料）。
4. Lifecycle（生命週期）。
5. 正式 Mutation API（狀態變更介面）。
6. Derived State（衍生狀態）。
7. Persistence（持久化）。
8. Wrapper Chain（包裝呼叫鏈）。
9. Cross-system Dependencies（跨系統相依）。
10. Runtime Invariants（執行期不變條件）。
11. Test Fixture（測試夾具）是否正式等價。
12. 是否涉及帳號／雲端。
13. 是否涉及玩家資產。
14. 是否涉及 Real Money（เงินจริง）。
15. 是否涉及 Secret（機密）。
16. 是否涉及後台權限。
17. 本次修改可能破壞哪些契約。

未完成此檢查，不得施工。

若調查結果顯示 Owner（擁有者）、Lifecycle（生命週期）或 Source of Truth（唯一真實資料）不明，必須先停止修改並完成 Impact Audit（影響稽核）。

---

## 23. Bug（錯誤）固定根因分類

每次 Bug（錯誤）必須先分類：

- A. Source of Truth（唯一真實資料）錯誤。
- B. Owner State（擁有者狀態）錯誤。
- C. Lifecycle（生命週期）錯誤。
- D. Derived State（衍生狀態）不同步。
- E. UI（使用者介面）錯誤。
- F. Test Fixture（測試夾具）非法。
- G. Async Race（非同步競態）。
- H. Persistence（持久化）錯誤。
- I. Migration（資料遷移）錯誤。
- J. Security（安全）錯誤。
- K. Payment（付款）錯誤。
- L. Unknown（未知）。

根因尚未分類前，禁止用大量 `if`、Fallback（備援分支）或 Workaround（繞路補丁）掩蓋。

分類為 L. Unknown（未知）時，只代表仍需調查，不代表可以直接做 Defensive Fix（防禦性修補）。

---

## 24. 禁止 Defensive Fix（防禦性修補）掩蓋 Contract Violation（契約違規）

典型禁止案例：

- Snapshot（快照）不存在，不得立刻在 VFX（視覺特效）自動 `createSnapshot`（建立快照）。
- Inventory（背包）資料錯，不得直接在 UI（使用者介面）補一份。
- 付款狀態缺失，不得因前端顯示成功就直接發貨。
- 雲端讀取錯誤，不得直接建立新角色。
- Roster（陣容）不同步，不得由 Target Resolver（目標解析器）自行修陣列。
- 裝備能力錯誤，不得由 Render（渲染）重新套一次正式能力。

必須先找出原本在哪一個 Lifecycle（生命週期）階段就應建立、同步、驗證或清除。

---

## 25. 新系統自動受規範

未來新增任何功能，例如：

- 寵物。
- 公會。
- 拍賣。
- PVP（玩家對戰）。
- 郵件。
- 英雄。
- 每日任務。
- 排行榜。
- 交易所。
- 新貨幣。
- 訂閱。
- 月卡。
- 新支付方式。
- 任何現在不存在的功能。

只要涉及 State（狀態）、Owner（擁有者）、Lifecycle（生命週期）、Mutation（狀態變更）、Persistence（持久化）、UI（使用者介面）、Test（測試）、Security（安全）或 Payment（付款）任一項，就自動受本文件與對應高風險契約約束。

不得以「規範沒有寫這個功能」為理由繞過。

---

## 26. 新系統開發前必填 System Contract Card（系統契約卡）

任何新系統開發前必須完成：

```text
系統名稱：
Owner（擁有者）：
Source of Truth（唯一真實資料）：
初始化入口：
READY（就緒）條件：
正式 Mutation API（狀態變更介面）：
Derived State（衍生狀態）：
Persistence（持久化）：
Cleanup（清理）：
跨系統相依：
Runtime Invariants（執行期不變條件）：
可能 Race Condition（競態條件）：
Test Fixture Setup（測試環境建立方式）：
禁止直接修改的底層資料：
是否涉及 UID（使用者唯一識別）：
是否涉及雲端資料：
是否涉及玩家資產：
是否涉及 Real Money（เงินจริง）：
是否涉及 Secret（機密）：
```

完成後才可施工。

若涉及帳號、雲端、安全或後台，還必須套用 `DATA_SECURITY_CONTRACTS.md`；若涉及 Real Money（เงินจริง）、訂單或付費權益，還必須套用 `PAYMENT_ENTITLEMENT_CONTRACTS.md`。

---

## 27. 修改既有系統必做 Impact Audit（影響稽核）

不能只搜尋被改函式。必須搜尋：

- 誰呼叫它。
- 它呼叫誰。
- 誰修改相同資料。
- 誰讀相同資料。
- 誰建立。
- 誰清除。
- 誰保存。
- 誰載入。
- 誰 Render（渲染）。
- 誰測試。
- 誰做 Cache（快取）。
- 誰做 Snapshot（快照）。
- 誰做 Async Callback（非同步回呼）。
- 誰操作相同玩家資產。
- 誰依賴同一 UID（使用者唯一識別）或 Runtime Context（執行環境）。
- 是否存在 Legacy Fixture（舊測試夾具）繞過正式 Owner（擁有者）。

Impact Audit（影響稽核）的目標是確認真正的 Owner（擁有者）與所有相依，不是擴大修改範圍。最後仍應採最小必要修改。

---

## 28. Persistence（持久化）邊界

每份需要跨頁面、跨戰鬥、跨登入或跨裝置保存的狀態都必須明確標記：

- 是否需要 Persistence（持久化）。
- 保存 Owner（擁有者）。
- 保存時機。
- 載入時機。
- Schema Version（資料結構版本）。
- Migration（資料遷移）入口。
- 失敗模式。
- 是否允許從 Derived State（衍生狀態）重建。

禁止因為某份資料存在於記憶體、Local Storage（本機儲存）或 Firestore（雲端資料庫）就推定它是 Source of Truth（唯一真實資料）。

涉及帳號與雲端時，詳細規則以 `DATA_SECURITY_CONTRACTS.md` 為最高權威。

---

## 29. Regression（回歸驗證）永久規則

每次邏輯修改完成後，Regression（回歸驗證）至少必須覆蓋本次被觸碰契約的高風險路徑。

最低原則：

- 驗證合法生命週期可正常完成。
- 驗證非法生命週期在 Development（開發）／Test（測試）能 Fail Fast（快速失敗）。
- 驗證正式 Mutation API（狀態變更介面）仍是唯一正式變更入口。
- 驗證 Derived State（衍生狀態）不會成為第二個真相。
- 驗證 Retry（重試）／Double Click（雙擊）／Reload（重新載入）不會重複交易。
- 驗證 Test Fixture（測試夾具）以正式等價方式建立狀態。
- 驗證 Async Callback（非同步回呼）不污染新的 Context（上下文）。
- 驗證玩家資產交易不會半套成功。

只做本次風險所需的最小必要測試，不為文件規則本身建立無關大型測試系統。

---

## 30. Definition of Done（完成定義）

Bug（錯誤）修復或功能修改只有以下全部成立才算完成：

- 根因已確認。
- Owner（擁有者）已確認。
- Lifecycle（生命週期）已確認。
- Invariant（不變條件）已確認。
- 沒有新增第二個 Owner（擁有者）。
- 沒有讓 UI（使用者介面）承擔正式資料責任。
- 沒有讓 VFX（視覺特效）承擔正式戰鬥責任。
- Test（測試）使用 Production-equivalent State（正式等價狀態）。
- 沒有無關修改。
- 重要 Transaction（交易）不會半套成功。
- Async Callback（非同步回呼）不會污染新狀態。
- 帳號資料不會跨 UID（使用者唯一識別）。
- 測試資料不會污染正式資料。
- 付款不由前端自行宣告成功。
- 同一訂單不會重複發貨。
- Secret（機密）沒有進入前端或 Repository（程式庫）。
- 必要 Regression Test（回歸測試）通過。

涉及帳號、安全、雲端、後台時，還必須滿足 `DATA_SECURITY_CONTRACTS.md`。

涉及เงินจริง、訂單、退款、補發或付費權益時，還必須滿足 `PAYMENT_ENTITLEMENT_CONTRACTS.md`。

---

## 31. 與其他永久規範的責任邊界

- `SYSTEM_CONTRACTS.md`：跨系統狀態正確性、Owner（擁有者）、Lifecycle（生命週期）、Mutation（狀態變更）、Transaction（交易）、Derived State（衍生狀態）、Test Fixture（測試夾具）與 Regression（回歸驗證）的最高權威。
- `DATA_SECURITY_CONTRACTS.md`：帳號、UID（使用者唯一識別）、本機／雲端資料、安全、權限、Secret（機密）、後台與災難復原的最高權威。
- `PAYMENT_ENTITLEMENT_CONTRACTS.md`：付款、訂單、Webhook（伺服器通知）、Server Verification（伺服器驗證）、Entitlement（玩家付費權益）、退款、補發、對帳與稽核的最高權威。
- `ARCHITECTURE_RULES.md`：檔案 Owner（擁有者）、Wrapper（包裝）、Patch（補丁）收斂、Boot（啟動）與整體架構施工規則。
- `UI_GUIDELINES.md`：一般 UI（使用者介面）規範。
- `docs/ITEM_RARITY_UI_SPEC.md`：物品階級與色號專項權威。
- `docs/IMAGE_ASSET_SPEC.md`：點陣圖片、WebP（網頁圖片格式）、透明度、尺寸、Sprite Sheet（精靈圖集）與 VFX（視覺特效）資產流程專項權威。
- `HANDOFF.md`：當前專案狀態、歷史施工與交接資訊。

不得把本文件整份複製到其他規範；其他文件只應交叉引用並保留自己的專項責任。
