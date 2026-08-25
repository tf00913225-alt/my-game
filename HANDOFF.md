# 專案進度交接表

這份文件是這個專案唯一的「目前狀態」真相來源。使用者會輪流用不同的 AI
工具（Claude Code / ChatGPT 等）開發這個專案，**每一次開始工作前都必須先讀完這份文件，
結束工作前都必須更新這份文件**，否則下一個接手的人（不管是人還是 AI）會在不知情的狀況下
重做、改壞、或誤判目前的狀態。

---

## 給接手 AI 的規則（務必先讀）

1. **`main` 分支永遠是唯一的正式狀態**，也是 GitHub Pages 實際上線的來源
   （`https://tf00913225-alt.github.io/my-game/`）。不要假設有其他「更新」的分支，
   開工前先 `git fetch` 確認 `main` 的最新 commit。
2. **改完、驗證過之後，直接想辦法合併回 `main`**，不要留著長期分支或未合併的 PR。
   兩個 AI 工具輪流接手時，只看得懂 `main` 現在長怎樣，看不懂對方留在別的分支上的半成品。
3. **任何一次工作結束前，一定要更新本文件的「最新進度」段落**：
   - 這次做了什麼（含檔案路徑）
   - 怎麼驗證過的（語法檢查／邏輯追蹤／實際跑過）
   - 有沒有已知限制或還沒做完的地方
   - 沒有更新這份文件就結束工作 = 交接失敗，下一個人會迷路。
4. **改動前，先搞懂下面「系統架構重點」，尤其是動態載入器那段**——這個專案的載入機制
   不是單純看 `index.html` 的 `<script>` 標籤就能判斷完的，之前有一次連 Claude 自己
   都誤判過，多花了一輪工才發現搞錯。
5. 這個專案目前**沒有自動化測試、沒有 CI**。驗證方式只有：
   - `node --check 檔案.js` 確認語法沒錯
   - 追程式邏輯（讀 code，不是用猜的）確認行為符合需求
   - 如果有辦法起瀏覽器，實際操作一次最準
   不要在沒驗證過的情況下宣稱「做完了」。

---

## 目前狀態（截至 2026-08-25，main @ `70cf718`）

- 專案是純前端網頁 RPG，用 GitHub Pages 直接serve `index.html` + `css/` + `js/` +
  `assets/`，沒有 build step、沒有 bundler。
- 母版歷史：V120（單一巨大 index.html，全部 inline）→ V121_SPLIT（拆成外部檔案，
  行為完全不變，過程見 `CHECK_REPORT.txt` / `README_*.txt`）→ 之後陸續疊加 V123～V131
  各種 stage patch，一路疊到現在。
- 最新一批大改動是 **V131**（`js/25-v131-fix-batch.js` + `js/26-v131-patrol-appearance.js`
  + `css/31`、`css/32` + `js/v131-patrol-sprite-*.js`），對應使用者提出的 17 項需求
  （戰鬥節奏、怪物編隊、技能命中邏輯、元素匣、經驗池預覽、商店黑底、EXP ×3.5 等）。
  詳細清單見下面「已完成功能記錄」。
- 在 V131 之後，又補上了**男角 Q 版巡怪立繪**（火/水/風/土四元素），跟原本只有女角的
  巡怪系統整合在一起，依角色的 `gender` 欄位自動切換。

---

## 系統架構重點（踩過的坑，務必看完）

### 1. V131 不是靠 `index.html` 的 `<script>` 標籤載入的

`index.html` 本身**沒有**直接引用 `js/25-v131-fix-batch.js`、`js/26-v131-patrol-appearance.js`、
`css/31-*.css`、`css/32-*.css`、或任何 `js/v131-patrol-sprite-*.js`。

這些檔案是由 **`js/20-anonymous-20.js`** 裡兩個 IIFE 在執行期動態注入的
（`loadV131FixBatch()` 和 `loadV131PatrolAppearanceAssets()`）：
在 `DOMContentLoaded` 之後，動態建立 `<link>`/`<script>` 標籤依序插入 `<head>`/`<body>`，
而且有 `document.getElementById(id)` 防重複注入的判斷。

**如果你在 `index.html` 裡直接看到「這幾個檔案好像沒被載入」而想手動加 `<script>` 標籤，
先住手、去讀 `js/20-anonymous-20.js`**——手動加標籤幾乎一定會造成重複載入，
V131 的所有 override（`finishPlayerAction`、`getSkillTargets`、`learnSkill`、
`renderExpDistributeList`、`confirmAutoBattleSettings`、`winBattle`、`showExpToast` 等）
都是用「讀舊函式、包一層新邏輯、蓋回同一個全域變數名」的寫法，被載入兩次會造成
效果疊加兩次（例如 1.3 秒延遲變 2.6 秒）、`setInterval` 開兩個、事件被觸發兩次等等。

