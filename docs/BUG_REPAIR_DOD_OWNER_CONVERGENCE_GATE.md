# 《四象江湖傳》Bug Repair Definition of Done & Owner Convergence Gate
# Bug 修復完成定義與控制來源收斂閘門

> 文件定位：本文件是《四象江湖傳》所有 Bug／failure／regression（回歸）修復任務的永久完成標準，以及 Owner（控制來源）收斂的唯一專項契約。
>
> 生效日期：2026-09-29
>
> 適用 Repository（程式庫）：tf00913225-alt/my-game
>
> 適用代理：GPT、Claude、Codex 與其他 AI／Agent（代理）。
>
> 本文件不擴張任何修改或合併權限；操作權限與停止線仍由 AUTONOMOUS_REPAIR_CONTRACT.md、分支規則與當次使用者明確指令決定。

---

## 1. 使用者與代理的責任邊界

專案負責人只需要決定「玩家最後應該看到、得到或感受到什麼結果」，不需要理解或判斷：

- Owner 應該放在哪個檔案。
- 舊函式／Wrapper（包裝器）／Patch（補丁）是否要刪。
- CSS specificity（選擇器權重）是否合理。
- Lifecycle（生命週期）應在哪個 Hook（鉤子）完成。
- 哪一個 Test（測試）已過時。
- 哪一個資料來源才應該是唯一真相。
- 哪一個實作方式會形成技術債。

代理必須主動完成上述工程判斷並承擔風險把關。

若使用者要求的「產品結果」可以做到，但指定或隱含的「實作方法」會造成多 Owner、Patch 疊加、資料風險、Lifecycle 衝突、不可逆相容性問題或明顯維護負擔，代理必須：

1. 明確說明該實作方法不應採用。
2. 說明風險。
3. 改採符合正式架構的安全實作。
4. 只有產品取捨真的存在兩種以上合理方案時，才把決策交回使用者。

不得因為使用者說「開始修」就執行已知不安全的技術方案。

---

## 2. 名詞定義

### 2.1 Owner（控制來源）

Owner 是對某一項「明確責任」具有最後決定權的正式實作。

不同責任可以有不同 Owner，例如：

- Data Owner（資料來源 Owner）：決定正式資料。
- Rule Owner（規則 Owner）：決定玩法結果。
- Lifecycle Owner（生命週期 Owner）：決定建立、啟用、更新、結算與清理。
- Presentation Owner（呈現 Owner）：決定玩家最終看到的內容。
- Geometry Owner（幾何 Owner）：決定位置與尺寸。
- Persistence Owner（持久化 Owner）：決定如何保存與恢復。

「單一 Owner」不是指整個功能只能有一個檔案，而是指同一項責任只能有一個最後決定者。

### 2.2 Patch（補丁）

Patch 是沒有把責任收斂回正式 Owner，而在舊實作外再加一層「事後修正」的做法。

常見形式包含但不限於：

- Wrapper 再包原函式。
- late patch（後置補丁）。
- setTimeout 延遲重做一次。
- requestAnimationFrame 再同步一次。
- MutationObserver 監看後補畫面。
- 更後面的 CSS 或更高 specificity 覆蓋舊 CSS。
- 新增 !important 壓過衝突來源。
- 建立第二份 DOM／State／Registry／資料映射後互相同步。
- 錯誤後反覆 retry，但沒有正式 Failure Lifecycle。

Patch 不是絕對禁止；但若它不是明確、短期、相容性用途，而且沒有退場條件，就不得當成永久修復。

---

## 3. Root Cause（根因）宣稱標準

### 3.1 找到「一個真的問題」不等於找到完整根因

只有在證據能建立以下因果鏈時，才可宣稱「Root Cause 已確認」：

玩家症狀 → 實際 Runtime 路徑 → 故障機制 → 可重現證據 → 修正後同一路徑不再故障

