# 技能配置600案例相依：已驗中文DOM預期同步

Work UI-SKILL-STANDARD-20261020 / PR955。89ec CI39503981510/a1，Session job118909111934 test749 full-runtime digest不符，沒有拿舊CI或入口畫面當成通過。

依正式600案例收集器在獨立fresh Node VM分別讀dev190d249e及UI89ec4b16 Git快照，重現原a2c2fbb876…與UI f7a048648d…摘要。逐例比對600組result/loadouts/configs及save/update/render事件全部相同；僅400組allSkillsList子DOM因第25段已獨立驗收的技能中文顯示文字不同。按原25段四literal白名單逆替後，600組完整列（包含所有DOM、資料、事件）逐字完全一致；其中三片各出現200次，barrier片此矩陣未出現，不宣稱覆蓋。

因此只同步fullRuntime預期DOM摘要並附原摘要/來源/證據。原sourceHead、全部凍結原函式、learningPolicy摘要、600案例與所有斷言保留；測試名稱改為accepted UI DOM以免誤稱原DOM。不是移除DOM檢查、忽略文字、更新政策或更改玩法。獨立scope審核通過，相關test檔7項全通過。相同VM初始化null-DOM警訊保留，非聲稱真瀏覽器無錯或執行完整SDK/emulator。

兩份完整600輸出以gzip無損保存並回解比對SHA，另保留收集器、差異分類/原literal證據及獨立審核，路徑evidence/UI-SKILL-STANDARD-20261020/skill-parity-ui-copy-dependency。此為新Head必要CI的阻塞修正；Latest Head Required CI仍須另等，Chrome啟動根因維持獨立Owner，沒有改其程式或重跑全玩法矩陣。
