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

## 目前狀態（截至 2026-08-26，main @ 待這次PR合併後更新）

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

### 1.2 ★★★ `?v=` 版本號沒有跟著每次改動同步遞增，等於瀏覽器一直在用快取的舊檔案 ★★★

這是 2026-08-25 第三輪修復時發現的重大問題，**幾乎可以解釋這整個專案好幾輪
「明明修好了、使用者卻說沒生效／變得更小／又跑掉了」的回報**：

`js/00-main.js`（`index.html` 裡的 `<script src="js/00-main.js?v=XXX">`）、
`js/25-v131-fix-batch.js`、`css/31-v131-fix-batch.css`、
`js/26-v131-patrol-appearance.js`、`css/32-v131-patrol-appearance.css`
（這五個檔案都是在 `js/20-anonymous-20.js` 裡用帶 `?v=數字` 的網址動態載入的）
這種「網址帶版本號」的寫法，目的是讓瀏覽器把這個網址當成「內容不會變的
固定版本」放心快取很久——**但前提是每次真的改了檔案內容，就要跟著把
`?v=` 後面的數字改掉**，不然瀏覽器（尤其手機瀏覽器的長效快取）會一直
serve舊內容，網址完全沒變過，瀏覽器根本不知道要重新抓。

實際稽核發現：`js/00-main.js?v=130` 這個版本號，從很早以前（`77583cd`那個
commit之前）就沒再變過，但這之後好幾輪修改（`elementSkillIconMap`、
`switchCharacterTab`、自動戰鬥設定的padding/max-height……）全部都是改
`js/00-main.js`本體，`?v=130`卻原封不動。`css/31-v131-fix-batch.css?v=131`、
`js/25-v131-fix-batch.js?v=131`也是同樣狀況——從V131第一批修正到現在
好幾輪，版本號都固定寫死`131`，即使內容改了很多次。

**這代表使用者實機測試時，很可能一直看到的是舊版（甚至是好幾輪前）的
程式碼/樣式，不是Claude/GPT剛剛推上去的版本**，這完全可以解釋「字級
明明就改大了，使用者卻說變更小了」這種矛盾回報——使用者看到的搞不好
根本是更早一輪、還沒放大過的快取版本。

**這次的修法**：把 `index.html` 裡的 `js/00-main.js?v=130` 改成
`?v=132`，`js/20-anonymous-20.js` 裡的 `css/31-v131-fix-batch.css`、
`js/25-v131-fix-batch.js`、`css/32-v131-patrol-appearance.css`、
`js/26-v131-patrol-appearance.js` 全部統一改成 `?v=132`。

**★ 以後的規則（務必遵守）**：只要改了這五個檔案裡任何一個的內容，
**當次收工前一定要把該檔案的 `?v=` 數字往上加**（找 `index.html` 的
`<script src="js/00-main.js?v=...">` 那一行，跟 `js/20-anonymous-20.js`
裡對應那個檔案的 `?v=...`），沒改版本號 = 使用者的瀏覽器很可能繼續看到
舊版，等於這次的修改在使用者端形同沒發生過。

至於沒有版本號、用純靜態 `<link>`/`<script>` 標籤載入的檔案（例如
`css/00-main.css`、`css/22-stage-v78-character-inventory-core.css`）——
這些沒有辦法用改版本號的方式強制刷新，只能依賴 GitHub Pages 預設的
快取時間（通常較短，會自然過期重新抓取），風險比上面那五個「版本號寫死
沒跟著動」的檔案低很多，不用特別處理，但如果同一批修改剛好也動到這類
檔案，還是可以在說明裡提醒一下「這個部分可能要等快取自然過期或使用者
強制重新整理」。

### 1.3 ★ 改`#allElementSkillPreviewModal`（全屬性技能預覽）的font-size，數字要乘上約2.57倍才會是螢幕上實際看到的大小

`#allElementSkillPreviewModal`（技能頁面裡「全屬性技能預覽」那個彈窗）
活在 `#game-stage` 的 `transform:scale()` 座標系底下——整個遊戲畫面先在
1080寬的設計稿座標畫好，再用CSS transform整體縮小貼合手機實際螢幕寬度。
用Playwright在420px寬viewport量到的縮放比例是 `0.388889`
（`getComputedStyle(document.getElementById('game-stage')).transform`
= `matrix(0.388889,...)`），這個比例不會因為手機型號差很多（因為設計稿
1080寬、手機大概380~430寬，比例都在0.35~0.40左右），可以放心當通用值。

2026-08-25~26這幾輪一路把這個彈窗的文字從13.5px加大到22px，使用者卻
一直反映「還是很小」——真正原因是**這裡寫的font-size會再被那層scale
乘上0.389**，22px實際顯示在螢幕上只剩約8.6px，每一輪的「加大」在螢幕上
的實際效果都被吃掉六成多，難怪感覺沒什麼用。2026-08-26最後一輪
（`css/31-v131-fix-batch.css`裡`.skill-preview-card`那幾條規則）已經
改成寫90px（希望螢幕上看到35px的話，就要寫35÷0.388889≈90px），已用
`getBoundingClientRect()`實測確認換算後數值正確。

