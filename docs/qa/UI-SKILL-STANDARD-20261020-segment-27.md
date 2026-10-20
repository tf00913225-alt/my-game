# 第27段：Boss功能卡抽屜限定驗收

Before d6e52c235760791cae581dc0b86f037b11f5e7ba／360×640六張；After3d14c8b27b7347f3929d02f50d8e965a7f0e3c4d／360×640、393×873、412×915、1280×800各六張。證據segment27-boss-observer-accepted，原報告與實際loaded資源hash保留。

## 原症狀與修改

原實畫為普通細框／靠左標題，正文與標籤在360約12／11px；關閉約32.57×30.86，警示入口因scale動畫更小；關閉重開仍停scrollTop409。末列本來完整，不另加footer或改排版。

原css/battle-statistics-system.css保留右側非阻塞抽屜，header對稱三欄、標題自身置中，入口／關閉52legacy使360至少44.57px；原pulse不再縮小命中外框，文字保留明暗提示。原內卡正文18legacy、meta16legacy並允許長文字換行。唯一共用視覺Owner CSS49把抽屜外殼與主標加入既有技能panel雕框分組，沒有新素材／全域尺度或第二套visual patch。Boss正式名稱依既有契約保留。

原JS::openBattleDrawer只在真正新開啟、render後把原body.scrollTop=0；same-open early return與更新保持閱讀位置。沒有新增timer／wrapper／pause lock。既有focused test新增原Owner初開／重開／同頁更新／guard回歸；同測試舊home overflow:hidden斷言精確同步已驗收的overflow-x:hidden／overflow-y:auto唯一主頁Owner，不放寬成任意overflow。focused及build/check通過。

## 取證邊界

正式production loader與feature-boss-relic，正式statistics.begin空combatants建立觀察session，六類資料來自原BOSS_OBJECT_DEFINITIONS；合併僅作長列表呈現fixture，不是真遭遇組合。inactive／無卡／clear guard仍拒開；真tap警示、真touch／desktop mouse-wheel捲末、關閉重開回0。每階段global battleActive=false、battle token0、timer null、正式Boss context false不變，未呼startBattle／finish或結算API。

四尺寸source hash不變、報告complete；runner開頭及結尾斷言gitclean，報告本身無獨立dirty欄，不捏造欄位。after helper以無損gzip保存；before為原取證版本，不用後改helper冒稱同版本重播。

- art_review：實看after全部24張並對比before，雕框／對稱題牌、可讀文字、末列及重開首項完整，限定通過。
- interaction_review：實看四尺寸首末／重開／guard，核最小close44.57²、alert44.57×48、正文15.43／meta13.71與真輸入、戰鬥狀態不變，限定通過。
- scope_review：實看四尺寸代表、原Owner diff與四報告，修改僅呈現及閱讀回頂、原guard／token／timer保持，限定通過。

未驗：真active battle的資訊／VFX圖層順序、實際Boss遭遇與全部物件變化、觸發／破壞／倒數、傷害／回合／目標、勝敗／獎勵／儲存／逃跑交易及實體裝置。此段不批准真戰鬥布局或整個Boss子系統。

## 題牌字型補充覆核：暫退回待驗

37501567保存後，art_review補核題牌字形並撤回先前整段美術批准：Boss原header仍為方直黑體，與技能／角色題牌宋明體不同。其餘幾何／閱讀／四尺寸操作與scope證據保留，不宣稱字型已通過。原header局部沿既有Noto Serif TC／serif與900字重，不新增字型、不全域換字；待四尺寸題牌差異實圖與獨立審核後補接受。此補充優先於上方較早的美術結論。