如果只證明某個檔案、path、Promise、CSS、測試或 Owner 有問題，但尚未確認其他下游 Owner、Lifecycle、部署、Cache、資料來源或正式畫面覆蓋點，必須稱為：

Confirmed Contributing Cause（已確認的促成原因）

不得過早稱為唯一 Root Cause。

### 3.2 重複修復升級規則

同一個「玩家可觀察症狀」若在一次 IMPLEMENTED 修復後仍重現：

- 下一次禁止再做局部 Patch。
- 必須重新檢查 Owner、Contract、Lifecycle、Data Source、Presentation、Deployment／Runtime Environment 與 Regression Test。

若同一症狀已經歷兩次修復仍重現：

- 第三次施工前強制執行 Subsystem Convergence Audit（子系統收斂稽核）。
- 必須回頭審查前兩次修復到底修了哪一層、哪些舊 Owner／Patch 仍存在。
- 未完成收斂稽核，不得再新增第三層補丁。

---

## 4. Owner Convergence Gate（控制來源收斂閘門）

任何 Bug 修復在修改 production runtime（正式執行程式）前，必須先完成以下 Gate。

### Gate A — Responsibility Inventory（責任盤點）

列出本次症狀涉及的責任，例如資料來源、規則、DOM 建立、最終呈現、位置尺寸、Lifecycle、fallback、持久化、測試與部署驗證。每一項責任都要能指出目前正式 Owner。

### Gate B — Multi-Owner Scan（多 Owner 掃描）

搜尋所有可能重新寫入同一責任的：

- 同名／別名函式。
- window 全域重新賦值。
- Wrapper。
- after-render／after-load Hook。
- Timer／rAF／Observer。
- CSS 後置覆蓋。
- duplicate DOM。
- fallback／retry。
- build bundle 中的舊版本實作。

若同一責任存在兩個以上可改寫最終結果的正式路徑，Gate 不得 PASS。

### Gate C — Canonical Owner（正式 Owner）決定

必須明確決定哪一個 Owner 保留、哪些責任搬到它、哪些舊 Owner 退役、哪些相容層暫時保留，以及暫時相容層為何不再具有決策權。

不得讓「載入順序剛好最後執行的人」成為事實上的 Owner。

### Gate D — Patch Retirement（補丁退場）

被新架構取代的 Patch／Wrapper／CSS Override／Timer／Observer 原則上必須移除。

若不能移除，必須同時記錄：

1. 具體相容性原因。
2. 它唯一允許的責任。
3. 為何它不會成為第二 Owner。
4. 可刪除條件。
5. 退場位置。

沒有上述紀錄的「先留著比較保險」不成立。

### Gate E — Lifecycle Closure（生命週期閉合）

確認：

建立 → 準備 → 啟用 → 更新 → 結算／失敗 → 離開 → 清理 → 再次進入

每一階段都有明確行為。

特別禁止：

- 一次失敗永久污染整個 App Session。
- Failed Promise 永久快取且無重試策略。
- 單一資產失敗污染整組資產。
- 下一次進入只能靠 reload 才恢復。
- 舊 DOM／listener／timer 離開後仍存活。
- 新 Owner Ready 後舊 Owner 又於晚期重新覆蓋。

### Gate F — Final-State Verification（最終狀態驗證）

測試必須觀察「所有正式腳本、Hook、CSS、Lifecycle 完整執行後」的最終結果。

不得只測 Resolver 回傳值、中間 State、單一函式、單一 source file、DOM 曾經出現過、圖片檔案存在或 Build 成功。

如果玩家遇到的是 UI／戰鬥／動畫／觸控／載入問題，必須驗證最終可見／可操作狀態。

---

## 5. Bug Repair Definition of Done（Bug 修復完成定義）

Bug 狀態固定使用以下階段，禁止混用。

### 5.1 DIAGNOSED（已診斷）

必須有原始症狀、可重現條件或足以定位的實際證據、實際 Runtime 路徑、Confirmed Root Cause 或明確標示為 Contributing Cause，以及 Owner Convergence Gate 初步結果。

