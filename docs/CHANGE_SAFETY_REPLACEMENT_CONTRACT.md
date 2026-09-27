# 《四象江湖傳》Change Safety & Replacement Migration Contract
# 變更安全與取代遷移契約

> 文件定位：本文件是《四象江湖傳》所有新增、修改、替換、重構、UI／CSS、Gameplay（玩法）、資料、狀態、Lifecycle（生命週期）與 Bug 修復的永久變更安全契約。
>
> 生效日期：2026-09-28
>
> 適用 Repository（程式庫）：`tf00913225-alt/my-game`
>
> 適用代理：GPT、Claude、Codex 與其他 AI／Agent（代理）。

---

## 1. 核心責任分工

專案負責人負責決定「遊戲要變成什麼樣」，不需要負責判斷舊 CSS、DOM、函式、Wrapper（包裝器）、State（狀態）、Test（測試）或資料欄位應如何退場。

任何開發代理收到「改成、換成、不要原本的、重新設計、改規則、改呈現」等需求時，必須自行完成工程影響分析，主動說明並處理：

- 哪些現有行為保留。
- 哪些責任需要搬家。
- 哪些舊 Owner（控制來源）會被取代。
- 哪些舊 CSS／DOM／函式／Wrapper／State／資料欄位／測試需要刪除或遷移。
- 哪些項目因相容性必須暫時保留，以及保留理由與未來退場位置。
- 是否存在雙 Owner、多份真相、Semantic State（狀態語意）混用或 Lifecycle 衝突風險。

不得把上述判斷責任丟回給專案負責人要求其自行決定技術細節。

---

## 2. 開工前強制分類：Additive 或 Replacement

每次修改前必須先判斷本次變更屬於：

1. **Additive（新增）**：新增能力，既有能力仍然有效且需要保留。
2. **Replacement（取代）**：新設計／新規則／新 UI 取代既有設計或行為。
3. **Convergence（收斂）**：多個既有 Owner／Patch／Wrapper 收斂為單一正式 Owner。
4. **Removal（移除）**：正式停止某項功能、狀態、UI 或資料來源。

若使用者語意包含「改成、換成、不要原本的、取消舊的、由 C 取代 A/B」，預設視為 Replacement，而不是在舊實作上再疊一層新版本。

若分類不明但可以從既有正式規格與需求語意合理判斷，代理必須自行判斷並回報；不得因使用者不懂程式而反覆要求其回答「舊的要不要刪」。

---

## 3. Replacement Impact Scan（取代影響掃描）

Replacement／Convergence／Removal 開工前，必須掃描被取代實作是否仍承擔下列責任：

- Visual Presentation（視覺呈現）
- Input / Hitbox（輸入／點擊範圍）
- Selection / Focus（選取／焦點）
- Semantic State（狀態語意）
- Gameplay Rule（玩法規則）
- Data Source（資料來源）
- Persistence / Save（持久化／存檔）
- Lifecycle（建立、進入、更新、離開、清理）
- Animation / VFX（動畫／特效）
- Accessibility / Feedback（可辨識回饋）
- Test / CI Contract（測試／持續整合契約）
- Compatibility / Migration（相容性／遷移）

UI 看起來只是一個框、圖示或動畫，也不得假設它只負責外觀。

---

## 4. Five-Layer Convergence Gate（五層收斂閘門）

每次會改變既有功能的施工，至少同時檢查以下五層：

### 4.1 Owner（控制來源）
同一責任只能有一個正式 Owner。不得讓 A、B、C 三套實作同時以不同優先權、載入順序或 Wrapper 互相覆蓋。

### 4.2 Contract（契約）
必須確認輸入、輸出、資料來源、責任邊界與呼叫者仍符合新規格。新 Owner 不得直接承接舊 Contract 而假設語意相同。

### 4.3 Lifecycle（生命週期）
必須確認何時建立、啟用、更新、結算、停止與清理。不得只修「畫面現在看起來正常」。

### 4.4 Semantic State（狀態語意）
一個狀態不得同時代表兩種不同意思。例如「內部預選目標」與「玩家正式選定目標」若呈現需求不同，就必須拆分或明確投影，不得共用同一 class／flag 再靠 CSS 猜語意。

### 4.5 Regression Test（回歸測試）
測試必須跟著新 Contract 更新。不得讓過時測試繼續保護已被取消的舊行為，也不得為了綠燈把正式錯誤改寫成新規格。

---

## 5. 退場優先，不以遮蔽代替遷移

Replacement 完成時，舊實作原則上應實體退場。

下列做法不得作為預設完成方式：