**以後如果要再調這個彈窗（或任何確認過活在`#game-stage`縮放座標系底下
的其他元素）的字級/尺寸，記得先用類似方法量一次目前的縮放比例
（比較`getBoundingClientRect().height`跟`offsetHeight`兩個值的比例），
再回推「螢幕上想要的實際px值 ÷ 縮放比例」寫進CSS，不要直接把使用者說的
數字原封不動寫進去。**

反過來，`#homeFeatureModal`（角色/技能列表、狀態頁那個彈窗）已經在
更早一輪（`js/19-stage-v78-character-inventory-runtime.js`那次修正）
證實是1:1顯示、沒有被這層縮放影響，同一個技巧不適用在那個彈窗上——
不同彈窗、不同容器，套用縮放與否可能不一樣，改之前務必個別實測，
不要憑印象套用。

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

現有範例：`js/v131-patrol-sprite-0.js` ~ `9.js`（女角 Q 版，3x3 grid，
每格對應一個元素的正/背面，2026-08-25第二輪用更高畫質來源重建過，
chunk數從6個增加到10個）、`js/v131-patrol-sprite-male-0.js` ~ `17.js`
（男角 Q 版，4x2 grid，正背面皆有）。

**換掉chunk內容但檔名／數量不變時，記得把 `js/20-anonymous-20.js` 裡
對應的 `?v=131x` query string 版本號往後遞增**（例如`131a`→`131e`），
不然使用者瀏覽器可能還快取著舊版base64內容，看起來像是「換圖沒生效」。
如果chunk數量本身變多／變少，`sources`陣列也要同步增減對應的檔案清單。

### 4. 角色系統：`player`／`player2`／`player3`

三個角色是平行結構（不是陣列），輔助函式 `getPartyCharacterByIndex(index)`／
`getExistingPartyIndexes()` 統一處理「不管哪個角色，只要存在就處理」的邏輯，
新程式碼盡量呼叫這兩個輔助函式，不要自己寫 `index===0?player:index===1?player2:player3`
這種三元判斷（雖然舊程式碼裡到處都是，但新增的部分盡量別再加）。

`character.gender`（`"male"`/`"female"`）跟 `character.element`
（`"fire"`/`"water"`/`"wind"`/`"earth"`）是兩個獨立欄位，立繪/Q版素材要同時看這兩個
欄位才能選到正確的圖（見 `getCharacterArtworkPath()` 在 `js/00-main.js`）。

### 5. `#game-stage` 裡新增任何需要手指捲動的容器，記得加進觸控鎖白名單

`js/01-stage-v8-touch-lock.js` 有一個全域的 `touchmove` 監聽，只要觸控目標在
`#game-stage` 裡面、又不在它自己維護的 `allowedSelector` 白名單覆蓋的可捲動容器內，
就會 `preventDefault()` 整個擋掉，防止手指誤滑到遊戲背景造成非預期的頁面捲動/縮放。

**這代表：任何新增的、預期要能讓玩家手指滑動捲動的容器（新彈窗、新列表……），
如果沒有把它自己的 class/id 加進這份白名單，程式化設定 `scrollTop` 會正常運作
（因為那不經過touchmove事件），但玩家真的用手指滑的時候會完全沒反應**——這正是
2026-08-26「全屬性技能預覽」彈窗「不能捲動」回報的根本原因，`.skill-preview-body`
從這個功能一開始做出來就沒被加進白名單，只是內容夠短、從來不需要真的捲動，才一直
沒被發現。之前好幾輪单純用`scrollTop`/`getBoundingClientRect()`驗證捲動「看起來沒問題」，
其實都沒有測到真正的手指觸控路徑，都是不夠準的驗證方式。

**以後只要新增/發現任何「這裡應該要能捲動」的容器，驗證方式要用模擬真實觸控滑動
（Playwright的`Input.dispatchTouchEvent`，`touchStart`→`touchMove`→`touchEnd`），
不能只測`scrollTop`賦值或`overflow-y:auto`的computed style，這兩種都測不出
觸控鎖擋住手勢這種問題。**

---

## 已完成功能記錄（新的加在最上面）

### 2026-08-26 — 自動戰鬥設定：拆掉雙層框、拿掉多餘的內部捲動

使用者回報自動戰鬥設定視窗「不用又有一個內框，直接一個框就好，然後把框放大，
讓所有按鈕文字一次就呈現，無需捲動」（附截圖：外層`.home-feature-modal-box`
裡面還套了一層有自己金色邊框/底色的`#autoBattleSettingsPanel`，內層框自己
被截斷、下面還有一段捲軸，內容被裁掉一部分）。

