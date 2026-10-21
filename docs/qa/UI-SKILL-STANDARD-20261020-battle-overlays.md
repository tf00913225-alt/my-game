# 原戰場選單：回合與倒數遮擋

Work ID UI-SKILL-STANDARD-20261020 / PR #955。來源0b84cc6e原forest隔離API fixture，真技能/背包開關各一360 profile，自然20→19，但兩實圖正式回合字被選單蓋住；complete只採集完成，不是視覺通過。原資料/圖及scope計畫保存 battle-overlay-round-source。

根源：原syncTurnTimerWithBattlePickers依原show切換row class，原CSS只把倒數牌移到選單上方，獨立回合仍留center。只修原fixed-slot樣式：父層依原class設定單一overlay-bottom，原row與獨立indicator共用；不搬DOM，避免獨立標籤繼承自動/resolve時的row隱藏。回合與倒數投影同一現有鐵牌，牌寬112→180native，倒數靠左、回合原absolute left68，避免文字裸落在敵方姓名HUD上；高度64/font26/tick1.55/原DOM與所有JS不變。不新增旗標或控制Owner。

4 targeted tests通過。待驗：修後各選單四尺寸真開關/真跨秒/回合文字無遮、原提示及返回、三方實圖審核、CI/部署。未驗filled/locked/非空狀態、技能/物品使用、auto/resolve/勝敗/波次/真地圖點怪/硬體。主五指令材質尚待後續打磨，不把本定位修正當整體美術完成。

美術審核實看0b84原skill/item圖補充：技能原牌y121–177已壓到敵方姓名HUD，不能直接在此處加寬。ef428785僅來源checkpoint，未作修後批准；施工同段接著把skill-only共享底距增加原牌高度與24px保留，移往敵名上方空帶。item原上方安全位置不變。這是待四尺寸實驗的最小定位方案，不能因公式或程式通過就批准；若任何尺寸仍碰撞即停並保留失敗圖。
