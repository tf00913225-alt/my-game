# 專案代理規則

## 一般 Bug 預設路徑（2026-10-01 生效）

一般 Bug 必須先讀 `docs/BUG_FIX_FAST_PATH.md`，以該文件為調查範圍、證據升級、自主整合與結案的權威來源。預設最小必要調查＋最小安全修正；只查直接相關責任與呼叫鏈。完整 Owner Convergence／Lifecycle 稽核僅在該文件第四節證據成立或使用者明確要求架構工程時適用。下文不得以「較嚴格優先」恢復一般 Bug 全面稽核、tests-only 限制、固定失敗額度、僅草稿 PR 或正式 Runtime 即硬停止。最新 Head 必要 CI、原症狀驗證與資料安全仍必須遵守；一般 Bug 結案不要求發布 main。


1. 開始任何工作前，先完整閱讀 `HANDOFF.md`。
2. **任何 UI、CSS、版面、美術圖片、背包、裝備、技能、戰鬥介面等修改前，都必須先閱讀 `UI_GUIDELINES.md`。**
3. `UI_GUIDELINES.md` 是一般 UI 規範的唯一來源；不要把完整規範複製到其他文件，避免版本分歧。**唯一的專項例外是 `docs/ITEM_RARITY_UI_SPEC.md`：凡涉及裝備、道具、材料、設計圖、符咒、寶箱、掉落、背包格、商店格、合成、冶煉或任何物品階級／稀有度顏色時，該文件為階級與色號的最高權威來源。**
4. 若本次只要求 UI 修改，不得順手修改戰鬥、存檔、數值、掉落等無關邏輯。
5. **任何程式、CSS、UI、戰鬥、存檔、技能、掉落、動畫或資產整合修改前，都必須完整閱讀 `HANDOFF.md`、`UI_GUIDELINES.md` 與 `ARCHITECTURE_RULES.md`；若工作涉及物品階級／稀有度，再額外完整閱讀 `docs/ITEM_RARITY_UI_SPEC.md`。**
6. **修改前必須先在回報中列出：本次功能的 owner 檔案、主要函式、現有 wrapper／後續覆蓋點，以及是否需要暫時補丁。未完成此檢查不得修改。**
7. **不得自行把 `low / mid / high / perfect` 或「低階／中階／高階／完美」當成新的正式物品階級；正式六階與固定色號一律以 `docs/ITEM_RARITY_UI_SPEC.md` 為準。**
8. **凡涉及新增、替換、轉檔或正式導入任何點陣圖片資產，必須先完整閱讀 `docs/IMAGE_ASSET_SPEC.md`。該文件是圖片格式、WebP 轉換、無損驗證、透明度、尺寸、Sprite Sheet／VFX 幀資料與正式引用流程的最高權威來源。**
9. **凡屬修復、fix、failure、test failure、CI failure、fixture、test harness、stale contract 或既有修復分支續修任務，若使用者未在當次任務另行指定不同模式，必須先完整閱讀根目錄 `AUTONOMOUS_REPAIR_CONTRACT.md`，並以該文件作為受控自主修復的唯一正式契約來源；不得依舊對話摘要自行擴張授權。**
10. **凡涉及怪物／精英／BOSS／日常副本／天兵立繪導入，必須先讀 `MONSTER_PORTRAIT_SPEC.md` 與 `docs/MONSTER_PORTRAIT_SPEC_V1.md`。若素材已經生成並完成正式 WebP 落位，預設使用 `npm run portrait:import -- --keys=<portraitKey,...>` 快速導入；不得為已完成素材重新建立生成 batch、重跑生成或重做母圖搜尋。尚未生成的素材才使用既有 batch 流程。**
11. **所有新增、修改、替換、重構、UI／CSS、Gameplay、資料、狀態、Lifecycle 與 Bug 修復，施工前都必須完整閱讀 `docs/CHANGE_SAFETY_REPLACEMENT_CONTRACT.md`。使用者說「改成／換成／不要原本的」時預設為 Replacement（取代），代理必須自行完成舊 Owner／Contract／Lifecycle／Semantic State／Regression Test 的遷移與退場判定，不得只疊加新版，也不得把「舊的要不要刪」這類工程責任丟回給不懂程式的專案負責人。**
12. **凡屬 Bug、fix、failure、regression、修復後仍重現或任何「已修好」判定，必須完整閱讀 `docs/BUG_REPAIR_DOD_OWNER_CONVERGENCE_GATE.md`。一般 Bug 先依 `docs/BUG_FIX_FAST_PATH.md`，達到證據升級條件才啟用完整 Owner Convergence Gate；DIAGNOSED／IMPLEMENTED／INTEGRATED／DEPLOYED 不得冒稱 VERIFIED。只有原始玩家症狀在最終目標環境依足夠證據不再重現，才可回報「已修好」。若使用者要求的技術做法會形成第二 Owner、Patch／Wrapper 疊加或高風險架構，代理必須主動阻止並改採安全實作；不得把技術退場判斷丟回非技術使用者。**

