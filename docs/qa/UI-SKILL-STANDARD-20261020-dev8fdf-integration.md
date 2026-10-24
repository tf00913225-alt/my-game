# dev8fdf 最小正常整合

Work ID UI-SKILL-STANDARD-20261020；#955 原分支；UI parent d0053d95、dev parent 8fdf52af。原Owner交接完成後正常merge，沒有rebase、force、吸收未交付991/989或更改其他工作樹。

## 保留與解衝突

正式dev compact footer、24px turn、46px prompt、party same-depth/paint frame保留；舊64px turn/88px prompt與far ally補償不帶回。原skillQuickBar16px名稱/cost/scope、56px圖、52px返回及原grid保留於同一CSS來源，無新wrapper/Owner。實畫發現原dev倒數位置壓第4技能名；只改原skill-picker-open規則，依原command-row/188px picker offset將同一枚倒數置header返回左。不改計時、攻擊、技能或party幾何。第一定位嘗試倒數未可見，保存INVALID探索圖，不當修好；最後四尺寸實圖才批准。

Story保留getPartyCharacterKey(0)與955原角色modal→skill tab/返回契約。原Owner確認只同步VM modal doubles及入口順序斷言，保所有readiness/角色/資源/receipt斷言。未吸收991新教學。

安全tests保留dev退役技能契約及immutable歷史fixture。直接回歸起初600hash失敗；用原記錄工具逐列證明600domain/save/event零差，只有400筆已驗中文顯示文字不同，精確逆轉原4對文案後全部row byte-equal。新增整合raw hash與provenance，同時deepEqual raw新hash與只DOM欄位逆轉後的原retiredStormRuntime；沒有覆寫舊fullRuntime/retiredStormRuntime或跳過斷言。原helper默認仍raw，mapping不碰領域/事件。P4及獨立scope均限定確認，並非啟用server battle。

所有生成manifest/bundle/index hash由原builder重建。兩份generated policy僅更新來源追蹤metadata：normal-attack的compatibilityDigests與restricted-forest的sourceDigests，其餘政策內容與dev完全一致。js60相對dev包含955既有四項說明文字及技能元素中文標籤顯示，本輪未修改該來源；600row的實際差異僅需四對文案逆轉。

## 驗證與證據

[耐久證據](evidence/UI-SKILL-STANDARD-20261020/dev8fdf-integration/)含四尺寸before/after、兩份600row gzip、來源hash、probe、75項直接回歸log、三類獨審。build/check、diffcheck通過，unmerged已清空。

四尺寸360/393/412/1280：原隔離主城角色入口→技能tab→原scroll owner真觸控/桌面wheel；正式新戰場合成noRewards單目標靜態呈現，真開關技能picker，滿四格與不足SP。最終full/不足SP8圖倒數20清楚可見於header，4技能全文及返回未重疊；六次input hit/指定五項restore逐size通過。圖綁parent+未提交來源hash，不能拿純d0053d95當修後commit。停止timer只為靜態呈現，沒有施放/攻擊/結算或自然計時驗收；私有cache/進場瞬態不宣稱exact還原，非硬體證據。

原js01滑鼠Owner、css00 toast等既有成果保留，不重跑有效完整玩法矩陣。全介面台帳未列證狀態仍待完成。本段正常push後取得最新Head必要CI，CI待完成/失敗不得當通過；不造空提交、不手動rerun/cancel。排程955仍PAUSED，尚未合併dev/部署/main發布。
