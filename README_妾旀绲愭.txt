V121_SPLIT — 第一階段「安全拆檔」版

【母版】
V120

【為什麼這一版不是把全部 JavaScript 合成單一 game.js？】
完整檢查 V120 後確認：原檔有 21 個真正獨立的 <script> 區塊。
這些區塊包含多年累積的 migration / runtime patch。
若現在直接合成一支 game.js：
1. 一個前段 runtime 發生例外，可能讓後面所有 patch 都停止執行。
2. top-level let / const 的初始化時機會改變。
3. 原本分開 script 的執行邊界會消失。
這會違反「拆檔不改舊系統」的原則。

因此 V121_SPLIT 第一階段採：
- HTML 外部化
- CSS 外部化，但每個原 style 區塊保留原順序與原位置
- JavaScript 外部化，但 21 個原 script 區塊仍維持獨立、同步、原順序
- 圖片全部外部化
等 Android Chrome 實機確認後，再進第二階段真正整理/合併 JS 架構。

【目錄】
index.html
css/                    27 個 CSS 區塊，依 00、01、02... 原順序載入
js/                     21 個 JS 區塊，依 00、01、02... 原順序載入
assets/ui/
assets/skills/
assets/battle/
assets/characters/
assets/maps/
assets/ASSET_MAP.txt

【沒有修改】
- 技能數值
- 戰鬥公式
- 能力值公式
- DOM ID
- JavaScript 函式名稱
- localStorage / 存檔 Key
- 頁面切換機制
- Android Chrome touch / scroll / GPU 修正

【重要】
不能只拿 index.html。
index.html、css、js、assets 必須整包放在一起，資料夾名稱與相對位置不要改。

【GitHub Pages】
把 V121_SPLIT 內的所有內容一起放到 Repository 根目錄：
index.html
css/
js/
assets/

GitHub Pages 仍只開 index.html。

【之後新增圖片】
不要再轉 Base64 塞進 HTML。
直接放到 assets 對應資料夾，例如：
assets/ui/new-button.png
assets/skills/new-skill.png

【第二階段】
先用 Android Chrome 實機驗證：
主城、角色、背包、任務、商店、巡怪、地圖背包、自動巡怪、自動戰鬥、戰鬥、技能、存檔重開。
確認 V121_SPLIT 與 V120 行為一致後，才開始整理為真正的 data.js / inventory.js / skill.js / battle.js 等模組。