## 最高優先：Change Safety & Replacement Migration Gate（變更安全與取代遷移閘門）

- `docs/CHANGE_SAFETY_REPLACEMENT_CONTRACT.md` 是所有變更的永久必讀契約，與 `ARCHITECTURE_RULES.md` 共同適用。 Bug／failure／regression 另必須同時遵守 `docs/BUG_REPAIR_DOD_OWNER_CONVERGENCE_GATE.md`；後者是 Bug 完成狀態與 Owner Convergence Gate 的專項權威來源。
- 每次先分類 Additive（新增）／Replacement（取代）／Convergence（收斂）／Removal（移除）；「改成／換成／不要原本的」預設不是疊加。
- Replacement 完成條件包含舊 Owner、舊 DOM/CSS/函式/Wrapper、舊 State 語意、舊 Lifecycle 與舊 Test 的遷移／刪除判定。
- `display:none`、`animation:none`、更後面的 CSS、`!important`、Wrapper 或 late patch 不得作為「已完成取代」的預設證據。
- 代理必須主動提醒雙 Owner、多份真相、狀態語意混用、Lifecycle 缺口與維護成本；使用者只需決定產品／遊戲結果，不需替代理判斷技術退場細節。

## 《四象江湖傳》專案開發、QA 與外部研究固定規則

本章為永久固定開發規範。除非專案負責人日後明確要求修改，所有程式開發、Bug 修正、功能新增／調整、程式重構、GitHub 操作、Pull Request、Repository checks、GitHub Actions、瀏覽器測試、QA、自動化測試、技術研究、除錯與程式碼搜尋，都必須遵守以下原則。既有第 1～11 條為本章的具體前置要求，內容重疊時合併理解，不重複建立第二套標準。

### 一、專案內部資料永遠優先
- 所有判斷、修改與除錯，先依據目前 Repository 的正式規格、程式碼、資料結構、函式、模組、遊戲規則、共用工具、既有測試、GitHub Actions、Repository checks，以及 `AGENTS.md`、`CLAUDE.md`、`HANDOFF.md`、`ARCHITECTURE_RULES.md`、`UI_GUIDELINES.md`、`AUTONOMOUS_REPAIR_CONTRACT.md`、`docs/CHANGE_SAFETY_REPLACEMENT_CONTRACT.md`、`CHECK_REPORT.txt` 等正式文件。
- 每次先確認：「本專案是不是已經有現成做法？」若已有，優先沿用，不得因外部案例看起來方便就擅自偏離現有架構。

### 二、禁止無關外部遊戲研究
- 除非使用者明確要求，禁止主動搜尋、檢視或研究其他遊戲、遊戲 Mod、第三方遊戲 Repository、其他 RPG／網頁遊戲／手機遊戲的程式碼、腳本、資料結構、背包、戰鬥或 UI 實作，也不得直接套用其做法。
- QA 的對象是《四象江湖傳》本身；遇到問題不得優先跳去研究《文明帝國 VI》或其他遊戲／專案。

### 三、允許外部技術查詢的情況與順序
僅在以下情況使用外部資料：使用者明確要求；第三方技術需要核對官方文件；需查 GitHub／GitHub Actions／Firebase／Cloudflare／瀏覽器 Web API／第三方套件官方資料；或本專案資訊確實不足且不查官方資料就無法安全完成工作。