要新增巡怪 sprite 相關的資源檔（例如以後補男角背面圖），記得同步更新
`js/20-anonymous-20.js` 的 `sources` 陣列（在 `loadV131PatrolAppearanceAssets` 裡），
把新檔案排在 `js/26-v131-patrol-appearance.js` **之前**，不然 `js/26` 執行時
還讀不到新的 chunk 資料。

### 2. 大部分核心遊戲邏輯在 `js/00-main.js`（很大，約 750KB）

角色/戰鬥/技能/裝備/存檔等系統的本體都在這裡，函式名稱直接沿用（`getMainCharacterStats`、
`castDamageSkill`、`checkLevelUp`、`saveGame`/`loadGame`……）。這一支不要整支改寫，
後續修改一律走「疊 patch」的模式（讀舊函式、包一層、蓋回同名全域變數），
跟 V131 那批的寫法一致——這是這個專案從 V120 就定下來的規則（見 `README_*.txt`）：
**不要把 21 支 script 合併成一支 game.js**，因為會改變例外邊界跟頂層 `let`/`const`
初始化時機。新的 patch 檔一樣照這個規則來，不要圖方便直接改 `00-main.js`。

### 3. 圖片資源命名慣例：base64 → 外部檔 → chunk 拆檔

`assets/` 底下是真正的圖片檔（png/jpg/webp）。如果某個資源必須內嵌在 JS 裡
（例如巡怪的透明 sprite，需要在 runtime 用 CSS `background-position` 做四方向切換），
慣例是：

1. 用 PIL 之類的工具把圖片組成一張 sprite sheet（webp，需要透明背景就用 lossless）
2. base64 編碼
3. 切成多個 `js/v131-patrol-sprite-*.js`（或類似命名）小檔，每個檔案內容固定格式：
   ```js
   window.SOME_GLOBAL_CHUNKS=window.SOME_GLOBAL_CHUNKS||[];
   window.SOME_GLOBAL_CHUNKS[i]="....(base64 片段)....";
   ```
4. 消費端（例如 `js/26-v131-patrol-appearance.js`）檢查陣列長度/完整性，
   不完整就安全降級（fallback 到舊行為），不要讓載入失敗直接把整支 script 炸掉。
5. **一定要驗證 byte-for-byte 還原**（decode 所有 chunk、組回二進位、跟原始檔案比對
   hash）再提交，這是這個專案唯一能保證「切檔沒切壞資料」的方法。

現有範例：`js/v131-patrol-sprite-0.js` ~ `5.js`（女角 Q 版，3x3 grid，
每格對應一個元素的正/背面）、`js/v131-patrol-sprite-male-0.js` ~ `8.js`
（男角 Q 版，2x2 grid，目前只有正面）。

### 4. 角色系統：`player`／`player2`／`player3`

三個角色是平行結構（不是陣列），輔助函式 `getPartyCharacterByIndex(index)`／
`getExistingPartyIndexes()` 統一處理「不管哪個角色，只要存在就處理」的邏輯，
新程式碼盡量呼叫這兩個輔助函式，不要自己寫 `index===0?player:index===1?player2:player3`
這種三元判斷（雖然舊程式碼裡到處都是，但新增的部分盡量別再加）。

`character.gender`（`"male"`/`"female"`）跟 `character.element`
（`"fire"`/`"water"`/`"wind"`/`"earth"`）是兩個獨立欄位，立繪/Q版素材要同時看這兩個
欄位才能選到正確的圖（見 `getCharacterArtworkPath()` 在 `js/00-main.js`）。

---

## 已完成功能記錄（新的加在最上面）

### 2026-08-25 — 男角 Q 版巡怪立繪（PR #2，已合併）

- 來源：使用者上傳 4 張男角 Q 版立繪（火/水/風/土，只有正面）
- 用 `rembg`（Python，U2Net 模型）做真正的透明背景去背，不是 CSS 遮色片
- 組成 2x2 透明 WebP sprite sheet，切成 9 個 base64 chunk
  （`js/v131-patrol-sprite-male-0.js` ~ `8.js`），已驗證 byte-for-byte 還原正確
- `js/26-v131-patrol-appearance.js`：新增 `isMaleCharacter()` / `maleSpriteCells` /
  `maleBackgroundPosition()`，`applyPatrolArt()` 依 `character.gender` 分流；
  男角 sprite 資料不完整時自動退回女角那組，不影響既有行為
- `js/20-anonymous-20.js`：`loadV131PatrolAppearanceAssets()` 的 `sources` 陣列
  補上 9 個新 chunk，順序排在 `js/26-v131-patrol-appearance.js` 之前
- **已知限制**：只有正面圖，沒有背面。男角巡怪時不會因為往上走切換背面顯示
  （固定顯示正面）。之後若拿到男角背面圖，可以直接比照女角那組
  `spriteCells={element:{front:[...],back:[...]}}` 的結構擴充。
- 驗證方式：`node --check` 全部異動檔案語法通過；base64 還原 hash 比對通過；
  沒有實機瀏覽器測試（環境限制，見下方「尚未驗證」）。