此階段不得說「已修好」。

### 5.2 IMPLEMENTED（已實作）

必須有：

- 修正已寫入工作分支。
- 新 Owner／既有正式 Owner 已正確承擔責任。
- 舊 Owner／Patch 已退場，或有正式相容性例外。
- Targeted Regression Test（精準回歸測試）通過。
- 沒有只靠放寬測試或遮蔽舊實作取得綠燈。

此階段只能說「修正已實作」，不得說玩家問題已解決。

### 5.3 INTEGRATED（已整合）

必須有：

- PR 已通過要求的 CI。
- 變更已合入目標整合分支。
- 合併後 HEAD 已確認。
- 沒有被其他並行變更重新覆寫。

PR branch PASS 不等於 INTEGRATED。

### 5.4 DEPLOYED（已部署）

只適用有部署環境的問題。

必須確認：

- 目標環境實際部署 SHA／版本。
- 部署 SHA 等於預期整合 SHA。
- 不得以 PR Head、舊 Preview 或本機 Build 冒充已部署版本。

若問題不涉及部署，此階段可標記 N/A。

### 5.5 VERIFIED（已驗證／真正修好）

只有在「原始玩家症狀」於最終目標環境中，以足以重現原問題的同一路徑驗證不再發生，才可使用 FIXED、RESOLVED、VERIFIED 或「已修好」。

驗證方式必須與問題相符：

- 純邏輯／資料問題：可執行 regression test 足以覆蓋完整正式路徑時可成立。
- UI／CSS／互動／動畫／Canvas／戰鬥呈現：必須 Browser QA 或等價最終 DOM／computed style／interaction 驗證。
- 只在真機、特定瀏覽器、網路、Cache 或部署環境重現的問題：必須在該類環境完成驗證，不能用本機靜態測試替代。
- 後端／雲端問題：必須在正式對應 emulator／deployment／transaction 路徑完成與風險相稱的驗證。

若無法取得最終環境證據，最高只能回報：

IMPLEMENTED / INTEGRATED / DEPLOYED，Awaiting Final Verification（等待最終驗證）

不得自行升級成 VERIFIED。

---

## 6. CI PASS 不是 Bug 修復證據的替代品

CI PASS 只能證明 CI 所覆蓋的契約成立。

以下敘述一律禁止：

- 「CI 綠燈，所以 Bug 修好了。」
- 「圖片可以 decode，所以玩家一定看得到。」
- 「DOM 有元素，所以 UI 正常。」
- 「PR 已合併，所以 DEV 一定是最新版。」
- 「Build 成功，所以 Runtime 行為正確。」

修復報告必須分開列出 Source Verification、Regression Verification、Integration Verification、Deployment Verification、User-visible / Runtime Verification。

---

## 7. Deployment / Cache / Build 必查條件

當症狀發生在 DEV／Production 而非純原始碼時，根因調查不得只停在 Repository。

必須確認：

- 使用者實際測試的是哪個環境。
- 目標環境的 exact SHA。
- Build artifact 是否包含修正。
- Asset URL 是否 content-hashed 或可能使用舊 Cache。
- Mutable asset 被原路徑覆蓋時，HTTP Cache 策略是否允許玩家拿到舊檔。
- Service Worker（若未來存在）／CDN／Browser Cache 是否可能持有舊內容。
- Manifest 與實際 bundle 是否一致。

Repository 正確但部署／Cache 錯誤，仍然是未完成修復。

---

## 8. AI 的主動阻止義務

遇到下列情況，代理不得只回答「可以做」並直接施工：

- 會新增第二 Owner。
- 會再包一層 Wrapper。
- 只能靠 Timer／Observer／CSS Override 讓結果看起來正常。
- 會讓一個 State 同時代表多種語意。
- 會建立第二份正式資料真相。
- 會讓 Fail-open 影響存檔、帳號、金流、獎勵或雲端資料。
- 會破壞跨版本相容性。
- 無法驗證原症狀是否消失，卻準備宣稱完成。
- 使用者指定的技術方法與現有正式架構衝突。

