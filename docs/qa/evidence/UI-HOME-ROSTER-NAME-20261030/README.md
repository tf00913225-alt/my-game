# 主城長名稱驗證

Base dev 871daa07，三名各 16 個中文字，使用既有正式 runtime 合成 QA 與空白測試帳號；沒有讀取玩家資料。before-evidence.json 的五個視窗各顯示文字 scrollWidth 720 / clientWidth 223，均截斷。before 圖與 QA 變體保留。

直接讓名稱換行的候選於 360x800 首個視窗失敗：既有檢查回報 city entrances overlap 角色 / 英雄系統。candidate-failure-360.png 與 candidate-failure-evidence.json 保留現象；此候選不得合併，也不以縮小字體或隱藏功能掩蓋。必須重新考量主城空間配置並以同類尺寸及入口操作驗證。

腳本來源為既有 responsive QA，DISPLAY_VIEWPORTS 改成 360x800、360x640、393x873、412x915、1366x768，16 字均為合成名稱。候選失敗於第一個視窗，未測其餘視窗。原腳本其他固定 viewport 檢查仍可能運行，不以固定 console 文案當作尺寸清單。

候選後續排列：角色名稱使用角色欄完整寬度，等級與 HP 同列，SP 保留；主城入口原始留白由 72 native px 調整至 16 native px，確保長名稱時入口觸控區仍分離。沒有縮小文字或按鈕。五種視窗與三名 16 字、三名短名稱分別驗證名稱完整、等級不重疊、入口幾何與 hit target；圖片由非作者實看。長名的手機 360x800 與桌面 1366x768 另以實際點擊驗證佈陣、角色與返回；非作者確認結果畫面，合成環境的佈陣同步顯示失敗，因此不能宣稱同步功能通過。六投影寬度的既有主城瀏覽器測試另加入名稱橫直向完整度斷言並通過。空資料、載入 placeholder、字體放大、其他入口實際點擊及真機未驗。測試程式的固定「fourteen viewports」輸出不代表本次 DISPLAY_VIEWPORTS 為 14。
