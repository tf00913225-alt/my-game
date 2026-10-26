# 《四象江湖傳》｜專案總入口

> 專案名稱：《四象江湖傳》（倉庫名稱維持 my-game）。
> 用途：提供 ChatGPT／Codex／DOT 新對話一個固定入口，從 GitHub 找到正式規格、設計定案與尚未完成的工作。
> 本頁是**索引，不是另一份平行規格，也不是自動開工令**。截至 2026-10-27（台灣時間）核對入口；施工進度、PR Head、CI 與版本須以讀取當下的 GitHub 為準。

## 一、換對話時從這裡開始

1. 先確認專案為 **tf00913225-alt/my-game**；正式整合分支是 **dev**，正式發布分支是 **main**。
2. **先讀 [AGENTS.md](AGENTS.md)**：這是唯一工程治理與任務 Routing 入口。依當次任務，只讀相關正式 Owner、規格、程式和測試，不必每次讀遍整個倉庫。
3. **設計題先查正式決策；工程續接先查 Work PR。** 使用者指定 PR／Work ID／工作名稱時，依 AGENTS.md 的 Resumable Work Protocol 找該工作最新 Branch、Head、CI、Completed、Pending、Next；不得只因某 PR 最近更新就猜它是本次任務。
4. 若使用者沒有指定工作，先簡短列出「可續接的候選工作」及其已知限制，**不要直接建立第二條施工線或把設計文件當成開工授權**。
5. 新對話只需指定簡短任務名稱或 PR 編號，不需重貼數十段舊提示詞；若缺少權威資料或有多個有效候選，明確指出缺口。

**推薦的新對話文字：**

> 請讀取 GitHub tf00913225-alt/my-game 的 README.md 與 AGENTS.md，依現有規格及最新 PR 紀錄，接續「【填任務名稱或 PR 編號】」。先回報已完成、未完成、下一步與必要風險；沿用原 Work ID／Branch，不重複施工。只有在本次任務已授權的範圍內修改。

如果目前只是想知道進度，改說「列出目前可續接工作，先不要修改檔案」。

## 二、需求、內容、美術與工程的權威來源

### 1. 產品設計與使用者選項