**根因**：`css/08-stage-v14-character-scroll-fix.css`裡有一條舊規則
`#homeFeatureModal .auto-settings-expanded{ max-height:70dvh; overflow-y:auto !important; }`，
把這個面板單獨鎖在比外層`.home-feature-modal-box`（`max-height:96dvh`）矮很多
的高度上，造成「外層框其實還有空間、內層框卻先被截斷、還要自己捲動」的雙框
＋內部捲動怪象。這條規則是V14那一輪為了修捲動問題加的，後來`.dock-bottom`
被拿掉、外層框的max-height也已經放寬到96dvh，這條70dvh的舊規則卻沒有跟著
拿掉，變成技術債。

**修法**：
1. 拿掉這個面板自己的`max-height:70dvh`跟`overflow-y:auto !important`，
   改成`overflow:visible !important; max-height:none !important;`，讓它
   單純隨內容長高，捲動完全交給外層`.home-feature-modal-box`一個人負責
   （本來就有`overflow-y:auto`＋`96dvh`）。
2. 新增`#homeFeatureModal #autoBattleSettingsPanel.auto-settings-expanded{border:0;background:transparent;border-radius:0;box-shadow:none;padding:0;}`，
   拿掉面板自己的視覺框（原本`.auto-settings-expanded`基礎樣式在
   `00-main.css`裡有自己的金框/深底/圓角/10px padding），只留外層那一個
   框，外層本來就有16px padding，內容不會貼邊。

**驗證方式**：Playwright量測`getBoundingClientRect`/`getComputedStyle`，
確認：內層面板`border`/`background`/`padding`都歸零、`max-height:none`、
`overflow-y:visible`；在900px高的視窗下外層框（663px）完全不需要捲動就能
裝下全部內容（含最下面「套用並啟動」按鈕）；把視窗高度模擬降到700px甚至
600px時，也只有外層框一個捲軸（不再是雙層框各自截斷），符合預期的優雅
降級行為。截圖比對確認視覺上真的變成單一個框、所有卡片與按鈕一次顯示。
另外用Playwright實際點擊「啟動」按鈕確認`autoBattle`狀態正常切換，
確認這次改動沒有動到任何點擊事件邏輯。

**已知限制**：`css/08-stage-v14-character-scroll-fix.css`目前沒有被納入
`?v=`快取版本號機制（原本就是用純`<link>`標籤靜態載入，不像V131/V132那幾個
檔案有動態載入器＋版本號），這次修改如果使用者瀏覽器快取了舊版CSS，可能
需要手動清一次快取或強制重新整理才會看到效果。

### 2026-08-26 — V132：新增符咒／材料／裝備套裝／抽獎券／三個日常副本（第四輪大改動）

使用者這輪提出一次大型內容擴充需求（不是回報bug）：新增3種符咒（冰封/隱身/結界，各4階，
命中機率＝階級固定機率＋角色智力加成）、礦石與裝備設計圖紙材料、一般練功4種低階道具各5%
獨立掉落、3個日常副本（經驗/材料/裝備，各每日1次、失敗不扣次數）、4元素裝備套裝（赤炎/
寒泉/岩岳/青嵐，各10件、3件6圍全+1／5件對應元素技能傷害+2%）、抽獎券開套裝機制，外加
把回合間空拍從1.3秒調到1.5秒。全部新增邏輯放在新檔案：

- **`js/27-v132-content-expansion.js`**（新檔）：整包內容邏輯，用同一個IIFE、「讀舊函式→
  包一層→呼叫原函式→加新邏輯→塞回同名全域變數」的既有override手法接進
  `killMonster`/`winBattle`/`loseBattle`/`resolveQueuedPlayerAction`/`getEquipmentBonus`/
  `getElementDamagePassiveMultiplier`/`equipSelectedItem`/`renderBattleItemMenu`/
  `renderDungeonTabContent`/`openItemModal`/`openEquippedItem` 這些既有函式，沒有改動任何
  一行`js/00-main.js`本體。副本怪物借用`monsters`全域陣列本來就可以整包替換的既有慣例
  （`launchDungeonBattle()`借完整份`monsters`/`currentZone`，結束後完整還原）。
- **`css/33-v132-content-expansion.css`**（新檔）：獎勵彈窗、副本清單卡片、抽獎券選擇按鈕
  的最小可用樣式，跟遊戲既有深色系配色一致。
- **`js/20-anonymous-20.js`**：比照V131的動態載入器模式，新增`loadV132ContentExpansion()`，
  在`DOMContentLoaded`後動態插入上面兩個新檔案（`?v=132`）。
- **`js/25-v131-fix-batch.js`**：`V131_RESOLVE_DELAY_MS` 從1300改成1500（回合間空拍1.5秒）。

**過程中發現並修正的2個真bug**（都是先寫程式碼再用Playwright實際跑過才抓到的）：

1. 一開始寫talisman結算的dispatch override時猜錯了`js/00-main.js`裡「宣告後結算」那個
   函式的名字（猜成`resolveQueuedActionForCharacter`），實際上是`resolveQueuedPlayerAction`
   （`characterIndex,token`兩個參數）。已用`grep`實際確認函式名稱並修正，不然符咒在戰鬥中
   會完全沒有結算效果（原本的程式碼有`console.warn`防呆，但如果沒特別去看console log
   很容易漏掉這個問題，之後接手的人寫override前務必先grep確認函式名稱存在）。