外部技術來源優先順序固定為：**官方文件 → 官方 Repository → 官方技術說明 → 高可信技術來源 → 其他非官方案例**。即使允許技術查詢，也不等於允許任意研究其他遊戲。

### 四、修改前固定流程
原則上依序執行：
1. 確認目前 Git 分支與分支用途。
2. 確認本次任務範圍。
3. 閱讀相關專案規格。
4. 搜尋本專案既有實作。
5. 找出真正相關的 owner、函式、模組、資料與後續覆蓋點。
6. 確認是否已有共用函式／共用邏輯／共用元件。
7. 評估最小必要修改範圍。
8. 再開始修改。
9. 執行與修改風險相符的必要測試。
10. 檢查既有 Repository checks／GitHub Actions。
11. 只有在風險需要時進行瀏覽器 QA。
12. 確認是否產生回歸問題。
13. 最後整理結果、影響與驗證後回報。

不得一開始就跳去搜尋外部遊戲或其他專案。

### 五、最小必要修改與禁止擴張範圍
- 固定原則：**能小改解決，就不要大改。**
- 使用者要求處理 A，就只處理 A 與完成 A 所必需的相依問題；不得自行延伸修改 B、C、D，不得順手改遊戲平衡、重做整個 UI、商店、技能、戰鬥或大量無關程式碼。
- 若發現無關問題，先記錄問題、影響範圍、嚴重度與是否建議另開任務；只有它會阻止本次任務、導致本次修改錯誤、造成資料損壞或嚴重回歸時，才可在必要範圍內一併處理。

### 六、禁止擅自大規模重構
- 現有程式只要功能正常、仍可維護、不影響本次任務且沒有明確風險，就不得為了「更漂亮、更現代、個人偏好、重新整理架構」而大規模重構。
- 只有修復實際 Bug、消除明確重複邏輯、解決既有架構衝突、避免明確嚴重維護問題，或使用者明確要求時，才可重構；即使需要，也必須控制在本次子系統的合理範圍。

### 七、避免重複造輪子與正式程式碼優先
- 修改前搜尋本專案是否已有共用函式、UI 元件、資料結構、排序、戰鬥計算、技能／狀態處理、工具函式與測試流程；已有者優先復用。
- 修 Bug 必須找真正原因，做最小且正確的修復；避免魔法數字、多層 `if` 擋錯、重複 workaround、只修畫面不修資料、只修單一案例卻破壞其他流程。
- 同時不得因追求完美而過度重構；遵守 `ARCHITECTURE_RULES.md` 的 owner 與 patch 收斂規則。

### 八、QA 的正式定義與檢查範圍
- QA = Quality Assurance（品質保證／品質驗證），目的在確認《四象江湖傳》修改後仍正常運作，不代表研究、比較或抄用其他遊戲。
- 依任務需要可檢查：遊戲載入、JavaScript／Console 新錯誤、UI 跑版／重疊、按鈕與觸控、頁面切換、捲動、Canvas、戰鬥、技能、背包、裝備、商店、副本、修改是否生效、手機尺寸／觸控、載入流程與回歸問題。
- QA 項目必須與本次修改有直接關係。

### 九、瀏覽器 QA 與最小必要測試
- 採「最小必要測試」：UI、CSS、版面、響應式、手機顯示、觸控、捲動、切頁、Canvas、載入、動畫、操作流程或可能造成視覺／互動回歸的修改，優先考慮瀏覽器 QA。
- 純文字、文件、小型數值、純資料修正或不影響畫面／互動的簡單程式調整，通常不為了形式執行大量瀏覽器 QA。
- 測試強度必須與風險成比例；禁止無止境建立 QA 流程、重複相同測試、測大量無關功能、小修改跑不必要整套瀏覽器流程、為測試方便改正式架構，或建立一次性且沒有長期價值的複雜永久測試系統。

