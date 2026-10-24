# 桌機滑鼠拖捲與全介面捲動審核 checkpoint

Work ID：UI-SKILL-STANDARD-20261020；原Branch／PR955；本段base4f971647f0c4d414b247b9253125b1766823fb01。使用者明確授權最小滑鼠方案與所有介面／頁面／TAB審核，僅合成資料、獨審與checkpoint；不恢復排程或其他全面施工。

## 最小產品變更

唯一產品來源js/01-stage-v8-touch-lock.js。原10px CSS-client門檻、click抑制與computed scroll Owner保留；mouse左鍵跨門檻後依主方向尋找最近可捲Owner，x/y鎖定，使用原FourSymbolsDisplay.clientToSurface換算native／legacy／browser，不複製scale公式。原生滾輪、手機touch pan與鍵盤detail0不改。超出內容範圍正常clamp，短按與下一次獨立操作保留。

編隊[data-drag-owner]、既有#battleElementBoxButton、#v141TaskTracker仍由原拖曳Owner處理。input／textarea／select／contenteditable／slider、canvas與.status-btn長按保留原操作，不當拖捲起點；可由旁邊內容拖捲。沒有修改能力值、獎勵、交易、存檔、帳號或教學入口。js00／20／35、CSS、showPage、角色modal與skill入口未動；app-shell與兩asset-manifest由原builder同步。

## 防誤觸與原Owner收斂

捕獲僅跨10px後才開始，原互動目標保留至release，拖後click沿原arbiter抑制。up/cancel/lostcapture、buttons遺失、目標移除、blur/resize與surface卸載均處理；pointerup不在passive listener內呼叫preventDefault。

獨審要求的合成順序確實先重現誤activation，未把它當已通過：connected surface unregister後release、unregister→resize→release、解除註冊後仍按住超過1秒，以及active blur後長按才release。修正統一留在同一arbiter：退休手勢只在原目標留guard，等待真正pointerup/cancel後才開始原1秒完成期限；新pointerdown／舊click／期限到清理，pagehide清理。鍵盤detail0放行，沒有document-wide click攔截、第二scroll helper或永久patch。

## 實際驗證與限制

- 新永久tests/desktop-mouse-scroll-browser.test.mjs與純合成fixture：本機32案例（含1個原來源不支援mouse pan的修前對照；修後31安全案例）PASS。涵蓋1／0.5投影、橫／縱與nested方向、兩端clamp、9px短點、真wheel、鍵盤、專用控制隔離、捕獲失敗、取消／移除／resize／blur、卸載與長hold、防誤領取、原生touch pan。Runtime exception及passive warning收集均空。合成按鈕只有claims計數器，不發放遊戲獎勵或使用真帳號。
- 原battle-touch-gesture-lifecycle、v173.2-mobile-touch-scroll、touch-scroll-navigation-convergence三suite PASS，保留既有touch／pinch／detached HUD／click過期／多指安全證據。手機硬體、長按系統選單與雙指實機未驗，不能以模擬代替。
- 原隔離runtime巡檢43個page／feature／TAB情境，32個實際溢出容器用真mouse pointer拖動，fixture inventory/gold不變。任務daily／commission含x寶箱與y任務清單；角色exp/status/skill、商店兩TAB、英雄五filter、合成三TAB、冶煉兩TAB及各主要page均留下記錄／畫面。此巡檢早於最終取消／卸載保護修訂，ordinary pan來源不變；最終取消保護以32案例覆蓋，沒有假稱43情境完整重播最終source。
- 第一輪TAB節點隨render失效的漏驗已排除，以正式TAB文字重新查找補拍；未知／loading／hidden不充當PASS。秘寶目前僅loading、map/adventure未完整初始化、部分空資料無溢出，不能批准其owned/detail／劇情操作。沒有觸發購買、領獎、套用或實際戰鬥。
- syntax、production build／--check、diffcheck PASS。新.mjs由原ci.mjs的.test.(js|cjs|mjs)收集，無新增workflow或略過必要CI。Latest Head必要CI仍待正常push結果。

## 所有介面清單

既有261項逐筆納入新審核索引，保留原入口、Owner、已完成status、states與舊證據，分成24群組（逐筆JSON計算，非先前摘要25）。新索引是[desktop-scroll-audit.json](UI-SKILL-STANDARD-20261020-desktop-scroll-audit.json)；不能把源碼盤點或群組代表情境當261項所有狀態通過。

| 群組 | 本次審核重點／保留界線 |
|---|---|
| baseline、character、detail | 原character viewport／個別detail scroller；技能基準保留、能力長按不搶走 |
| home、utility | 原主城與feature viewport；短內容不強造捲動 |
| inventory、item、preview | 原inventoryGridScroll、item body、comparison／preview內容；不改交易 |
| shop、forge、synthesis | 既有清單／選材x／規則y；空資料與pending/套用仍逐狀態列未驗 |
| quest | daily／commission縱列與完成寶箱橫列；10px後不誤觸 |
| hero | overview/filter/content；編隊原drag Owner優先 |
| relic | list/detail/growth／x tabs；目前loading證據不當owned驗收 |
| auto | settings/dropdown scroller；不套用設定或動元素匣業務 |
| page、training、dungeon、boss、gameplay | 原page computed scrollers；空／未解鎖／動態狀態明列 |
| battle | registered HUD/list/detail；專用拖放與自然戰鬥未替代驗收 |
| creation、startup、shared | editable排除；browser/auth/privacy邊界保留原生行為，未無差別接管document |

## 獨立審核與剩餘

Input /root/map_input_review先指出實際時序風險，根端重現並修後複審32案例與來源，窄範圍無直接安全阻塞。Art /root/map_review實看修前後合成橫列及正式任務／技能／商店／背包代表圖：外框、固定header/footer與素材無新增破損；捲動邊界半張內容不能單張證永久遮蔽或全部可達。Scope /root/daily_scope核對原app-shell反向來源byte一致，僅js01及正常builder變動；261項原狀態／states保留，無Story／reward／save改動。

耐久證據：evidence/UI-SKILL-STANDARD-20261020/desktop-scroll/。剩餘：261項逐狀態補證、秘寶owned/detail/full資料、未初始化map/adventure、自然戰鬥拖放、browser auth/privacy與實機；不稱所有UI已完成。任務Gate／最新Head CI／部署未完成，不合併，不main/rebase/force。排程955維持PAUSED。下一步依新Head首錯與原台帳分段，不跨線修工具／Story，也不順帶實作新版教學。
