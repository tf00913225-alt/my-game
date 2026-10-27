# 正常吸收 dev102（非新增工程）

PR955 / UI-SKILL-STANDARD-20261020。前UI checkpoint ecb4e900；Base由b153e3f0吸收到102cfe2e3dc7b3bac5706444733e90a4c9ea18b7。新增為已合併#941 VFX與#978 foreground Chrome profile清理，不導入尚未合併#977章節修復，也不修改Chrome根因線。

手寫來源自動三方合併，僅manifest及hash命名bundle rename衝突。從完整合併來源production build/check重新生成，退場僅unmerged舊生成檔；非選任一舊bundle。獨立scope用git merge-file重建css40/fixedslot/js60/js54，四檔逐byte等於staged；UI css49/53/31、js00及5個adventure來源逐byte保留前Head，proof附檔。新的VFX呈現依上游Owner，這裡不額外宣稱新VFX實畫驗收。

合併focused：status-info6、status-vfx-followup7、chapter story19、adventure scroll2、relic VFX contracts通過，production build/check通過。relic-target-hud-focus原測試需要實際Chrome，直接node未提供executable而在findChrome前退出，未執行/不算通過；不是產品回歸，也未盲目重跑上游完整VFX矩陣。最新合併Head Required CI仍須由Actions給證據，舊CI不能背書。此前30/31實圖維持來源快照/子範圍，不改標成新Head跑過。