### 十、GitHub Actions／CI 固定原則
- 已有 GitHub Actions、Repository checks、CI、`verify` 或自動測試時，優先使用現有流程。
- 新增 workflow 前必須確認：沒有同功能流程、不會重複執行或拖慢 CI、不增加不必要維護成本、不破壞 main／dev、具有長期價值且符合現有架構。
- 只有「現有流程明確不足，而且新增 workflow 對未來長期有價值」時才新增。
- 一次性的除錯／驗證優先使用現有測試、checks、瀏覽器驗證或不寫入 Repo 的臨時方式，不得因一次 QA 建立永久複雜 workflow。

### 十一、測試不得改變正式遊戲邏輯
QA、測試與 debug 工具不得為方便而永久改變正式戰鬥數值、玩家資料、掉落率、裝備／技能資料、存檔格式、正式 UI 流程或正式遊戲規則。若需測試專用邏輯，必須清楚隔離，不得讓測試程式成為正式遊戲依賴。

### 十二、專案分支規則
- `main` = 正式版本。
- `dev` = 開發版本。
- `assets-library` = 美術素材專用。
- `assets-library` 不得修改 HTML、CSS、JavaScript、遊戲邏輯或正式開發規範；不得作為程式功能開發分支，亦不得整個分支直接合併進 `main`／`dev`。若正式程式需要某張素材，只能在符合既有素材導入流程的前提下，將指定素材導入開發分支，不得藉此混入 assets-library 的其他內容。

### 十三、完成任務後的回報
每次完成修改，回報優先包含：
1. 修改了什麼。
2. 修改了哪些檔案。
3. 為什麼需要修改。
4. 是否改變既有架構。
5. 執行了哪些必要測試。
6. Repository checks／CI 是否通過。
7. 是否做瀏覽器 QA。
8. 是否發現其他未處理問題。
9. 是否仍有已知風險。

避免回報大量與任務無關的思考過程；重點放在結果、影響、驗證。

### 十三之一、GitHub 工作生命週期與 Repository Closeout（永久強制規則）
本節是所有 Bug 修復、功能開發、文件變更與正式發布的永久結案規範。除非專案負責人於當次任務明確要求例外，工作不得只停在「程式已改／PR 已合併」；必須完成對應的 Repository Closeout（程式庫收尾）。

固定生命週期：
`最新 dev → 建立工作分支 → 修改／必要測試 → PR 回 dev → Repository checks/CI 通過 → 合併 dev → 清理已完成工作分支與被取代 PR → dev 驗收 → dev → main 正式發布 PR → main CI／production deploy／版本與 SHA 驗證 → 清理發布分支 → 確認 main/dev 有效內容收斂`。

強制規則：
1. **禁止直接修改 `main` 或 `dev`。** 一般工作必須從當下最新 `dev` 建立 `fix/*`、`feature/*`、`docs/*` 或其他明確用途的工作分支，再以 PR 合回 `dev`。
2. **工作分支合併後必須進入清理判定。** 若來源分支內容已完整進入目標分支、沒有任何獨立有效 commit／diff、也不是需長期保留的正式分支，應刪除該已完成工作分支；不得把已完成臨時分支長期堆積。
3. **關閉舊 PR 前必須先證明已被吸收或取代。** 只有在舊 PR 的有效內容已完整進入 `dev`／`main`，或已由明確的新 PR／commit 完整取代時，才可關閉；回報中應記錄 replacement PR／commit。若仍有獨立有效內容，禁止為了「乾淨」而直接關閉或刪分支。
4. **永久分支不得自動刪除。** `main`、`dev`、`assets-library` 與專案負責人明確指定保留的 backup／長期分支不適用自動清理。
5. **正式發布後必須做 main/dev 收斂檢查。** 判斷重點是「有效內容是否一致」，不得只以 ahead/behind commit 數、merge commit 數或 GitHub 顯示 `diverged` 就直接判定為風險。若兩邊 tree／實際有效 diff 已一致，單純歷史圖不同不得視為未收斂。
6. 若 `main` 確實存在 `dev` 尚未吸收的有效程式／文件內容，必須透過受控 PR 讓內容回流或重新收斂；**禁止 rebase、force push、直接覆寫 `dev`／`main`** 來消除歷史差異。
7. **Release branch（發布候選／發布分支）不是永久分支。** 正式發布完成且內容已進入 `main` 後，必須進入同樣的安全清理判定；不得無理由長期留下 release candidate PR／branch。
8. **Repository Closeout 是完成條件的一部分。** 若本次可安全完成的分支清理、被取代 PR 關閉、發布分支清理或 main/dev 有效內容收斂尚未完成，回報不得把該工作描述成「完全結案」；若因權限、待使用者驗收或尚有獨立內容而不能清理，必須明確列為保留原因。
9. 每次建立新 PR／新分支前，應先確認是否已有相同目的且仍有效的工作分支／PR，避免重複建立 `runner2`、`runner3`、重複 release candidate 或同目的臨時分支。
10. 不得為了達成「分支數變少」而犧牲可追溯性或刪除未吸收內容；**安全清理優先於數量清零。**