2. 4元素裝備套裝裡武器部位（刀/扇）的物品`type`原本寫成`"hand"`，但`js/00-main.js`裡
   實際決定「這個type能不能被穿到哪個裝備欄」的`getInventoryEquipmentSlot()`只認
   `"weapon"`這個type字串（`"hand"`不在對照表裡，會導致穿裝失敗但不會報錯，
   `equipSelectedItem()`只是靜默return）。這個bug在headless瀏覽器裡實際測試「裝備套裝
   3件加成」時才發現（穿裝之後套裝計數一直卡在2，湊不滿3件）。已修正成`type:"weapon"`。
   `js/00-main.js`本身這裡有個既有的不一致（`isEquipmentInventoryType()`把`"hand"`也算
   進去、但`getInventoryEquipmentSlot()`不認），這次沒有動`00-main.js`去修這個不一致，
   只是確保新增的物品定義用對的type值。

**驗證方式**：用本機 `python3 -m http.server 8899` + Playwright headless Chromium，全程繞過
UI表單直接呼叫`createCharacter()`/`createAdditionalCharacter()`建立測試角色（等級直接改
`player.level`），逐一實際跑過以下流程並確認資料/DOM狀態正確、全程零`pageerror`：
- 一般練功掉落：強制RNG必中，確認4種低階道具（3符咒+1礦石）各自獨立判定、能正確加入背包
- 符咒戰鬥使用：冰封符命中（怪物正確拿到`{type:"freeze",turnsLeft:4}`狀態、庫存正確扣1）、
  未命中（畫版失敗log、不消耗額外庫存）、`renderBattleItemMenu()`在符咒分頁正確渲染出
  可點擊按鈕（含「生效機率35%」文字、`onclick="useTalisman(...)"`）
- 裝備套裝：等級門檻（<20阻擋並跳alert、≥20放行）、3件6圍+1加成（數值逐項核對正確）、
  5件對應元素傷害+2%（用`player`本人跟`player2`分別驗證只有元素/套裝都符合的角色才吃到）
- 抽獎券開套裝：消耗1張券、正確拿到1件對應套裝的隨機部位
- 三個日常副本完整跑過（用真實的`winBattle()`/`loseBattle()`/`checkBattleEnd()`結算，不是
  另外模擬）：經驗副本3場車輪戰完整跑完、獎勵彈窗、直接領取後`sharedExp`正確增加、
  今日已完成後二次挑戰被正確擋下；材料副本依回合數判斷寶箱數量、開箱正確拿到材料；
  裝備副本boss+4精英、抽獎券選擇彈窗、直接領取跟看廣告雙倍領取（`showRewardedAd`）兩條
  路徑都測過；戰敗路徑確認`monsters`/`currentZone`會正確還原、當日挑戰次數不會被扣掉、
  可以立刻重新挑戰
- 每日重置：把`localStorage`裡`v132_daily_dungeon_state`的日期改成很久以前，重新整理頁面
  （模擬跨日）後確認`used`狀態正確重置、副本重新可挑戰
- 物品詳細彈窗SVG圖示渲染修正：確認`openItemModal()`裡的圖示元素`innerHTML`真的長出
  `<svg>` DOM節點，不是被當成一整串文字印出來

**已知限制**：
- 只做了資料/邏輯層跟最小可用的CSS/inline SVG視覺（依使用者明確指示「先暫時用
  CSS/JavaScript動畫+Canvas/SVG做出來，後期再用美術更改」），沒有做逐畫面UI走查
  （例如真的用滑鼠點過副本清單頁的排版、抽獎券選擇按鈕在小螢幕的實際觸感），這次全部
  驗證都是直接呼叫底層函式/操作DOM狀態，不是模擬真實手指點擊整個流程。
- 沒有測試三個角色（`player3`）情境下的套裝加成/副本開放條件，目前雙角色門檻只用
  `player`+`player2`驗證過。
- `js/27-v132-content-expansion.js`裡裝備副本的雙倍領取流程（`v132ClaimEquipmentDungeonReward`
  裡的`grant2`巢狀函式）寫法稍微繞，邏輯正確但之後如果要再擴充建議順手整理成跟
  `v132ClaimMaterialDungeonReward`/`v132ClaimExpDungeonReward`一致的寫法。

### 2026-08-26 — 按鈕洩漏到其他視窗、護盾扣血提示重複、技能預覽捲動破圖調查

使用者這輪回報4個問題，附了5張截圖：

