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

### 1.5 有辦法的話，一定要實際跑起來測試，不要只靠讀程式碼判斷

2026-08-25 這一輪修了 7 個回報的 bug（技能欄/經驗池無法捲動、巡怪立繪變白色空白方塊、
技能icon配錯、學習升級框太大、文字太小、形象切換按鈕太小畫質差），全部都是「讀程式碼
看起來沒問題，但實際渲染出來是錯的」——例如：

- 捲動失效的根本原因是 `js/19-stage-v78-character-inventory-runtime.js` 用
  `getBoundingClientRect()` 量出來的螢幕座標，除以一個「這個彈窗其實根本沒有在用」
  的 `#game-stage` 縮放係數，把可用高度誤算成快3倍大——這種bug光看程式碼邏輯完全
  看不出問題（公式本身沒有語法錯誤，數學上也「看起來合理」），只有實際量測
  `clientHeight` vs `getBoundingClientRect().height` 才發現兩者其實是1:1，
  不需要換算。
- 巡怪空白方塊是 Chromium 的一個渲染怪癖：`<img>` 只要 `src` 是一張能成功解碼的圖片
  （就算是1x1透明GIF），疊加的CSS `background-image` 大部分區域就會被畫成白色，
  這完全沒辦法從程式碼邏輯推論出來，只能實際渲染出來看、然後用最小重現案例
  （同樣的CSS套在`<div>`上 vs 套在`<img>`上比較）才能鎖定問題。

**環境裡已經有 Chromium + Playwright 可以用**（`/opt/pw-browsers/chromium-1194/`，
Node.js 版playwright套件需要自己`npm install playwright`一次，
用`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`避免它重新下載瀏覽器）。用
`python3 -m http.server` 把整個專案資料夾serve起來，配合Playwright寫小腳本
（開頁面→跑完創角流程→操作到出問題的頁面→screenshot / 讀computed style /
讀scrollTop等），是目前這個專案唯一可靠的驗證方式。**純讀程式碼、純推理
「這樣應該會動」是不夠的**，尤其是這種疊了30幾層CSS/JS override、彼此互相
用`!important`蓋來蓋去的架構，光用眼睛看很容易漏掉真正生效的是哪一條規則。

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

### 2026-08-25 — 修復 7 項回報問題（用實機瀏覽器測試逐一驗證）

使用者實際在手機/截圖上回報的 7 個問題，這次全部用本機 Playwright + headless
Chromium 架設測試環境，實際操作到出問題的畫面、量測 computed style / DOM
結構，而不是只憑讀程式碼判斷，逐一根因排查後修復：

1. **技能欄／經驗池頁面無法捲動** — 根因見上方「系統架構重點」第1.5節，
   `js/19-stage-v78-character-inventory-runtime.js` 的 `applyNow()` 改成直接用
   `body.clientHeight` 設定 `#characterTabContent` 高度，不再用
   `getBoundingClientRect()` 除以一個不適用的縮放係數。已驗證捲動可以
   到底（`scrollTop+clientHeight>=scrollHeight`）。
2. **巡怪 Q 版立繪變白色空白方塊** — 根因是 Chromium 的 `<img src=非空>` +
   CSS `background-image` 疊圖渲染 bug（跟 object-fit、素材都無關，已用
   最小重現案例確認）。`js/26-v131-patrol-appearance.js` 改用 canvas
   （`drawImage`+`toDataURL`）把sprite sheet裡需要的那一格實際「裁」成
   獨立圖片再設定 `img.src`，不再疊CSS背景。這個bug其實從最早的女角版本
   就存在，這次順便一起修掉，不是只修男角。
3. **技能圖示配錯** — 使用者提供帶名稱標籤的參考圖，用像素比對（不是肉眼）
   抓出5個實際配錯/遺漏的技能圖示並修正，細節見 `js/00-main.js` 裡
   `elementSkillIconMap` 上方的註解。`earthShield` 因為它原本用的圖被證實
   其實是 `sandWind` 的，這次拿掉了、暫時沒有圖。