週報／健康燈號固定判定：
- **綠燈**：正式版與 dev 的必要 CI／部署健康，沒有會阻塞下一次發布的有效未吸收內容、實質 main/dev 內容分歧或高優先級阻塞。歷史已合併分支、已被取代且無獨立內容的舊 PR，本身不得把總燈號降成黃燈。
- **黃燈**：存在會實際影響下一次 dev → main 的問題，例如必要 CI 失敗、有效 PR 衝突、main/dev 有實質有效內容分歧、舊 PR 仍含未吸收獨立內容、發布／部署 gate 未完成。
- **紅燈**：正式 production 已知故障、核心資料／登入／存檔／付款等高風險功能失效、正式部署失敗或已確認嚴重 Regression（退化）。
- 「分支很多」「歷史 PR 很多」「commit graph 不完全相同」只能列為 Repository Hygiene（程式庫清潔）資訊；沒有實質未吸收內容時，不得單獨作為黃燈理由。

### 十三之二、Resumable Work Protocol（可續接施工協定；永久強制規則）

本節用來確保長時間施工、工具中斷、對話斷線、App 重啟或多個對話並行時，工程進度仍可由 GitHub（程式庫）可靠復原。**對話不是施工識別單位；Work ID（工作識別碼）＋工作分支＋PR（合併請求）才是。**

#### A. 每一條獨立施工必須有唯一 Work ID
1. 每個 Bug、功能、資產導入、架構工程或文件工程，在開始可寫入施工前都必須建立一個穩定的 Work ID。建議格式：`<DOMAIN>-<PURPOSE>-YYYYMMDD`；同日同目的若確有第二條獨立工作，再加 `-02`、`-03`。例如：`CLOUDSAVE-P4-20261001`、`BATTLE-REVIVE-20261001`、`WIND-MONSTER-20261001`。
2. Work ID 一旦建立，在該工作完成前不得因換對話、換代理、換裝置或續修而任意更名。
3. 同一 Work ID 預設只能有一條有效工作分支與一個有效 PR；發現既有有效分支／PR 時必須續接，不得另開 `runner2`、`recovery2` 或同目的平行分支，除非舊線已明確作廢並留下 replacement（取代）關係。
4. 不同工作不得共用同一工作分支。雲端存檔、戰鬥、UI、怪物素材等可同時施工，但必須各自擁有獨立 Work ID／Branch（分支）／PR。

#### B. GitHub 是耐久狀態；scratch／本機工作區只視為暫存
1. 任何已有實質價值的修改，不得長時間只存在 `/workspace/scratch`、未推送本機 commit、臨時檔或單一對話上下文。
2. 每完成一個可獨立保存、可安全恢復的最小施工段，就應建立 checkpoint（復原點）：Commit（提交）並推送到該 Work ID 的遠端工作分支。不得為了追求一次漂亮的大 commit，而承受斷線即遺失多小時成果的風險。
3. 預計需要多個步驟、跨多次工具操作、等待 CI／部署、或可能跨對話的工作，應儘早建立 PR；未完成時可使用 Draft PR（草稿合併請求），但 PR 必須清楚標示仍在施工。
4. 若施工已產生本機 commit，但遠端尚不存在，續接工作的第一優先是確認本機工作區仍在並安全推送；禁止假設 scratch 一定存在，也禁止因找不到遠端 commit 就直接從頭重做。
5. Remote（遠端）已保存的 Commit／PR 是續接基礎；聊天記憶、舊 SHA、舊文字摘要只能作為線索，不得凌駕 GitHub 即時狀態。

