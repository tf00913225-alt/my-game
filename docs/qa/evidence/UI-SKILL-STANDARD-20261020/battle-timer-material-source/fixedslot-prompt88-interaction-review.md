# c00218f3 fixed-slot prompt88：獨立互動審核

限定通過。實看四尺寸全部12張 HUD／目標提示／取消後 PNG，並讀四份 report，來源 artifacts/ui-skill-standard/fixedslot-prompt88-c00218f3/natural-entry-qualified/{360x640,393x873,412x915,1280x800}。完整Head c00218f35ad45abe96ea52aad741b1b9f3e94d78；complete/clean/sourceUnchanged/profileRemoved 全 true。

實際圖中只剩中央一個「第1回合」，舊左側回合文字未重複；左側倒數20在各動畫量測時點均完整落在新回合列內，未見上下裁字。怪物與我方姓名／HP條可見，提示牌完整，不壓回合列或截斷提示兩行；取消後正式主命令列恢復。普通攻擊與返回均為真輸入，不曾點敵人。

每尺寸五次入口與戰鬥UI輸入全 EFP=true。普通攻擊高60/65.5/68.67/75screen，提示返回44.57/48.66/51.01/55.71screen；皆寬高>=44。88native提示投影75.43/82.34/86.32/94.29screen，原min公式與新軌道均記錄在report。timer獨立Range在實際 overflow hidden/clip 祖先內，唯一可見回合標籤count1。文字ownline overflow:visible不當成裁切；兩行font Range含ascender/descender區的約1.7px交疊仍保留作診斷，實畫兩行清楚，不能把Range整個字體度量框當實際油墨相撞。

正式原forest catalogue產怪，原startBattle(0)API隔離fixture（不是地圖點怪流程驗收）。入場 preparing/moving皆清、實際overlay陣列空後才啟取圖。四case HUD至取消後耗時685/787/670/618ms，原timer仍20、turn1/declare/token1；不到一秒故未觀測倒數跨秒，不宣稱倒數完整生命週期已驗。未凍時計、未clearInterval、未改config/stats。每phase HP/SP/level、gold/inventory/equipment/monsterHP保護域相等；raw/meta由declare至final相同，save委派觀測0、Network非GET請求0。原日志選擇器本次為null，不能聲稱完整battlelog已檢查；沒有資源或HP變化／轉結算證據。

開戰本身battleActive/token/cooldown等原效果保留，不宣稱零戰鬥副作用。未做結算／獎勵／escape；最後僅銷毀自有隔離Chrome及profile，runtimeRestoreExact=false如實。未驗自然timeout/後續回合/施放/攻擊結果/勝敗發獎/多種party與怪物版型/實機。戰場整體美術仍由art另審；本結論不能取代其它overlay開關驗證。未啟Chrome、未改tracked。