- `display:none`
- `visibility:hidden`
- `opacity:0`
- `animation:none`
- `pointer-events:none`
- 新增更高 specificity（選擇器權重）
- 新增 `!important` 壓過舊規則
- 再包一層 Wrapper
- 再加一個 late patch
- 保留已無用途的舊 DOM／class／handler／函式／設定 key

只有存在明確相容性、Migration（遷移）、跨版本 Save（存檔）或外部依賴理由時可以暫時保留。保留時必須：

1. 說明不能刪除的具體原因。
2. 標記唯一相容性用途。
3. 禁止它繼續擔任第二 Owner。
4. 記錄未來可刪除條件與收斂位置。

---

## 6. Definition of Done（完成定義）

「新版可以運作」不等於完成。

Replacement／Convergence／Removal 只有在以下項目完成後才可宣稱工程完成：

- 新 Owner 已接管正式責任。
- 舊 Owner 已移除，或有明確且最小的相容性保留理由。
- 舊 DOM／CSS／函式／Wrapper／State／資料欄位已完成刪除或遷移判定。
- 舊 Lifecycle 入口與清理點已處理。
- 舊 Semantic State 不再被新系統誤解。
- Regression Test／CI Contract 已更新至新規格。
- 搜尋確認不存在會重新啟用舊行為的後置覆蓋點。
- 必要 QA 驗證的是最終完整載入後的行為，而非單一檔案或局部函式。
- 若正式移除可穩定辨識的 token，依 `docs/RELEASE_VERIFICATION_RULES.md` 評估加入 `release/deprecated-code.json` forbidden token。

只完成「新功能新增」而沒有完成「舊版本退場」，不得回報為完全收斂。

---

## 7. 主動風險提醒義務

代理在施工前若判斷需求會造成下列風險，必須主動提醒，不必等待專案負責人詢問：

- 雙 Owner
- 多份資料真相
- Wrapper／Patch 疊加
- UI 與資料來源不同步
- 一個 State 承擔多種語意
- Lifecycle 無明確清理點
- 舊 Test 會保護被取消行為
- 需要以 `!important`／`display:none` 才能讓新版生效
- 新系統會讓一人團隊後續維護成本顯著增加
- 會影響 Save／Cloud／帳號／交易等高風險資料

提醒格式應直接說明：

「一般不建議直接做 X，因為會造成 Y；本專案正常應先完成 A 的責任遷移／退場，再由 B 接管。」

不得只回答「可以做」。

---

## 8. 技術決策不得要求非技術使用者代替代理判斷

禁止把以下問題原封不動丟給專案負責人作為必要前置：

- 「舊 CSS 要不要刪？」
- 「舊函式要不要留？」
- 「這個 Wrapper 要不要保留？」
- 「舊 Test 要不要改？」
- 「A/B/C 哪一個應該當 Owner？」

代理應先查專案證據並給出正式工程判斷；只有當問題實際涉及遊戲設計取捨、玩家規則或產品意圖，而且兩種方案都合理時，才需要專案負責人決策。

---

## 9. 與其他規範的關係

- `AGENTS.md`／`CLAUDE.md`：代理入口，必須要求所有修改先遵守本契約。
- `ARCHITECTURE_RULES.md`：Owner、Patch、Wrapper 與架構細節；與本契約共同適用。
- `AUTONOMOUS_REPAIR_CONTRACT.md`：修復任務的自主權限邊界；修復施工本身仍必須符合本契約。
- `UI_GUIDELINES.md`：UI 尺寸、呈現、互動規格；UI Replacement 同時適用本契約。
- `docs/RELEASE_VERIFICATION_RULES.md`：Requirement／CI／Release 與 deprecated-code 驗證。
- `HANDOFF.md`：記錄當前專案狀態與重要遷移結果，不作為本契約的替代來源。

衝突時，當次使用者明確的產品需求優先；但不得把「我要改成 C」解讀成允許保留 A/B 成為新的技術債。

---

## 10. 永久核心原則

- 【使用者決定產品結果，代理負責安全實作與舊版本退場。】
- 【新增前先判斷是不是其實在取代。】
- 【取代不是疊加；能刪的舊實作應刪除。】
- 【Owner、Contract、Lifecycle、Semantic State、Regression Test 五層一起收斂。】
- 【不要用 CSS 壓制、Wrapper 或 Patch 假裝完成遷移。】
- 【測試不能保護已被取消的舊行為。】
- 【發現架構風險要在施工前主動提醒，而不是 Bug 發生後才解釋。】
- 【一次真正完成的修改，包含舊版本安全退場。】