1. **「全屬性技能預覽」按鈕洩漏到自動戰鬥設定視窗上**（使用者截圖裡自動戰鬥
   設定視窗右上角多了一顆不該出現的「全屬性技能預覽」按鈕，UI因此變得
   雜亂）— 根因跟`statusHelpButton`是同一種bug：`skillPreviewHeaderButton`
   只有在`switchCharacterTab()`切分頁時被設定顯示/隱藏，但`closeHomeFeature()`
   關閉視窗時沒有把它重置回隱藏（`statusHelpButton`當時有重置、這顆漏掉了），
   只要玩家進過一次技能分頁，這顆按鈕的`display:inline-block`就會一直殘留，
   之後開任何其他視窗（自動戰鬥設定、商店……）都會看到它。已補上跟
   `statusHelpButton`一樣的重置。「套用並啟動按鈕在戰鬥中沒反應」用
   Playwright實測（含真的在戰鬤中、元素匣有剩餘時數的情境）沒有重現，
   懷疑是同一個按鈕洩漏造成的版面錯位間接影響到點擊，這次一起修掉了，
   如果還有問題需要使用者再回報。
2. **護盾扣血提示邏輯**：護盾完全擋下這次攻擊（`damage`被扣到0）時，原本
   還是會呼叫`showPlayerHit(0,"hp",...)`，跳出沒有意義的「-0HP」紅字跟
   卡片震動。改成只有`damage>0`（護盾沒完全擋住、真的有扣血）才呼叫，
   已用Playwright實測驗證：巨大護盾情境下全程0次紅字HP彈出、只有白色
   護盾扣除數字；小護盾（會被打穿）情境下第一擊護盾+HP兩個彈出都出現、
   之後護盾耗盡只剩紅字HP彈出，符合「除非護盾剩餘承受量小於傷害才一起
   顯示」的需求。
3. **技能預覽頁「破圖」（截圖顯示捲動時文字疊字/亂碼）**：⚠️ 沒有修好，
   用真實觸控滑動模擬（含快速連續滑動、滑動中間截圖、切分頁後滑動）
   反覆嘗試都無法重現截圖裡那種疊字畫面。截圖裡出現不屬於任何真實技能
   名稱的亂碼文字（例如「水對象手」），比較像是手機在捲動慣性還沒完全
   合成好新畫面的那一瞬間被截圖截到，不是持續性的頁面狀態錯誤——這種
   時序問題沒辦法從程式邏輯上直接「修好」，只能做常見的手機捲動效能
   優化（`.skill-preview-card`加上`contain:content`跟`will-change:
   transform`，讓每張卡片各自獨立合成，降低捲動時整體重繪量），降低
   發生機率。如果之後還是常常發生，需要使用者提供**螢幕錄影**（不是
   截圖）才有機會抓到真正的畫面時序、確認是不是同一種情況。
4. **背包介面返回鍵不見了**：⚠️ 沒有找到、也沒有重現。用Playwright檢查了
   背包的兩個進入路徑（下方導覽列的`#inventoryPage`、地圖頁裡
   `openMapInventoryOverlay()`開的覆蓋層版本），關閉/返回按鈕在兩邊都
   正常顯示、正常運作。這次使用者附的5張截圖裡沒有一張是背包畫面，
   缺乏視覺線索比對，下一個接手的人如果要繼續查，需要先跟使用者要
   一張實際看到「返回鍵不見了」那個畫面的截圖，才好判斷到底是哪個
   背包相關畫面、哪個按鈕。

### 2026-08-26 — 全屬性技能預覽：真正修好捲動 + 字級調到舒服大小

上一輪把文字加大到90px（螢幕上約35px）之後，使用者回報「不能捲動，下面看不到」，
而且35px確實太大。這次兩個問題一起修：

1. **捲動bug的真正根因**：`js/01-stage-v8-touch-lock.js`的全域觸控鎖白名單
   一直沒有把`.skill-preview-body`加進去，手指真的滑動時被完全擋掉（程式化
   `scrollTop`賦值不受影響，所以之前用這個方法驗證「看起來沒問題」其實沒測到
   真正的問題）。加進白名單後，用Playwright模擬真實觸控滑動
   （`Input.dispatchTouchEvent`）驗證過`scrollTop`真的會跟著改變。詳細原理見
   上方「系統架構重點」第5節，以後任何新增的可捲動容器都要記得檢查這份白名單。
2. **字級調到舒服大小**：90px降到標題49px（螢幕約19px）、屬性分頁按鈕39px
   （螢幕約15px）、技能名稱44px（螢幕約17px）、分類標籤33px（螢幕約13px）、
   說明文字39px（螢幕約15px），都是用0.388889縮放比例換算，數值在
   `css/31-v131-fix-batch.css`裡`#allElementSkillPreviewModal`那幾條規則。

### 2026-08-26 — 全屬性技能預覽文字真正的根因修正（PR #9）

第三輪修完後，使用者又反映「全屬性技能預覽」文字還是很小、直接要求
加到35px。這次沒有再單純把數字往上調，而是實測發現這個彈窗活在
`#game-stage`的scale座標系底下（縮放比例0.388889），前幾輪一路加大的
13.5→22px全部被這層縮放吃掉六成多，難怪使用者一直覺得沒變。改成寫
90px（35÷0.388889換算回來的補償值），讓螢幕上實際顯示出來才是使用者
要的35px。詳細原理跟換算方法寫進了上方「系統架構重點」1.3節，以後
再調這個彈窗或任何confirmed活在game-stage縮放座標系底下的元素，都要
先實測縮放比例再回推數值，不能直接把使用者說的px數字原封不動寫進去。

