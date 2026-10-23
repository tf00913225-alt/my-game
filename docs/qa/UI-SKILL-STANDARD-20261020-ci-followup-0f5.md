# 0f5 同Head必要失敗最小分流

Work ID UI-SKILL-STANDARD-20261020 / PR955。來源 [CI39898619157/a1](https://github.com/tf00913225-alt/my-game/actions/runs/39898619157)，Head0f5fee0a9a0449b1ee8ece74ec62530214518198。未將所有失敗歸Chrome。

1. core120235642320的battle-patrol-ui-targeting:30仍綁原skill-picker +8px及獨立bottom寫法。僅同步至已經四尺寸實圖驗證的原skill完整共享公式（command+offset+row-height+24）、item完整公式及兩者消費同一變數/opacity1，其他舊斷言保留。沒有放寬幾何門檻或產品CSS修改。
2. Abyss120235642369（Boss120235642475同類）的ERR_INVALID_URL獨立日誌核對為tests/monster-balance-owner-phase2d:104，經scripts/monster-balance-shadow-matrix取v170 shared fixture。URL已有native constructor，但document缺baseURI。只補隔離fixture的https://qa.invalid/game/，原URL解析回歸改讀document.baseURI，產品URL與所有結算檢查不改。原battle-patrol+monster-phase2d共13tests通過（含真失敗的正式Abyss入口），v17041cases通過；不重跑高成本全矩陣。原minimal-DOM初始化null-textContent及原負向watchdog診斷透明保留。
3. battle120235642254 far-row artwork height斷言仍未解：原run-fixed-slot-browser403保持>99門檻，不憑timer/footer猜改layout，也不以新浮字修復作背書。下一步需實際同snapshot幾何/畫面與原座標Owner判因。
4. Adventure120235642390 formal manual turn/guide timeout不歸Chrome。#984即時open未合併，Headbfca39bac1dd2b7b4f27e6e54325566e96b20272；已核其runtime三處將element改正式getPartyCharacterKey(0)，及native element分類guide差異。本線保留原character-modal/skill-tab呈現修復，不複製未合併故事邏輯或新增Auth修復。由故事Owner先完成，後續依實際整合差異驗證。
5. ui_browser120235642304明確Chrome startup ECONNREFUSED9858，仍由#976原Owner；不在本線修改工具、期限或盲重跑。

#983精確8938 delta已整合於其ebba3ee4。已讀並保存 [自然回歸原JSON](evidence/UI-SKILL-STANDARD-20261020/ci-followup-0f5/vfx983-natural-limited.json)：桌面Chrome412×915模擬、隔離6v6、自然首回合→回合2、無QA暫停；設定開隱藏技能字/火效/三浮字，關恢復，限定實圖獨審通過。不再等待同一交叉驗收，不稱實體手機、全部技能或完整矩陣通過。原本線360/1280純浮字呈現證據仍各守範圍。

新Head必要CI仍待，不以0f5失敗或舊綠燈替代；本段只改測試相依/證據，沒有改Modal/浮字/VFX、時間、數值或結算。far-row、未合併#984及Chrome必要Gate仍阻止合併部署；沒有需使用者決策或權限的事項。

## far-row單尺寸直接取證

在0a102556來源（產品仍同0f5，僅上述test-only修正）執行一次原runner的412×915靜態fixture診斷：只限此尺寸，原所有斷言保持、403前額外保存實測JSON；結果原Gate依舊failure，不是PASS。canvasScale0.98095238、farArt.height90.08362screen px，除scale及.94投影後97.69448logical px，確實未達原>99；center160.87619screen、action154.99048screen。原始資料、原圖、診斷來源與log見 [failed geometry evidence](evidence/UI-SKILL-STANDARD-20261020/far-row-0a102556-diagnostic)。

只證明幾何失敗可重現，尚未證實因果來源。不得把它歸Chrome、放寬>99、任意改tracks或縮字；下一步需原座標Owner的單因子證據才能修。沒有修改fixed-slot CSS、manual-turn-arrow、JS54；箭頭/技能名由#983負責，與本far-row調查分開。這是靜態geometry fixture，不是自然戰鬥驗收或最新Head CI通過證據。
