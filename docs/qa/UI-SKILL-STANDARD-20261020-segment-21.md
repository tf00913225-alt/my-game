# 第二十一段：自動設定真選單與取消

Work ID UI-SKILL-STANDARD-20261020；PR #955；最終UI 0584b5d066e5d2a5a34d1bc1b360cf5372246ca2。第20物品helper另已準備，未啟Chrome；第19保存後先處理本段，編號保留。

44cb實際完整homeFeature首屏發現返回38px，原49只Auto的header-height44；af1真custom portal再發現選項36～36.5px，文字13。實際parent auto-premium-dropdown-list、bundle與font13核對正式Owner是css26:223（css00僅fallback，最初歸屬已更正），只該Auto選項min44/font15；原選單皮膚/字色/selected保留，不改其它下拉。正式build/check與v169-element-box-settings、v173.4-element-box-gold兩個既有focused檔通過。

最早QA以為native select可見，實際被原initCustomDropdown隱藏，該接線錯排除，改真custom label/item，不加role。量測涵完整header、div portal options與glyph，不只button。

原active getter fixture並非純UI：被js45 isElementBoxRecoveryActive與每秒finishAutoRecovery消費，觸補品/浮層/save，遮住原鎖定alert。該resolved2整批/8calls不批准，污染實圖與report僅EXCLUDED追溯，不修production或降guard。normal-only用全新profile重驗，完全不建立active getter；activeguard仍未驗。

四尺寸360×640、393×873、412×915、1280×800，各9圖12真tap。真可見city5，custom HP50→75/SP25→50，背後nativeValue僅記真select值，不代表操作隱藏native。全隊共享config、角色0→1與返回重開的75/50均assert，第三角色尚未建立長文自然換行。時數0且inactive/battlefalse，原套用→補充確認只取消，末hours0/activefalse/battlefalse。所有選項44以上、五項100%與首尾完整，原對話框文案完整。原saveGame delegate不攔，每尺寸7次及configs/storage前後如實保存，不宣稱零存檔。來源/bundle hash前後一致、clean、全部Chrome退出，三方實圖限定接受。

證據evidence/UI-SKILL-STANDARD-20261020/segment21-accepted；before只有360且含正確partial/失敗標記，不冒充四尺寸before。未重做已驗空間/策略等內容。限制：activeguard/真啟動/停止/剩餘時數>0套用/廣告/加時未驗；真帳號/雲端權威/實體裝置/軟鍵盤未驗；回城toggle與其他策略選項未在本段實際切換，既有呈現證據保留；真入口是可見city5；training是否有獨立入口只記availability，未冒稱已驗。未合併/部署/全UI完成。

CI：0584 CI39417186207 queued、Session Authority39417186140 in_progress為本段最後讀取，不當成功；後續checkpoint須核Latest Head。Next：第20背包真材料/材料箱/裝備箱詳情、來源/預覽/返回；再剩餘主城/戰鬥/帳號讀檔提示台帳。