### 2026-08-26 — 第三輪修復 11 項回報問題

使用者這次回報11個問題，同樣全部用Playwright + headless Chromium逐一驗證：

1. **戰鬥資訊框/人物卡牌高度應固定（不管1排或2排怪物）** —
   `#battleMonsterArea.v131-formation`原本`min-height`只夠1排（90px），
   1排怪物時容器變矮，靠剩餘空間伸縮的回合資訊框跟著變高、人物卡牌
   位置跟著跑動。改成固定`min-height:189px`（2排怪物+排間距+容器
   padding），不管實際幾排怪物都保留這個高度。
2. **爆擊文字太大** — `.damage-popup.critical-popup`原本27px、動畫
   峰值再乘1.62倍（實際峰值43.7px），縮小成17px+動畫峰值1.25倍
   （峰值約21px）。
3. **土皇戰鬥沒有金色外框 + 玩家立繪去背** — 根因找到：
   `css/11-stage-v41-cast-text-and-player-alpha.css`裡一個V41年代
   的`#battlePlayerCard0{border:0 !important;...}`規則，因為是ID
   選擇器，specificity比V131後來加的`.battle-player`金色外框規則高，
   不管load順序、兩邊都是`!important`，ID選擇器還是贏，導致「隊伍
   第一位」角色（不分哪個元素）永遠沒有外框。拿掉這條規則裡的
   border/outline/box-shadow三行即可。去背部分：用rembg把8張
   `assets/characters/性別_元素.jpg`去背存成專屬的
   `assets/characters/battle_性別_元素.png`，新增
   `getCharacterBattleArtworkPath()`只給戰鬥卡片用，跟角色創建預覽/
   背包立繪頁面共用的`getCharacterArtworkPath()`分開，不影響那兩個
   地方仍顯示原本帶場景背景的版本。
4. **巡怪立繪正背面顏色不一致 + 解析度太低** — 用像素比對抓出根因：
   上一輪重建女角sprite時，水/風/土三個「背面」來源圖被循環錯位
   （風背面誤用了土的圖、土背面誤用了水的圖、水背面誤用了風的圖），
   已重新用正確對應關係建置。解析度部分：sprite cell從56x84放大到
   140x210（跟顯示尺寸70x105等比例放大2倍，手機retina螢幕更清晰），
   男角sprite維持原本56x84不變（沒有新素材可換），`js/26-v131-patrol-
   appearance.js`的裁切函式改成依sheet分別建立各自尺寸的canvas。
   形象切換按鈕從76px縮小成68px，跟正上方返回鍵（68px）統一。
5. **背包角色切換箭頭與關閉按鈕重疊** — 根因是`.inventory-character-
   switch`原本用grid撐滿整列寬度，右箭頭被推到最右緣、卡進絕對定位
   貼右上角的關閉按鈕下面。改成flex置中、箭頭貼齊角色名稱兩側；
   角色名稱較長時，另外針對「從地圖頁開啟的覆蓋層版本」（唯一會出現
   關閉按鈕的情境）加了`padding-right:64px`，確保置中範圍主動避開
   關閉按鈕，不管名字多長都不會再撞在一起。
6. **全屬性技能預覽文字仍然太小** — 這是第三次加大請求，數值從
   17/19/20px加大到19/21/22px；同時發現並修正了1.2節那個版本號沒有
   遞增的根本問題（`css/31-v131-fix-batch.css?v=131`從第一輪到現在
   沒變過），使用者先前看到的字級很可能根本是瀏覽器快取的舊版本，
   不是這幾輪的修改真的沒生效。
7. **能力值/技能詳細/全屬性技能預覽頁面「破圖頻繁閃爍」** —
   ⚠️ **這項沒有修**：用MutationObserver監測5秒沒有發現任何`<img>`
   的src被反覆改動、用網路監聽沒有發現任何圖片資源404、用連續截圖
   像素比對也沒有偵測到明顯的視覺跳動（跟這三個頁面共用的
   `.home-feature-modal-box`邊框呼吸動畫`borderGlowBreathe`吻合的
   3.6秒週期性效果只有極輕微的glow變化，不是「破圖」）。在目前這個
   headless Chromium測試環境完全無法重現使用者描述的症狀，比較合理
   的懷疑方向是使用者實際裝置的GPU/瀏覽器版本特有的渲染問題（類似
   之前抓到的「img+background-image」Chromium渲染bug，那次也是
   在別的環境完全正常、只有特定版本才會出現）。已經在回覆裡明確告知
   使用者這項沒有修好、需要更多線索（例如螢幕錄影、是不是特定機型）
   才能繼續往下查，避免不確定的情況下亂猜亂改。
8. **導覽列野怪區icon沒去背** — 唯一一個還是RGB（不透明）、而且解析度
   異常大（1536x1404，其他都是~320px的RGBA透明PNG）的nav icon，
   確認是這格素材沒有跟其他icon一樣走過去背流程。用rembg去背+
   縮小到跟其他icon一致的~320px，直接覆蓋`assets/ui/nav-training.png`。