#### C. PR 必須承擔每條 Work ID 的即時施工狀態
對於尚未完成的工作，PR 說明或最新狀態留言至少要能還原下列資訊：
- `Work ID`
- `Target`（通常為 `dev`）
- `Base dev SHA`（開工基底）
- `Branch`
- `Latest Head`
- `Status`（例如 IN PROGRESS／BLOCKED／READY FOR CI／MERGED）
- `Completed`（已完成）
- `Pending`（未完成）
- `Next`（下一個最小施工點）
- `CI / Deploy`（已知驗證狀態）

PR 是該工作流的即時狀態 Owner。`HANDOFF.md` 仍是專案級歷史、重要整合結果與跨工作摘要來源，但**不得把整個 Repository 當成只有一個目前工作；也不得只看 HANDOFF 最上方或最近一筆就猜使用者要續接哪一條工作。**

#### D. 多對話並行時的續接解析順序
使用者要求「繼續／接續／剛剛那個」時，代理必須先依 GitHub 即時資料還原，不得要求使用者重新貼長篇交接。解析順序固定為：
1. 使用者明確提供的 PR 號碼。
2. 使用者明確提供的 Work ID。
3. 使用者明確指出的子系統／任務名稱，對照 Open PR（開啟中的合併請求）、分支名稱與 PR 內容。
4. 本輪已知的工作分支／PR。
5. `HANDOFF.md` 與歷史紀錄只作交叉確認。

**禁止單純用最新建立／最近更新的 PR 判斷要續接哪一條工作。** 若只有一個候選明確符合，代理應自行續接；只有在 Repository 證據仍同時指向兩個以上有效候選、無法安全判定時，才向使用者要求選擇，並直接列出候選 PR／Work ID，不得要求使用者重新描述整個工程。

#### E. 併發寫入與防覆蓋
1. 每次實際寫入前都必須重新核對該工作分支最新 Head；不得把數分鐘前或上一輪對話記住的 Head 當成仍有效。
2. 若工作分支 Head 在代理不知情下前進，視為可能存在另一個對話／代理的並行施工。必須先讀取新增 commit／diff，確認能安全吸收後再繼續；禁止 blind overwrite（盲目覆寫）、force push（強制推送）或 rebase（重定基底）來搶回分支。
3. 同一 Work ID 若已有另一條活躍 PR／分支，先做是否同一目的／是否已取代判定；不得無證據建立第二 Owner。
4. 若最新 `dev` 已前進，依本專案既有整合規則吸收必要變更；不得因此丟棄已保存的 Work ID 成果或從頭重做。

#### F. 使用者不負責維護工程交接
1. 專案負責人只需說明產品／遊戲需求與提供必要實機驗收；不得要求其手動維護 SHA、分支清單、CI 歷史或長篇交接提示詞。
2. 使用者只說「接續風怪」「繼續雲端 Phase 4」等簡短語句時，只要 GitHub 證據足以唯一定位，代理就必須自行還原 Work ID、Branch、PR、Latest Head、CI 與下一步。
3. 若對話中斷，新對話不得以沒有上一個對話完整上下文作為從頭重做的理由；應先查 GitHub 耐久狀態。
4. 實機操作確實只能由使用者完成時，只要求當下必要的單一步驟或最少步驟，並說明需要回報什麼結果。

#### G. 每次暫停或結案都要留下可續接摘要
只要工作尚未完全 Closeout（結案），回報至少保留一個短格式狀態：`Work ID / Branch / PR / Latest Head / CI / Next`。

若已合併，至少回報：`Work ID / PR / Merge SHA / 最新 dev SHA / 分支清理狀態`。

這個摘要是方便人閱讀的索引；真正權威仍是 GitHub 即時狀態。任何後續代理都必須重新核對，不得把摘要內 SHA 永久視為最新值。

