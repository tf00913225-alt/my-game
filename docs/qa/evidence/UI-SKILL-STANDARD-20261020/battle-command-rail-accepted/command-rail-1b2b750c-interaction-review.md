# 1b2b750c 主命令軌道：獨立互動審核

限定通過本輪材質、文字位置及原技能按下／取消／開關。四尺寸各HUD、native-pressed、restored三張，共12張實圖全部實看；讀四份report。來源 command-rail-1b2b750c/skill-rail-text-qualified/{360x640,393x873,412x915,1280x800}，完整Head以各report為準。四份complete/clean/sourceUnchanged/profileRemoved皆true。

實畫共用黑鐵雕框軌道完整，五個名稱清楚置中，各分隔線沒有壓字，框未遮人物姓名／HP資訊。按下skill時可見原指標ripple，取消後無選單；後續真skill開關後軌道恢復。只TreeWalker SHOW_TEXT非空文字Range union作文字量測，不把decorative ripple span的153–203px盒當文字溢出；原失敗與舊helpergzip保持。

五按鈕實際rect皆44+／EFP命中，true text Range完整在各button；四尺寸所有字群中心相對button中心最大偏差0.000016screen，可視為精確置中。computed rail ::before 實際素材 panel.827d9ba9a6f8.webp、115 fill、6px。報告readStyle沒有獨立保存font-size/font-family欄位，因此不捏造數值字級；本輪實畫可讀性與Range位置通過，不聲稱新增字體投影規格已量測。

對cc224同viewport、同phase menu六維rect比較最大差0；原skill實際trigger input rect六維亦通過quarterpixel Gate。舊cc224沒有五個button全部各自rect，不能聲稱其餘四個歷史逐項exact。必要摘要保存 artifacts/command-rail-1b2b750c-review-projection.json。

按下觀察：360/393/412 :active=false，只有原ripple實畫，故手機CSS:active未覆蓋；desktop :active=true，已實畫。四case取消後active=false、原click observer[]、menuOpen=false；沒假造class。原後續click只開skill且原close成功；不按normal/defend/run。

自然原timer各20→19；所有記錄維持turn1/declare/token1，原HP/SP/level/gold/inventory/equipment/monsterHP保護域一致，raw/meta相同，save委派觀測0、非GET請求0。沒有時計／數值／auto修改，未施放技能或進入結算。原開戰API副作用與runtimeRestoreExact=false、僅隔離Chrome/profile銷毀限制保留。

未驗：手機CSS:active、其它四命令實際按下／執行、非空技能／物品、使用／auto／結算／發獎、實機。此不是全戰鬥UI批准。未Chrome／產品修改。

## 同Head相關入口最小煙測追加

再實看1b2b750c的360／1280 item-open與normal-target各一張，共4圖及4report；本review累計16張實圖、8report。新skin後補品空態、題牌、返回全文可讀，回合牌不被蓋；normal提示與同牌不相碰，真返回44.57／55.71。每個case真輸入44+/EFP=true，關閉或取消成功。四report complete/clean/sourceUnchanged/profileRemoved皆true，保護域／raw／meta不變，save觀測0；item原20→19，normal不足一秒不冒稱跨秒。

這是新skin後兩裝置／兩入口煙測，沒有在本Head重驗393／412的item/normal；其它布局／JS仍沿cc224原四尺寸證據，不把兩尺寸補測擴寫成新四尺寸全驗。desktop item圖按鈕有原指標高亮，沒有影響文字／返回；未點使用、符咒或執行攻擊。原非空與業務未驗限制保留。