9. **背包裝備部位「肩甲」改「護腕」** — `js/00-main.js`的
   `renderEquipment()`裡`slots`陣列，純文字修改。
10. **自動戰鬥設定頁面應固定置中、放大避免捲動** — 這是對更早一輪
    使用者自己要求的「dock-bottom貼底顯示」的明確反悔（「有時候置中
    有時候靠下面」正是因為戰鬥中/非戰鬥中切換dock-bottom造成的），
    這次改成完全不再加`dock-bottom`這個class，兩種情境都維持
    `.home-feature-modal`預設的置中顯示；視窗`max-height`不分情境
    統一用96dvh（原本戰鬥中還是卡在80dvh）。
11. **護盾視覺效果**（HP條增加等值白色色塊、吸收傷害顯示白色扣除
    動畫）— 底層的護盾傷害吸收邏輯（`min(傷害,護盾剩餘)`吸收、
    超過的部分才真的扣血）其實早就是對的，這次純粹是補視覺呈現：
    HP bar新增`.hp-bar-shield-overlay`白色色塊（`left`=目前HP%，
    `width`=護盾剩餘/maxHP%，緊接在紅色血量後面），`updateSingle
    CharacterBars()`裡同步計算更新；新增`showShieldAbsorb()`跳出
    白色（非紅色）的傷害數字（`.damage-popup.shield-popup`），
    在燃燒傷害吸收跟一般攻擊傷害吸收兩處各呼叫一次。

**已知限制／未完成**：第7項（破圖閃爍）沒有修，需要使用者提供更多
線索才能繼續排查，詳見上方第7點說明。

### 2026-08-25 — 第二輪修復 7 項回報問題（PR #6，已合併）

延續上一輪的7項修復，使用者再次實際操作後回報7個新問題，全部用 Playwright +
headless Chromium 逐一驗證後修復：

1. **形象切換按鈕圖片畫質太差** — 使用者這次提供的不是角色素材，而是一張專屬的
   「形象切換」功能徽章圖（固定圖案，跟角色/元素無關）。`js/26-v131-patrol-appearance.js`
   的 `updateSwitchIcon()` 改成套用這張靜態高畫質圖（存成
   `assets/ui/patrol-appearance-switch-icon.png`），不再動態套用「目前選中角色」
   裁切出來的低解析度sprite小圖。上一輪「已知限制」裡提到的畫質問題已解決。
2. **技能正確名稱** — 用像素比對找出真正的根因：`js/00-main.js` 的
   `elementSkillIconMap` 裡 `dustStorm`（真實名稱「地牛猛襲」）跟 `rockWall`
   （真實名稱「岩石壁壘」）兩個技能的icon檔案內容被對調了（這個bug在更早一輪就存在，
   不是這次才introduce的，只是這次使用者提供的兩張標籤參考圖才讓它被抓出來）。
   直接對調 `assets/skills/earth-dust-storm.jpg` 跟 `earth-rock-wall.jpg`
   兩個檔案的內容（不用改 `elementSkillIconMap`，key跟檔名本來就是對的，
   錯的是檔案內容本身）。同時使用者重新提供「萬象土盾」的專用圖，補回
   `earth-shield.jpg`（上一輪拿掉後的已知限制，這次解決）。
3. **重新上傳高畫質Q版女生立繪** — 使用者提供8張新的火/水/風/土（各正/背面）
   高解析度立繪（1024x1536，比例剛好等於sprite cell的56:84），整組重新組成
   3x3 sprite sheet（`/tmp/new_female_sheet.png`→webp），改用10個base64 chunk
   （原本6個chunk放不下，`js/v131-patrol-sprite-0.js`~`9.js`），並在
   `js/20-anonymous-20.js` 的 `sources` 陣列補上新的4個chunk檔案、
   把版本query string從`?v=131a`改成`?v=131e`避免瀏覽器快取舊sprite。
   已驗證新sprite視覺品質明顯提升。
4. **全技能預覽文字太小** — 上一輪已經加大過一次（13.5/14.5/15px），使用者反映
   還是太小，這次大幅加大到17/19/20px（`css/31-v131-fix-batch.css`）。
5. **全技能預覽按鈕位置** — 原本跟「技能配裝」標題並排在技能頁面內部，使用者
   要求移到「返回」按鈕正下方。改法：把共用彈窗header（`.home-feature-modal-title`
   右側原本只有？/返回兩顆按鈕的區塊）從單排改成兩排的flex column，新增
   `id="skillPreviewHeaderButton"`放在第二排，預設隱藏，`switchCharacterTab()`
   切到`"skill"`分頁時才顯示（跟`statusHelpButton`同一套邏輯），技能頁面內部
   原本那顆按鈕直接移除，不留重複按鈕。