#### H. 核心原則
- 【對話可以中斷，工程成果不能只存在對話。】
- 【對話不是工作身份；Work ID／Branch／PR 才是。】
- 【多個對話可以並行，但不同工作不得共用分支。】
- 【同一 Work ID 不得無故產生第二條有效施工線。】
- 【先保存遠端 checkpoint，再追求長時間連續施工。】
- 【續接先查 GitHub，不叫使用者重寫交接文件。】
- 【任何寫入前重新核對 Head，避免並行對話互相覆蓋。】

### 十四、外部搜尋必須與任務直接相關
若確實需要外部搜尋，內容必須直接服務本次問題，例如 GitHub Actions cache、Firestore Security Rules、Chrome Canvas／Pointer Events 官方文件。除非使用者明確要求競品研究，否則不得搜尋「其他 RPG 怎麼做背包」、「其他遊戲戰鬥架構」、「文明帝國 VI 腳本」等無關案例。

### 十五、固定開發優先順序
**本專案正式規格 → 本專案現有程式碼 → 本專案現有架構 → 本專案現有共用函式／工具 → 最小必要修改 → 現有自動測試 → Repository checks → 必要瀏覽器 QA → 官方技術資料 → 最後才是外部案例。**

不得反過來。

### 十六、核心永久原則
- 【先理解自己的專案，再修改自己的專案。】
- 【QA 是驗證《四象江湖傳》，不是研究其他遊戲。】
- 【能從本專案解決，就不要搜尋其他遊戲。】
- 【能使用現有函式，就不要再造一套。】
- 【能小改解決，就不要大改。】
- 【能使用現有測試，就不要重建測試系統。】
- 【一次性的 QA，不代表需要建立永久 workflow。】
- 【外部資料優先查官方技術來源，不優先查其他遊戲。】
- 【除非使用者明確要求，不得擅自參考其他遊戲實作。】
- 【修改範圍必須和使用者要求一致，不得自行擴張。】
- 【測試強度必須與修改風險相符。】
- 【所有修改都必須以不破壞既有功能為前提。】

## DEV 發布與測試位置
- `main` 仍是正式版來源，除非使用者明確要求，不得把開發修改直接推進 `main`。
- `dev` 只能在 `Repository checks` 成功且 Release Gate 通過後，由 `.github/workflows/deploy-dev-cloudflare.yml` 部署到 Cloudflare Pages。
- DEV 唯一固定測試／SHA 驗證網址：`https://dev.four-symbols-dev.pages.dev`。此網址為 Cloudflare `dev` 分支固定 alias；不得再以專案 root `https://four-symbols-dev.pages.dev` 作為 dev commit 驗證來源。
- 不再使用 GitHack / RawCDN 作為 DEV 驗證來源。
- `assets-library` 與 `assets-library/assets/inbox/` 仍維持 GitHub 素材工作流，不受 Cloudflare Pages 發布方式影響。
- Game Version、Cache Version、主城 HUD、`index.html` 受管理 cache-busting 與 `V_ASSET_VERSION` 必須一致；部署流程禁止再用 `sed` 或其他方式在 `_deploy` 臨時補版本。