4. **技能物理/法術標籤沒顯示、學習升級框太大** — 根因是
   `js/25-v131-fix-batch.js` 的 `decorateSkillRows()` 跟 `css/31` 的按鈕
   縮小規則，原本鎖定的是 `.learned-skill`/`.learnable-skill` 這兩個
   **目前版本技能頁根本不存在的 class**（真正的是 `.skill-row` /
   `.skill-action-card`），從PR#1那次開始就沒真的生效過。已改成正確的
   selector，技能icon的id（`skillIcon_xxx`）現在也拿來當作抓skillId的
   主要依據，比原本猜onclick字串可靠。
5. **技能預覽/能力值/技能列表文字太小** — 原本只在 `#characterTabContent`
   這個祖層設font-size，但底下 `.status-row`、`.skill-row-desc`、
   `.skill-preview-card` 這些元素各自都有自己的font-size，繼承鏈在那裡
   就斷了。改成直接對這些真正決定畫面文字大小的class加大，沒有動任何
   寬高。
6. **形象切換按鈕太小、畫質差** — 按鈕從58px放大到76px；icon改成即時顯示
   「目前真正選中的角色」裁切出來的圖（原本是寫死套用女角），畫質受限於
   sprite sheet本身56x84的解析度，這部分沒有從根本解決，見下方已知限制。

### 2026-08-25 — 男角 Q 版巡怪背面 + 土系技能 icon

- **男角 Q 版巡怪背面**：使用者補上了火/水/風/土四元素的男角背面立繪。
  把原本只有正面的 2x2 sprite（`js/v131-patrol-sprite-male-0.js`~`8.js`，共9個chunk）
  換成 4 欄（元素）× 2 列（正/背面）的 4x2 sprite（改名沿用同樣的檔名，
  現在是 `js/v131-patrol-sprite-male-0.js`~`17.js`，共18個chunk），
  已驗證 byte-for-byte 還原正確。`js/26-v131-patrol-appearance.js` 的
  `maleSpriteCells` 改成跟女角一樣的 `{element:{front:[...],back:[...]}}`
  結構，`applyPatrolArt()` 對男角也會依 `facingBack` 切換正背面了
  （不再固定顯示正面，這個限制已經解除）。
- **土系技能 icon**：使用者上傳了11張候選圖，比對 `js/00-main.js` 裡
  技能資料庫中（搜尋 `element:"earth"` 可以找到全部12個）土系技能的
  名稱/描述後，配對了其中10個（`petrifyFist`、`stoneBreakSky`、
  `earthquakeCrush`、`stoneThrow`、`sandWind`、`flyingSandStrike`、`dustStorm`、
  `earthShield`、`rockWall`、`barrier`），存進 `assets/skills/earth-*.jpg`
  （120x120，跟火/水系icon同規格），並在 `js/00-main.js` 的
  `elementSkillIconMap` 補上對應項目（含配對理由註解）。
  **`stoneSlash`（入門單體技能）跟 `earthEX`（被動）這兩個沒有配對**，
  因為上傳的圖裡沒有明顯對應的畫面（`earthEX` 需要的是類似
  `fire-ex.jpg`/`water-ex.jpg` 那種圖上直接寫「EX」字樣的專用icon，
  這次沒有提供這款）。另外有1張候選圖（岩石尖塔+光環，跟其他候選圖
  區分度太低）這次也沒用上。這些都是刻意留白，不是遺漏——如果之後
  要補這兩個技能的icon或想調整某個配對，直接改
  `js/00-main.js` 裡 `elementSkillIconMap` 那個物件就好。

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

- [x] ~~男角 Q 版巡怪立繪缺背面圖~~ 2026-08-25 已補上，見上方記錄
- [x] ~~土系技能 `stoneSlash`、`earthEX` 沒有icon~~ 2026-08-25 已補上
      （分別用使用者標籤確認的圖 + 新提供的EX專用圖）
- [ ] 土系技能 `earthShield`（萬象土盾）目前沒有icon——原本用的那張圖
      被證實其實是 `sandWind` 的，拿掉之後這格暫時空白，等有合適的圖再補
- [ ] 形象切換按鈕（`v131PatrolAppearanceSwitch`）的畫質受限於巡怪
      sprite sheet本身只有56x84px，放大顯示到76px按鈕上還是會有點模糊，
      這不是bug、是素材解析度先天限制。如果要真的改善，需要另外提供
      一組解析度更高（例如150x225以上）的專用素材給這個按鈕用，跟
      地圖上70x105px顯示的巡怪立繪分開處理。
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
