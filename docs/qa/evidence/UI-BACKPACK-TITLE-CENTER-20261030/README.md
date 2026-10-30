# 背包標題驗證範圍

來源：dev 871daa07，原始畫面來自自然 CI run 41054891815 artifact 12976887152。此目錄 before-runtime 圖是原版本；populated-backpack 圖是本分支建置後正式 runtime、合成帳號及合成資料的畫面。

執行既有 run-responsive-item-browser-qa.mjs 的暫存變體：RESPONSIVE_GENERAL_UI_ONLY=1；DISPLAY_VIEWPORTS 限為 360x800、393x873、412x915、1366x768，桌面使用非 mobile；其餘分支中的固定 viewport 檢查仍依程式執行。原腳本輸出固定字串「fourteen viewports」，不代表本次測了十四個 DISPLAY_VIEWPORTS。暫存變體保存在 runtime-qa-variant.mjs.txt，執行前須放回 .github/scripts 並使用合成 stub；evidence.json 為此次執行結果。

backpack-*.png 是原 visual fixture 的合成畫面。該 fixture 缺正式 character-panel 等容器，故下方文字重疊不代表正式 runtime。非作者已對照四張正式 runtime 圖及 before-runtime 圖，確認固定標題視覺置中、英文與關閉按鈕不重疊。未驗放大字、其他頁面、空資料及真機；獨立審核僅限靜態畫面。
