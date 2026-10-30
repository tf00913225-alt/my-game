# 背包標題驗證範圍

來源：dev 871daa07，原始畫面來自自然 CI run 41054891815 artifact 12976887152。此目錄 before-runtime 圖是原版本；populated-backpack 圖是本分支建置後正式 runtime、合成帳號及合成資料的畫面。

執行既有 run-responsive-item-browser-qa.mjs 的暫存變體：RESPONSIVE_GENERAL_UI_ONLY=1；DISPLAY_VIEWPORTS 限為 360x800、393x873、412x915、1366x768，桌面使用非 mobile；其餘分支中的固定 viewport 檢查仍依程式執行。原腳本輸出固定字串「fourteen viewports」，不代表本次測了十四個 DISPLAY_VIEWPORTS。暫存變體保存在 runtime-qa-variant.mjs.txt，執行前須放回 .github/scripts 並使用合成 stub；evidence.json 為此次執行結果。

backpack-*.png 是原 visual fixture 的合成畫面。該 fixture 缺正式 character-panel 等容器，故下方文字重疊不代表正式 runtime。非作者已對照四張正式 runtime 圖及 before-runtime 圖，確認固定標題視覺置中、英文與關閉按鈕不重疊。未驗放大字、其他頁面、空資料及真機；獨立審核僅限靜態畫面。

追加驗證：四尺寸以合成資料點擊背包關閉、檢查隱藏、再開啟，並斷言中文標題中心與標題列中心差距小於 1 CSS px；backpack-closed / backpack-reopened 為操作後畫面。

16 字合成名稱補修：四種視窗以正式 runtime 測量名稱無裁切、等級不重疊、三完整物品列；非作者實看四張前後畫面。第一次候選第三列部分遮擋，已調整並複驗；證據為 before-long-name 與 candidate-long-name。角色切換、長名稱下捲動與鍵盤、空資料及真機仍未驗。測試腳本固定顯示 fourteen viewports，但實際 DISPLAY_VIEWPORTS 為四。

長名稱操作補驗：合成 runtime 的 360x800、1366x768 中，滑鼠下一角色及滑鼠返回可操作，物品格滾輪可捲至末端；合成 Enter 事件未能切回，根因未確定，不視為鍵盤通過。記錄精確 QA 變體和畫面。

Enter 診斷：先前 CDP 只送 rawKeyDown/keyUp，補送 Enter char 後，360x800 與 1366x768 的合成事件均成功切回長名稱；不是已證實遊戲 Enter 無效。診斷輸出亦顯示切換重繪後 activeElement 為 BODY，焦點保留與連續鍵盤操作仍需評估，真機仍未驗。先前失敗測試的 QA 變體及 JSON 保留；兩張 keyboard-return 圖已更新為診斷後的成功畫面。

焦點遺失根因：實際 runtime 的 renderInventoryCharacterTabs 由 js/35-v141-ui-battle.js 覆寫，直接重建按鈕，焦點落至 BODY；原 js/00 定義不是生效 Owner。已在實際 Owner 保留原聚焦箭頭，合成 360x800 與 1366x768 實測 Enter 切換後焦點仍在箭頭，第二次 Enter 可繼續切換；焦點及畫面證據附檔。真機、其他鍵與完整輔助技術未驗。

角色切換箭頭觸控補修：360x800 實際繪製尺寸由 44x38 調整為 44x44 CSS px，桌面約 52.8x52.8；360x800 合成觸控點選下一角色、1366x768 滑鼠點選，以及兩尺寸連續 Enter、長名及三完整物品列均通過，非作者實看兩尺寸畫面與直接 diff。這是模擬觸控，非實機；其他尺寸、空資料、字體放大及其他鍵未驗。

空背包：正式 runtime 的合成空資料在 360x800 與 1366x768 實際點擊裝備、物品、材料、功能四分類，並確認無填入物品及頁籤、關閉和底部操作可見。獨立審看八張畫面無明顯遮擋；空格只有暗框與小點，沒有明確空資料文字，列為待處理。未實際執行整理或售出，真機和字體放大未驗。

空分類提示補修：實際 js/35 背包 renderer 依頁面資料為空加入 role=status 訊息，分類完全空顯示『此分類沒有物品』，分類有物品但此頁無物品顯示『此頁沒有物品』；不修改物品資料。合成 360x800、1366x768 四分類切換檢查提示與已填入分類不出提示，非作者審看八圖。空頁提示分支尚無實畫、真機及放大字未驗。
