# shared.toast / reward-result 最小安全補驗方案

重新核現行原來源：js35 showBlackGoldReward692–721 只建立/更新#v141RewardToast、show class與4200ms timeout；最終showExpToast委派同Owner。js44 128–144原document capture點擊清timer並移show。js00 showLevelUpToast25120–25155只textContent/class與2600ms timer，不改level。先前stage5 battle-final只有API呈現450ms截圖，沒有自然消失/點關/替換時序證據，僅補這些缺項，不重做物品預覽或戰鬥。

執行接線：沿原runtime-browser-support create server/Cdp與run-skill-progression PREPARE_RUNTIME；fresh profile、隔離skill-runtime-browser-qa UID、原loader完成後ensure('skill')，關原home feature到home。讀取typeof正式v141ShowBlackGoldReward/showLevelUpToast與loaded JS；不得呼叫win/lose/escape/levelUp/grant/save/claim或真雲端。參數是展示fixture，未發獎。

每尺寸序列（360/393/412/桌面串行）：
1. 以正式獎勵顯示API短EXP/金幣摘要，t0/t450及4200ms後驗show自然移除，保留performance實際時間及CSS4.15秒動畫。不可加速或手動sync。
2. 正式catalog中既有長名稱物品＋多項摘要，捕獲450ms可讀圖及末列；真touch/mouse點實際toast中心dismiss，核hit以及show移除，等待舊4200ms期限後仍hidden。若toast本身不足44或重要文字裁切則記problem，不繞gate。
3. 原API A後約500ms再B，確認同一DOM節點、B替換A（不是隊列）；A原期限到時B仍show，B4200ms自然hidden。保留時序margin但不把CSSfade尾端當故障；必要讀class＋computedopacity分別記。
4. showLevelUpToast(合法16字角色名,20)只展示，確認文字全名/末字與2600ms自然hide；不調整角色等級、不執行升級函式。

透明同task觀測：每次正式顯示API前後在同一Runtime evaluate task快照actors/gold/sharedExp/inventory/equipment/loadouts、activeUID、localStorage全值；assert exact，保存差異keys。跨await背景timer可能自然更新，僅記錄原始beforeafter差異，不凍結timer/阻save。saveGame若需spy只原this/args/return委派並finally精確還原，不抑制。全部真dismiss前後同task不能靠CDP兩次跨task證明，最小方案用原capture/bubble觀察且不能在render後重新closest丟target。

可保存圖：short-visible/short-expired、long-visible/long-dismissed、replacement-B/replacement-after-A-deadline/replacement-expired、level-visible/level-expired。sourcehash beforeafter與clean、網路loaded hash、API身份restore、UID/profile清理、原storage觀測全留。既有PREPARE seed前備份方式可沿35；若未設exact restore不要寫八項全還原，private timer與closure不claim。

不把空零值當空白狀態頁：原函式parts空直接return；無queue/loading/disabled/cancel頁面，不創造狀態。v132ShowRewardModal任意HTML不是正式resultscene，不用它造驗收；ExpDungeon成功modal是private且有claim/ad入口，沒有安全公開render boundary則留未驗。勝敗過渡/結算及P4/#958不在此scope。

實圖尚未執行，本文件只是可交root實作的helper規格；必要時從現有battle-final.mjs提取CDP/PREPARE/shot工具但不要執行其戰鬥fixture與資源seed流程。
