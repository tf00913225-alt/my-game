# 第29段：教學正式系統入口、內容末端與返回（限定驗收）

Work ID UI-SKILL-STANDARD-20261020 / PR955。Production 3b80199ccc7c2a409853b4392920f3c6947d1c3e。

## 已證實問題與修正

331/fcb原回復教學：返回故事按鈕可見、179.72×44，卻繼承game-ui的pointer-events:none，實際命中背包空格。原adventure CSS恢復auto並保存53019886，但獨立實圖未批准該候選：返回浮鈕遮格，技能頁全黑。

530技能診斷31次、3秒顯示skillPage一直inline/computed display:none且rect0；資源已載，不是等待問題。原borrow還原隱藏了獨立頁，教學卻仍走舊showPage(skill)。3b改原openTutorialSystem沿現有home→character modal→skill TAB；原returnFromTutorial先關正式共用視窗，還原借用，再回原tutorial。

原syncTutorialReturn繼續擁有唯一同ID按鈕，移入原modal-box/inventory-classic-shell末尾，不新增wrapper或第二Owner。CSS由absolute浮層改正常流flex列；原內容區收縮並保留自身捲動，按鈕44screen以上。沒有改learn/equip/claim/preparation/continue/battle或數值、存檔與帳號權威。

## 實際證據與獨立審核

skill/equipment/recovery三種隔離active-guidance fixture × 360×640、393×873、412×915、1280×800，共12case/48PNG。真入口→正式目的頁標題/卡片可見→真捲末→真返回原教學；技能實際借在characterTabContent，返回後已不在該容器/共用modal，modal與return隱藏。背包自然空格末端/頁碼操作列/獨立故事返回列不交疊。

art_review實看全部48張；interaction_review與scope_review獨立看四尺寸代表及核來源、原報告、3次真入口/導航/返回same-task指定資料域。三方僅批准上述呈現與往返。原open的lastViewedAt/beginChapter/local save副作用保留；finally只斷言隔離raw save/meta/playerId精確恢復，不稱零save或真帳號測試。

手機9case用host-resolved；桌面3case用desktop-native-wheel。原桌面40次步幅不足失敗保留：3次真輪增量157/157/156，client723、total8342，原40×156.75=6270小於所需7619；僅QA改用原生client×.75為wheel增量，仍真輸入/40上限/相同末端Gate，不改產品或寫scrollTop。三步診斷標no-end-approval，不能作末端通過。

既有故事測試19項與UI renderer2項、build與build --check通過。介面spy只證導航呼叫，不取代上述真DOM借頁證據。Latest Head Required CI仍需核對，不以本機或舊Head結果背書。

證據：docs/qa/evidence/UI-SKILL-STANDARD-20261020/segment29-tutorial-display-accepted/。原pointer/黑頁/遮格/桌面步幅失敗、31sample及3wheel原PNG/report均保留並排除；helper已保存可取得各版原gzip及最後版本，不重寫原report。

## 未驗與下一步

滿120物品/真正切頁與末格命中、原header取消後切換其他視窗、真正禁用狀態、guidance/ending對話、學裝/補品/領物/確認/完成教學/戰鬥/雲端與實體裝置仍未驗。『已確認HP／SP與補品』只是深色secondary，僅核可讀、未點擊，不稱disabled通過。接續最小滿資料與取消情境補驗，再處理已發現經驗池大型普通卡片的材質落差；不重做已接受before對話矩陣。