6. **自動戰鬥設定頁面無法捲動** — 這次的根因跟上一輪`characterTabContent`那個
   bug不一樣：捲動機制本身其實沒壞（程式化`scrollTop`賦值、模擬觸控滑動都能
   捲到底），真正原因是`.home-feature-modal.dock-bottom{padding-bottom:172px}`
   （原本是為了貼齊戰鬥中的戰鬥資訊框設計的）不管是不是真的在戰鬥中都套用，
   加上`.home-feature-modal-box`自己`max-height:80dvh`的硬上限，兩者疊加導致
   非戰鬥中開啟這個設定頁時可用高度被過度壓縮。`js/00-main.js`裡開啟這個彈窗
   的地方改成：`padding-bottom`跟`max-height`都依`battleActive`動態設定
   （戰鬥中維持172px/80dvh，非戰鬥中降到24px/96dvh）。已驗證：一般420x900
   viewport下可用高度剛好等於內容高度（完全不用捲）；就算故意縮到390x660
   這種比任何真實手機都短的極端viewport，剩餘的一點點內容也能透過捲動
   （程式化與真實觸控滑動皆測試過）完整看到。
7. **技能升級沒有防呆/成功提示** — 上一輪只幫`learnSkill`加了`confirm()`/
   `alert()`包裝，`upgradeSkill`當時沒有同步處理。`js/25-v131-fix-batch.js`
   補上結構相同的`upgradeSkill`包裝，已驗證確認對話框跟成功提示都正常
   跳出，技能等級也確實從1升到2。

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
- [x] ~~土系技能 `earthShield`（萬象土盾）沒有icon~~ 2026-08-25第二輪已補上
      （使用者重新提供專用圖，見上方記錄）
- [x] ~~形象切換按鈕畫質差~~ 2026-08-25第二輪已解決：改用使用者提供的專用
      靜態徽章圖，不再依賴56x84的低解析度角色sprite裁切
- [x] ~~V131這幾批修正的瀏覽器快取風險~~ 2026-08-26第三輪找到具體根因並修正：
      `js/00-main.js`/`js/25-v131-fix-batch.js`/`css/31-v131-fix-batch.css`/
      `js/26-v131-patrol-appearance.js`/`css/32-v131-patrol-appearance.css`
      這五個檔案的`?v=`版本號好幾輪都沒有跟著內容變動遞增，這次已經統一
      bump到`?v=132`。**這不是一次性修好就沒事了——之後每次改這五個檔案
      裡任何一個，都要記得手動把對應的`?v=`數字往上加一**，詳見上方
      「系統架構重點」1.2節，這是目前最容易被忽略、後果卻最嚴重的坑。
- [ ] 目前沒有自動化測試、沒有 CI，任何改動都要靠人工／AI 自己追邏輯驗證，容易漏東西，
      如果專案繼續變大，值得考慮補基本的 smoke test。
- [ ] 元素匣的「金幣」統計目前跟著既有的 `gold` 全域變數走，沒有另外檢查這個變數
      本身的來源/正確性是否符合預期（超出這次需求範圍，沒有深入查證）。
- [ ] **全屬性技能預覽頁面捲動時「破圖」（文字疊字/亂碼）**（2026-08-26
      這一輪使用者附截圖回報，沒有修好）：這次已經確認捲動本身的機制是
      正常的（touch-lock白名單漏洞已修好、真實觸控滑動能正常運作），
      「破圖」單純是視覺呈現問題。用真實觸控滑動（含快速連續滑動、
      滑動中間截圖、切分頁時滑動）在headless Chromium測試環境都無法
      重現截圖裡那種疊字/亂碼畫面，懷疑是手機捲動慣性還沒完全合成好
      畫面那一瞬間被截圖截到的時序artifact，不是持續性的邏輯bug（詳見
      上方「已完成功能記錄」）。已加上`contain`/`will-change`降低發生
      機率，但沒有辦法確認是否真的解決。下一個接手的人如果使用者還在
      回報，需要跟使用者要**螢幕錄影**（不是截圖）才有機會抓到真正的
      畫面時序。
- [ ] **背包介面「返回鍵」不見了**（2026-08-26這一輪使用者回報，沒有找到
      也沒有重現）：檢查過背包的兩個進入路徑（下方導覽列的
      `#inventoryPage`、地圖頁`openMapInventoryOverlay()`開的覆蓋層），
      關閉/返回按鈕在兩邊都正常。使用者這次沒有附背包畫面的截圖，缺乏
      視覺線索比對，下一個接手的人需要先跟使用者要一張實際看到問題的
      截圖，才能判斷到底是哪個背包相關畫面、哪個按鈕。

---

## 更新守則（下一個接手的人，不管是誰，請照做）

每次工作結束前：

1. 在上面「已完成功能記錄」新增一筆，日期 + 標題 + 做了什麼 + 怎麼驗證的 + 已知限制
2. 如果解決了「已知限制 / 待辦事項」裡的項目，打勾或刪掉那一行
3. 如果發現新的架構陷阱（像「V131 不是用 script 標籤載入」那種），
   補進「系統架構重點」，不要只留在對話紀錄裡，之後不同工具、不同視窗看不到那段對話
4. 確認 `main` 分支已經是最新、可運作的狀態才算工作結束
