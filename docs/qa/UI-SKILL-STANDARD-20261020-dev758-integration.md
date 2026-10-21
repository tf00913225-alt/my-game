# 最新dev相關介面相依：來源整合checkpoint

Work ID UI-SKILL-STANDARD-20261020 / PR #955。正常merge父UI 246815098b6d278355d944c107003ce49c933fef，dev 758fe75cbdfe66a80a11a36b339fcbc7b6e21126。不是dev→main，不修改Chrome根因分支。

相依：#958新戰場portrait/敵腳下狀態/inspection/touch，#975既有recovery，#979原普通攻擊airshot。190至758未新增技能配置/skillcore/loadout/firebase Client authority變更；後續戰鬥畫面應沿最新正式Owner，不重做其工程。

手寫唯衝突fixedslot：保dev新54.785/12/45.215 tracks、turn20/bottom24與動態center minimum公式；保本UI已驗88px targetprompt及skill/itemmenu字/按鈕/位置成果。新min公式參數化保文字空間，未用降低字級解衝突。36項獨立三方source重建一致，另46 staged新增/修改檔逐byte等工作檔，無unmerged/markers；35原CSS/JS17/26/31/41/42/59保UI，上游獨有functions/builder/touch/VFX等保dev。

生成policy僅source digest：原正式build/sync前後除digest語義與UI/dev兩端皆逐結構相同，combatRulesReady/outcomeVerified/rewardEligible/creditedToCharacter仍false，無schema/權限/存檔/安全降級。生成bundle/manifest衝突由合併來源及原LF-normalizing builder重建，未選整份ours/theirs覆蓋。build/check通過。

最小回歸：fixedslot/battle-status-info/battle-ui-status-vfx/touch/normal-airshot共17通過；skill-progression-core-parity600案例＋training modal static契約＋v17344共3通過。原最小VM有document-null初始化診斷（已知非真Browser），不可稱瀏覽器無錯；training內建modal Browser未配置exe而skip，未算Browser通過。未重跑SDK/Cloud/全玩法矩陣，最新必要Actions仍待新Head。

目前只來源整合審核通過；新merge Head實際依賴smoke及targetprompt衝突實畫/獨立審核仍待完成。先訓練原list真touch/nativewheel代表裝置；戰鬥提示如不能沿原自然計時/正式安全fixture取得就明列未驗，不凍結timer、不繞protected guard。舊各段四尺寸證據綁原source，不冒稱新Head全UI重驗。

完整來源/政策/獨立審核見evidence/dev758-dependency-merge-source。尚未合併dev、部署或宣稱全UI/所有標題完成。