代理必須直接說明：

「你要的產品結果可以做，但這個實作方式不應採用，因為……；本專案應改由……完成。」

這不是要求使用者懂程式，而是代理必須主動把關。

---

## 9. 禁止把技術決策丟回非技術使用者

除非涉及真正的產品選擇，否則不得要求使用者決定哪個 Owner 留、哪個 Patch 刪、要不要 Wrapper、要不要 retry、CSS 用哪種 selector、測試該保留哪個 assertion、Build／Cache 如何 invalidation 或要不要清理舊 Lifecycle。

代理應依正式程式、Contract、測試與風險做出工程判斷。

如果因權限或契約硬停止而不能施工，應告訴使用者：

- 哪一條停止線阻擋。
- 已完成哪些安全工作。
- 還差哪個產品授權或高風險操作授權。

不得用大量技術選項把責任轉回使用者。

---

## 10. Regression Test 最低要求

每個 Bug 至少要留下能阻止同一故障機制再次出現的 Regression Test，除非技術上不可自動化；若不可自動化，必須記錄理由與人工 QA 步驟。

Regression Test 必須盡量測「故障機制」，而不只是某個表面值。

例如 UI 圖片不顯示，不應只測 Registry 有 key、File exists 或 width／height 正確；還應依風險驗證正式 Resolver、正式 Presentation Owner、最終 DOM、computed visibility、geometry、lifecycle transition、reload／retry／下一次進入與正式 bundle／target environment。

---

## 11. 修復報告固定格式

任何 Bug 修復完成或停止時，至少回報：

1. 原始症狀。
2. Root Cause：CONFIRMED 或 Contributing Cause。
3. 實際 Runtime 路徑。
4. Canonical Owner（正式 Owner）。
5. 發現的其他 Owner／Wrapper／Patch。
6. 哪些舊實作已退場。
7. Lifecycle／Failure Recovery 如何處理。
8. 修改檔案。
9. Regression Test。
10. PR／CI 狀態。
11. 整合分支 HEAD。
12. Deployment exact SHA（若適用）。
13. 最終環境驗證。
14. Bug 狀態：DIAGNOSED／IMPLEMENTED／INTEGRATED／DEPLOYED／VERIFIED／BLOCKED。
15. 是否可以使用「已修好」：YES／NO。

---

## 12. 與其他永久規範的關係

- docs/CHANGE_SAFETY_REPLACEMENT_CONTRACT.md：所有變更的總體安全與 Replacement 遷移契約。
- AUTONOMOUS_REPAIR_CONTRACT.md：修復任務可以自主做到哪裡、何時硬停止；不負責降低本文件的完成標準。
- ARCHITECTURE_RULES.md：Owner、Wrapper、Patch、架構邊界。
- UI_GUIDELINES.md：UI／互動／版面規格。
- docs/RELEASE_VERIFICATION_RULES.md：CI／部署／Release 驗證。
- HANDOFF.md：目前專案狀態，不可取代本文件。

若其他文件只要求「測試 PASS」而本文件對該 Bug 還要求最終 Runtime／Deployment 驗證，以較嚴格的完成標準為準。

---

## 13. 永久不可降級原則

- 【找到一個真實問題，不等於找到完整根因。】
- 【找到根因，不等於修復完成。】
- 【IMPLEMENTED 不等於 VERIFIED。】
- 【PR PASS 不等於已整合。】
- 【已整合不等於已部署。】
- 【已部署不等於原始玩家症狀已消失。】
- 【同一責任只能有一個正式 Owner。】
- 【Patch 必須有退場條件，不能靠疊加維持系統。】
- 【使用者決定產品結果；代理負責技術安全、收斂、退場與驗證。】
- 【代理知道某種做法不安全時，有義務阻止，而不是照做後再解釋。】
- 【只有最終目標環境中原始症狀無法再重現，才可以說「已修好」。】
