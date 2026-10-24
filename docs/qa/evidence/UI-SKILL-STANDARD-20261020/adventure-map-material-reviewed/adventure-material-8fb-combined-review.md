# Adventure map/material combined review — PR #955

Head: 8fb31a9488e4cec111490cb9800126af950811c4. Independent review of existing evidence only; no Chrome launched and no product source changed. Source scope review accepted from `artifacts/adventure-material-8fb-scope-review.md`; not repeated.

## Verdict

限定通過：已用 view_image 逐張檢視 360x640、393x873、412x915、1280x800 的 adventure-map.png、picker-stage20-end.png、story-first-line.png 共 12 張；並核對各 report.json 與既有 helper 的輸入／復原機制。在這些快照及既有角色 onboarding inactive、c1_01 第一行範圍，未發現需阻擋的視覺問題。

- 地圖頂欄、節點資訊、關卡選單與劇情框均呈黑鐵底、古銅金邊及暖金文字；標題留在框內，四尺寸視覺居中。地圖 headingInkCenterOffset 依序 -0.00669/-0.00732/-0.00768/-0.00839 px。
- 底端卡片、EXP 15、進入按鈕及劇情下一句均完整露出，未見底部遮蔽、水平溢出或文字壓框。393/412 的上下黑邊、桌面左右黑邊屬保留直式舞台，內容完整。
- 四尺寸最小受測入口/返回/選單/進入高度分別 44.571/48.657/51.010/55.714 px；劇情返回/下一句最小高度同級，符合 44 px。下一句僅量測呈現，未點擊。
- 主標、節點、卡片與首句可讀。鎖定列灰褐文字較低對比但仍可辨識；清單頂端半列被自身捲動裁切符合中途項目顯示，底端第20列完整露出，沒有誤判為裁切缺陷。

## Interaction evidence

Helper 使用手機 CDP touchStart/touchMove/touchEnd 真輸入及桌面 mouseWheel，沒有寫入 scrollTop。四份 report 的正向 scrollTop 均到 812（client 238 / total 1050），反向均回 0。第20列 c1_20 在終點完整位於 owner 內，disabled=true；返回第1列後用原點擊開 c1_01 sheet。這是檢視鎖定列與可捲達性，未解鎖或進入第20關。

原返回 selector #adventurePage .adventure-back-button，onclick FourSymbolsAdventure.closeToCity()；helper 斷言 homePage active。所有報告 complete=true，受測劇情為 c1_01 / before / lineIndex 0、onboarding.active=false；battleActive=false，沒有戰鬥或獎勵進展驗收。

## Restore and limits

四份 report 的 raw/meta/actors/inventory/loadouts/equipment/saveAPI 復原旗標全 true，profileRemoved=true、sourceUnchanged=true。這只證明 helper 列出的本機鍵、物件及 API 已復原；beginChapter/lastViewedAt/save 的原本副作用有發生，private adventure cache 並未 exact restore。不得延伸宣稱全域狀態、雲端或伺服器資料完全復原。

未驗：新手 onboarding active、教學／技能／商店橋接、其餘劇情行與章節、下一句執行、實體手機觸控／安全區／瀏覽器列變化、正式或 dev 部署環境。既有20-pointer CI 為另外證據，不能由本次素材審核取代。
