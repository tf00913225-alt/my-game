# 吸收 dev190 技能配置相依（非新增雲端工程）

PR955 / UI-SKILL-STANDARD-20261020。先保存32B checkpoint636b1119，正常合併已merge之dev190d249ed2dc56b73fac1e50d65e1b794d703645（#974）。沒有rebase/force，也未導入未合併#977。

核對SYSTEM相關技能Owner、canonical recovery/registry新契約及直接Client/loader差異：同一skill-progression-core在app-shell/main之前載入；retained v1的原equip/remove/跨修與v136決策委派純core，原Client render/save lifecycle保留。protected writer/窄configuration reader與canonical v2由上游獨占，沒有自動UI/Boot hydrate或authority啟用。UI線不修改其規則、資源或CloudAPI。

手寫來源自動三方合併，衝突僅manifest/hashbundle、2份generatedpolicy摘要、index原critical生成區。原builder重生並check通過。獨立scope三blob重建js00/js60skill/bottomnav逐byte等於staged；css49/53/31與5adventure來源等UI HEAD，13個incoming functions/firebase/scripts來源及core/builder等dev。js52保留既有UI錯誤交接及文案，不誤稱等dev。restricted除sourceDigests、plain除compatibilityDigests後完整物件等dev；index除critical生成區等UI原HTML。原hero/busy/skill中文及scroll修復保留，proof附檔。

focused V1379、V17041、hero-roster5、adventure-scroll2及build/check通過。V170原minimal-VM nulltextContent診斷仍如實保留，不是實際Browser無錯驗收；不在UI跨修。未本機重跑上游SDK/600golden/48技能詳情/共同完整矩陣。合併快照仍須最新Head Actions；最小實際技能入口與新依賴載入確認另保存，不把先前Head畫面換標成新Head驗過。上游#974已部署/SDK證據只作其層次，不等於UI本工作的部署驗收。

## 最小新依賴實畫確認

5e306322固定clean Head在360×640及1280×800各原角色入口→技能TAB、首屏/一次真捲4PNG，三獨立審核皆看4圖並限定通過。正式core.getLoadoutRulesForVersion為function/rules有效，真水系12列、skillPage block且非0rect；原characterTabContent auto，真touch0→1272/nativewheel0→764，TAB到正文6/7.5screen px。可見控件最小44/55，當前boot b447與criticalCSS1a331皆實收200，全部記錄JS/CSS無非200/304。raw/meta/actors/inventory/loadouts五精確還原；baseline在startup+skillensure後、PREPARE seed前，不稱初始所有私有cache還原。

證據skill-entry-dependency-5e306322；只新dependency入口與一次捲動，不重做48詳情、末端或技能學習/裝移除/自動設定/實機/Cloud權威。舊段證據仍綁其原Head，不換標。