### 2026-08-25 — V131：17 項需求修正批次（PR #1，已合併）

對應使用者一次提出的 17 項需求，全部已在程式碼層級逐項追蹤驗證（不是只看 PR 說明文字），
細節與對應程式碼位置：

1. 每位角色/怪物出手後等 1.3 秒才輪下一位 —
   `js/25-v131-fix-batch.js` 的 `V131_RESOLVE_DELAY_MS=1300`，
   包在共用的 `finishPlayerAction`（玩家與怪物回合都共用同一個結束函式）
2. 戰鬥/野怪 icon 去背、玩家卡統一補金色外框 — 圖片本身已用真透明背景處理
   （不是 CSS 遮色片），CSS 統一補 `.battle-player` 邊框
3. 怪物兩排編隊（1–5 同排／6=3+3／7–10=5+置中補滿）—
   `getFormationRows()`，CSS `.v131-monster-row{justify-content:center}` 做置中
4. tri／row 技能依固定站位判定，死亡不補位 — 新版 `getSkillTargets()` 用陣列固定
   index 取相鄰站位、事後才過濾存活
5. 技能選單捲動範圍修正 — CSS `overflow-y:auto` + padding
6. 元素匣：單一返回鍵、按鈕改「套用並啟動」、廣告 8 小時時數門檻、統計面板
   （啟動總時數／戰鬥次數／EXP／金幣／剩餘時數）— `confirmAutoBattleSettings` 攔截，
   接既有的 `showRewardedAd()`
7. 野怪強度 +30%（HP/SP/攻/防/魔攻）— `V131_MONSTER_STRENGTH=1.30`，
   涵蓋所有已定義區域怪物陣列
8. 背包立繪依角色形象（性別＋元素）套用 — `getCharacterArtworkPath()`
   （`js/00-main.js`）+ `syncInventoryPortrait()`
9. 二三角色創建免關頁即時刷新 + 紅點提示 — `syncCharacterCreationAvailability()`
10. 技能預覽移到最上層 + 可捲動 — DOM 搬進 overlay 容器，z-index 9800
11. 技能學習/升級按鈕縮小 + 防呆確認 + 成功提示 — `learnSkill` 包一層
    `confirm()`/`alert()`
12. 技能列表先顯示物理/法術標籤（不用點開詳細資料）— `decorateSkillRows()`
13. 經驗池：純名字顯示、預覽升級、確定/返回流程 — `renderExpDistributeList` 整個改寫
14. 技能/能力值/經驗頁文字放大（框體尺寸不變）— CSS font-size 調整
15. 巡怪 Q 版立繪依角色元素切換（正反面隨移動方向），新增「形象切換」按鈕
    — `js/26-v131-patrol-appearance.js`（當時只有女角素材，男角部分見上面
    2026-08-25 的另一筆記錄）
16. 商店改黑底 — `.v131-shop-open` class 切換純黑背景
17. 戰鬥 EXP ×3.5 — `winBattle` 額外加算 `finalExp - baseExp`

**過程更正紀錄**：處理這批需求時，Claude 一度誤判「`index.html` 沒有實際載入這些檔案」
而多加了重複的 `<script>` 標籤，後來發現 `js/20-anonymous-20.js` 本身已經有動態載入器，
已撤銷那次誤改。詳見上方「系統架構重點」第 1 點，避免下一個人重蹈覆轍。

---

## 已知限制 / 待辦事項

- [ ] 男角 Q 版巡怪立繪缺背面圖（目前固定顯示正面，見上方限制說明）
- [ ] V131 這整批修正都只做過「語法檢查 + 程式邏輯追蹤驗證」，**沒有在真實瀏覽器
      （尤其 Android Chrome 實機）上操作驗證過**。如果使用者回報某個功能「看起來沒生效」，
      優先確認是不是瀏覽器快取問題，其次才懷疑程式邏輯本身。
- [ ] 目前沒有自動化測試、沒有 CI，任何改動都要靠人工／AI 自己追邏輯驗證，容易漏東西，
      如果專案繼續變大，值得考慮補基本的 smoke test。
- [ ] 元素匣的「金幣」統計目前跟著既有的 `gold` 全域變數走，沒有另外檢查這個變數
      本身的來源/正確性是否符合預期（超出這次需求範圍，沒有深入查證）。

---

## 更新守則（下一個接手的人，不管是誰，請照做）

每次工作結束前：

1. 在上面「已完成功能記錄」新增一筆，日期 + 標題 + 做了什麼 + 怎麼驗證的 + 已知限制
2. 如果解決了「已知限制 / 待辦事項」裡的項目，打勾或刪掉那一行
3. 如果發現新的架構陷阱（像「V131 不是用 script 標籤載入」那種），
   補進「系統架構重點」，不要只留在對話紀錄裡，之後不同工具、不同視窗看不到那段對話
4. 確認 `main` 分支已經是最新、可運作的狀態才算工作結束