## 最高優先：Release / Requirement Verification Gate
- **`docs/RELEASE_VERIFICATION_RULES.md` 是本 `AGENTS.md` 的不可分割永久規範，所有 GPT、Claude、Codex 與其他 AI 開發代理都必須完整遵守。**
- 任何一次包含多項修改的需求，必須先建立／更新 `release/requirements.json`，逐項使用 `TODO / IMPLEMENTED / VERIFIED / BLOCKED`；只有 N/N VERIFIED 才能宣稱完成。
- **未完成逐項 VERIFIED 前，禁止更新正式版本號並宣稱完成。** 版本號只能表示「已驗證批次準備發布」，不能作為功能完成證據。
- 程式修改、commit、push、Repository checks SUCCESS、Deploy SUCCESS、版本號更新，任何單一項都不等於完成；缺少 source/commit/push/CI/deploy SHA/Game+Cache/Requirement Verification 任一環節，一律回報 `NOT COMPLETE`。
- `release/release.json` 是 Game Version／Cache Version 的 release source of truth；`.github/scripts/release-gate.mjs` 與 CI／deploy workflow 為強制執行 owner。
- **每次 dev → main 正式發布，除非專案負責人明確說「本次不公告」，發布 owner 必須先比對 current `main` 與候選 `dev` 的完整實際 diff，主動整理全部玩家可感知變更到唯一 `release/release-update.json`。不得要求專案負責人另寫跑馬燈、首頁公告或 Release Notes；不得把檔名、函式、Commit SHA、CI 或除錯術語交給玩家。完整規則以 `docs/RELEASE_VERIFICATION_RULES.md` 的「玩家正式版本通知與 dev → main Release Contract」為準。**
- 正式移除功能必須在 `release/deprecated-code.json` 登記 forbidden tokens；舊 DOM id、class、handler、函式、設定 key 或顯示文字仍存在於正式 HTML/JS/CSS 時，CI 必須失敗。
- UI、手機 viewport、捲動、裁切、icon、modal、loading、點擊等不能由靜態 CI 完整證明的需求，仍必須做最小必要實際視覺／操作驗收。
- Cache invalidation、Game Version、Service Worker 更新不得清除玩家 localStorage、IndexedDB、雲端存檔、帳號、背包、等級、裝備或進度；靜態 Cache 與 Save Data 必須完全分離。
- 完成回報固定包含：`Requirements: N/N VERIFIED`、Branch、Commit SHA、Game Version、Cache Version、Repository checks、Deploy、Deployment SHA verified。任一未完成即顯示 `NOT COMPLETE`。

## GitHub 遠端寫入與憑證固定規則
- 平台已連線的 GitHub Connector／API 授權，與工作區內 `git`／`gh`／SSH／PAT 的本機憑證是兩套獨立機制；不得把「本機 Git CLI 沒憑證」誤判成「GitHub 未授權」。
- 當目前代理環境已提供可存取本 Repository 且具備所需寫入權限的 GitHub Connector／API 時，所有遠端寫入必須優先使用該已授權通道完成，包括建立 branch、建立／更新檔案、blob/tree/commit、更新 branch ref、建立或更新 PR、查詢 CI／Repository checks，以及在既有合併規則允許時合併 PR。
- 工作區內的 Git CLI 預設僅用於本機檢查、diff、修改、測試與必要的本機版本控制；不得把 `git push`、`gh auth login`、PAT 或 SSH 金鑰設定成主要或必要的遠端發布流程。
- 若本機 `git push` 因缺少憑證失敗，但 GitHub Connector／API 仍可正常寫入，代理必須改走已連線的 GitHub 遠端寫入流程，不得要求使用者重新登入 GitHub，也不得回報成 GitHub 授權失效。
- 只有 GitHub Connector／API 本身明確回傳 authentication／authorization／permission 錯誤、缺少必要寫入能力，或使用者明確指定必須使用 Git CLI 時，才可把憑證或授權列為阻塞事項。
- 即使改走 Connector／API，仍必須遵守既有分支政策：禁止直接改寫 `dev`／`main`，必須由最新 `dev` 建立 `fix/`、`feature/`、`docs/` 等工作分支，經 PR、Repository checks／CI 與既有 Release Gate 後再合併。
- 若修改內容先在本機產生，代理應透過既有 GitHub 檔案／blob／tree／commit／ref 能力發布到工作分支；不得因工作區沒有可持久化 Git 認證而把已完成的修改留在本機或重複要求授權。

13. **凡涉及發布、Release Candidate、P0／P1／P2、Release Freeze、Exact-HEAD Verification 或發布整備判定，必須完整閱讀 `docs/RELEASE_VERIFICATION_RULES.md` 第 21 章「Release Readiness Priority Framework（發布整備優先級框架）」。該章是唯一正式 Owner：P0 是 Release Blocker 而非 Development Blocker；P1／P2 不得阻止正常開發；只有專案負責人明確啟動時才能進入 RELEASE FREEZE。**
