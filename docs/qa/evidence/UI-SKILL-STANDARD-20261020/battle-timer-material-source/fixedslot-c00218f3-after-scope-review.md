# fixedslot c00218f3 限定實畫/範圍審核

實看 natural-entry-qualified 四尺寸360x640/393x873/412x915/1280x800各battle-hud與battle-target-prompt，共8張。倒數完整、只一處常駐回合字樣；普通攻擊提示與返回完整，未見其蓋住我方名稱/HP/SP；未見此子集因中心minimum提高造成敵我HUD相撞。這是限定畫面觀察，不批准尚未展示的狀態。

四份report complete/clean/sourceUnchanged true，Head一致c00218f3。原入口為正式森林catalogue＋原startBattle(0) API fixture，並非真地圖怪物點擊。真輸入普通攻擊僅開目標提示、原返回取消；無選敵、攻擊或結算。倒數Range在所錄row內，原26字級/1.55動畫保留；來源僅固定格位CSS行高64、獨立indicator置中及隱藏舊重複文字，原JS生命週期未動。test精確minimum例外保安全下限/總預算，未任意放寬。未發現此純UI子段過修或遊戲邏輯改動。

另獨立比對宣告baseline與final：actors/gold/inventory/equipment/monsters/battleToken/turn/auto設定/元素匣相同。save/raw/meta觀測保留於原report，不把原啟動或戰鬥入口副作用冒稱零存檔；不聲稱runtime exact還原，依owned Chrome/profile拆除結束隔離。

可接受本次手動自然宣告HUD、普通攻擊提示與取消子集。技能/物品overlay、auto、resolution、實際傷害/勝敗/逃脫/結算/獎勵、波次、全陣容與真硬體均未驗；Required CI/部署另依新Head證據。舊knownHudReview文字是歷史診斷，不以其當修後批准。未啟動Chrome、未改tracked。