- **[Issue #1001｜主城與全遊戲 UI 設計紀錄](https://github.com/tf00913225-alt/my-game/issues/1001)**：Q01～Q128 的討論／定案、後續衝突①～⑪、既有程式差異，以及主城、背包、角色頁、導航、探索呈現、故事銜接、戰後補品等。**這些是設計決議，不表示已施工或測試通過。**
- Issue 內有歷史題目被後續決議覆蓋，例如戰後補品僅對三名玩家生效；閱讀時以**後續明確核定的覆蓋決議**為準，不把舊選項重開或擅自採用。
- 新的產品決策應補進對應既有 Issue／正式規格，註明是否取代舊結論，避免只保留在聊天裡。

### 2. 全遊戲美術與 UI

- **[docs/ART_DIRECTION.md](docs/ART_DIRECTION.md)**：使用者已批准的「主城＋背包」共同視覺語言；正式參考原圖已有 [主城](docs/art-reference/20261026-approved-city.png) 與 [背包](docs/art-reference/20261026-approved-backpack.png)，應一起對照。這兩張是**設計參考圖，不是已導入遊戲的整頁 UI**；不要誤用早期過度精緻版本。
- **[UI_GUIDELINES.md](UI_GUIDELINES.md)**：全遊戲 UI 唯一開發規範，包括 1080×1920 固定 9:16 邏輯畫布、顯示比例、導航、元件、文字、捲動、輸入及 Owner。
- **[docs/IMAGE_ASSET_SPEC.md](docs/IMAGE_ASSET_SPEC.md)**：新點陣素材導入、WebP、透明度、裁切、比例、runtime 引用及驗收規則。不要把概念圖文字／數值視為正式遊戲內容。

### 3. 戰鬥、英雄、物品與角色成長

- **[SYSTEM_CONTRACTS.md](SYSTEM_CONTRACTS.md)**：正式系統契約，包括四元素、技能與命中判定、等級壓制、戰鬥目標、四象塔／Boss／多玩法怪物及佈陣等。涉及公式時讀相關章節與現行唯一程式 Owner，不照搬舊對話的數字。
- **[docs/HERO_SYSTEM_V1.md](docs/HERO_SYSTEM_V1.md)**：英雄核心、來源、戰鬥、成長與權益的詳細契約。3 名玩家＋最多 3 名英雄的戰鬥隊伍以此及實際戰鬥 Owner 為準。
- **[docs/MONSTER_BALANCE_OWNER_FINAL.md](docs/MONSTER_BALANCE_OWNER_FINAL.md)**：跨七種玩法的怪物平衡收斂索引。
- **[docs/ITEM_RARITY_UI_SPEC.md](docs/ITEM_RARITY_UI_SPEC.md)**：物品／稀有度涉及 UI 時的專項規格。
- 戰後自動補品的新規則見 Issue #1001 的 **Q119～Q128、衝突①～⑪與第十三節實碼差異**；不得誤認為目前 dev 已全部符合。

### 4. 故事、主城、2D 世界探索

- 第一章採 **20 個主線節點、前 5 個為實戰引導**。以現存 adventure Owner、相應故事稿／測試及已合併工作證據為準；歷史里程碑參見 [PR #972](https://github.com/tf00913225-alt/my-game/pull/972)。
- 2D 世界探索是與故事進度連動的獨立探索玩法；主城則是固定視角的功能據點，兩者不應混為一個系統。UI／導航決議在 Issue #1001，具體探索程式、地圖、解鎖、尋路及存檔須由最新 dev 與相關 Work PR 核對；**不要因一段聊天摘要自行建第二套探索引擎**。
- 地圖概念、未落地的美術圖或舊研究，只有在指向可驗證的正式檔案／決議後才用於施工；找不到原稿即標為「待確認」，不靠想像補齊。

### 5. 帳號、雲端存檔、營運及安全

- **[DATA_SECURITY_CONTRACTS.md](DATA_SECURITY_CONTRACTS.md)**：Cloud、Auth、Save、權威資料、交易／獎勵、付費安全邊界與 Gate；僅定案或有概念不代表已安全上線。
- Save 結構／遷移作業另按 AGENTS.md 路由至相關正式契約及 [docs/PERSISTED_STATE_REGISTRY.md](docs/PERSISTED_STATE_REGISTRY.md)。
- 不把個人隱私、密碼、金鑰、付款機密或玩家個資寫入公開倉庫的規格與交接文件。

## 三、目前狀態要分清楚

- **已決定 ≠ 已實作 ≠ 已測試 ≠ 已合併 dev ≠ 已發布 main**。任何進度敘述必須指向實際檔案／PR／CI／部署 SHA。
- Issue #1001 的大批新 UI 決議，以及戰後補品衝突①～⑪是**待施工規格**。主城＋背包核准原圖已在 GitHub，但並不等於全功能的正式 UI／互動 Demo 已驗收或整批導入。
- 戰後補品現行 dev 程式仍有多個來源與新版規格不一致；依 Issue 第十三節先處理唯一執行入口、三人門檻、舊存檔、缺品與教學例外，**不得疊新的永久 wrapper 掩蓋舊來源**。
- 有些 UI PR 因使用者要求「等待整體 UI 改版」而暫停；例如 [#955](https://github.com/tf00913225-alt/my-game/pull/955)、[#1004](https://github.com/tf00913225-alt/my-game/pull/1004)、[#1007](https://github.com/tf00913225-alt/my-game/pull/1007)。這是 2026-10-26 查得的歷史狀態，續接時必須再查最新狀態；**不得因本索引出現它們就擅自合併或恢復施工**。
- 專案級已完成／待完成摘要看 **[HANDOFF.md](HANDOFF.md)**，但 HANDOFF 不是每個任務必讀，也不替代各工作 PR 的即時進度。
- 正式 Game／Cache Version 以 **[release/release.json](release/release.json)** 為準；Dev 部署需核對 exact-SHA 證據，不以頁面版本字樣猜測是否已上線。

## 四、下一批工作如何選擇

以下是**候選工作方向，不是自動開工指令**：

1. **整套 UI 改版**：依 Issue #1001 和批准的兩張美術圖，先做可審查的主城／背包 Demo 與導航樣張；使用者接受後再安排分批實作，避免一次翻修全站。
2. **戰後自動補品**：規格與 11 項衝突已收斂；施工前先核對最新 dev、存檔及現有補品函式／測試，指定單一 Owner 逐段修改並驗證。
3. **2D 探索／故事銜接**：先找該 Work ID／PR、現有地圖／素材／測試與最新完成狀態，不因本次建立索引就重新啟動另一條探索施工線。
4. **其他 Bug、英雄、戰鬥、美術與 Cloud**：先走 AGENTS.md 對應路由及原有效 PR，使用者指定目標後才施工。

每項任務應有一個可追蹤的 **Work ID＋Branch＋PR**。新的 Codex 對話先續接原本有效工作，不能重複建分支、PR 或重跑已由有效 CI 快照完成的昂貴驗證。

## 五、日後如何持續更新，才不會越記越亂

- **產品決策**：更新正式 Issue 或該子系統契約；保留「定案／待決／已被新決議覆蓋」的界線。
- **實際施工**：修改唯一 Owner，在工作 PR body 寫 Work ID、Branch、Head、Status、Completed、Pending、Next、CI；PR 是該工作續接的權威。
- **跨工程重大結果**：必要時摘要進 HANDOFF.md。不要把每次測試流水帳都貼進本 README 或 HANDOFF。
- **總入口 README**：只在權威位置、主要設計方向或工作導航方式改變時更新；不建第二套狀態資料庫、另一組永久規則或新的 GitHub 倉庫。
- **發布**：遵守 AGENTS.md 及 Release Gate。符合條件的 PR → dev 依現行授權與 CI 規則處理；**dev → main 必須另有正式發布授權**。

本頁是截至目前已查到的正式記錄之**單點入口**，不是「所有歷史聊天已逐字完整移入 GitHub」的保證。尚未在權威資料中找到的往昔決定，應日後逐項取證並補到對應 Owner，不得猜測為已定案。
