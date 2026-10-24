# 第35段：巡邏入口與靜態頁（施工中）

Work ID UI-SKILL-STANDARD-20261020 / PR #955。Before source297d72ab，360×640真trainingNav進野怪區後forest列實際36px，命中正常但不達44px，驗證立即停止，未進map。8項還原均true，失敗原圖/report保留segment35-entry-before。

CSS00原training-zone-item唯一Owner新增border-box/flex垂直置中/min-height52px；原字體、灰底、地圖、列表間隔、所有onclick保留。Generated CSS由原builder重建，build/check通過。未改遊戲邏輯。修後四尺寸與獨立審核待完成，不得稱巡邏已驗收。

下一步：真列表末端/返回forest→原資訊進入→靜態map→形象面板開關（不選）→原native返回。所有原party autoConfig必須已關、無巡怪/戰鬥/timer，否則停止；不主動改config製造安全。無map移動/怪物/auto點擊，啟用補給、戰鬥、選取寫入、其他地區及實機仍未驗。private selected/decode/generation/進場瞬態不主張完整還原。

## 35B 原Owner收斂（修後待驗）

eb5首360仍36px，末列不足44；inline/CSSOM診斷證明JS17啟動函式以42px!important壓過CSS00。這是樣式覆蓋，並非已證末端捲動故障。兩組完整失敗/診斷保留segment35-inline-owner-before。

刪JS17完整純樣式函式及DOMContentLoaded呼叫，保原metadata/地圖映射；原實際font20/pad6 14/line1.15回CSS00唯一Owner，52px與flex垂直中心保留。既有回歸保全部斷言並補防inline Owner復發。Targeted兩檔通過，但內建modal browser因無配置exe而跳過，未算實畫通過；build/check通過。固定新Head後真44/末列/返回/巡邏map仍待驗，未宣稱完成。

## 35C 列表末端遮擋（修後待驗）

固定501首360證明真52後末項落nav下；完整祖先鏈無實際可捲動Owner。失敗/原始祖先證據保留segment35-scroll-before，仍未進巡邏map。CSS00原列表作唯一內部scroll，保留84舊座標單位（原native216/1080×420）導覽區；CSS01訓練祖先不再套map的touch-action:none，原map固定坐標與training固定viewport/背景不改。無wrapper或新JS控制。回歸兩檔/buildcheck過；modal browser未配置exe仍不算通過。真touch/末項/返回與後續map待驗。

## 35D 形象選項（修後待驗）

60ce首360已真末列/回森林/原資訊進入巡邏，但首採集誤讀不存在mapPageTitle失敗，保原圖排除；正式null-safe再跑顯示原地圖無獨立題牌，不能憑空新增。靜態map、人物與quick off目標44.705px/EFP正常，形象原選項32.57px不足44。兩組未通過證據保留segment35-panel-before，不冒稱巡邏已驗收。

原CSS32選項min52/font18/line1.4/可換行，面板適當寬度/內距沿原技能黑鐵雕框，選項保左齊名稱/原active；不改JS26選取或localkey。build/check過，四尺寸/三方修後圖證待完成。快捷圖內微字另待改善，off目標大小不代表語言/切換狀態已驗。

## 四尺寸限定驗收

Source 4325f3df9ea36cf496723a21edef5cd575eaf8b0，四尺寸32張圖/32項真輸入，三方獨立圖證見segment35-static-patrol-accepted。原列表真末第10項/反向回森林、資訊原進入、靜態地圖原人物/素材、形象開關與原native leaveMap→training；原44/EFP保留，no auto/choice/map操作。原失敗與QA錯誤逐組保留，不拿舊驗收蓋過新問題。

- 僅首forest靜態map、兩短名既有actor形象面板開關、不選取；無map移動/怪物/auto切換/戰鬥/回復/獎勵/交易
- quick off按鈕僅尺寸/命中/原圖載入；圖內主字/OFF微字可讀性仍待改善，不因44px通過批准所有按鈕美術
- 3actor/長名/形象選取寫入/其他地區/enabled補給或auto/battle/真手機硬體未驗
- 8項raw/meta/actors/inventory/loadouts/equipment/patrol-key/saveAPI精確還原；currentZone/monsters/grid/path/animation與私有selected/decode/generation/cache不主張完全還原，隔離profile丟棄
- 原route重建怪物與reset位置屬既有進場effects；僅比對靜態期間HP/SP/gold/inventory/equipment/hours/auto/battle/token/timer同baseline
- 本機targeted2靜態contract與build/check通過；內建modal Browser因未配置exe跳過，不代此四尺寸圖證；最新Head必要Actions未確認，未merge/deploy

## 35E 快捷中文標籤（修後待驗）

Before見522d/segment35-static-patrol-accepted各尺寸patrol-map-static實圖：原78px圖工藝保留，但內嵌主字/OFF微字難讀。原index兩個button添aria-hidden可讀中文名/關閉/開啟span；原CSS00給18/16px明確行高、薄黑鐵底/古銅分隔，唯一原.active切換state顯示，不新增JS或旗標。原id/onclick/aria/四張PNG/source handlers保留，圖尺寸78不改，只水平置中。新增caption會自然增加控制高度，不能聲稱幾何不變；需四尺寸看文字Range/命中/錨點及角色/形象menu安全區。build/check通過，修後未驗；ON/切換/巡怪/戰鬥等仍未驗。

## 35E 美術退回：非整段通過

99b四size8圖/24tap與8還原通過，但獨立art明確指出caption純黑矩形像臨時貼片，未接原圖古銅工藝。完整report complete=true僅流程通過，全部圖/三方結果保存segment35e-caption-art-rejected，不得冒稱本段已驗收。

原rpg-window-iron變數實為色值，非材質。修同captionOwner沿原frame中央黑鐵fill/2px克制銅緣；padding4/4/3搭全border1，原4/5搭topborder1的總box與ink origin數學保持，仍須實際前後量測確認。字級/圖78/原active/handler不變，build/check過，修後四尺寸及三方審核待驗。

## 35E 材質修後OFF限定驗收

Source 241cb3edce33d421dc9d1fac020accda310fcac2，四尺寸8實圖/24tap，三方新圖獨立審核見segment35e-material-caption-accepted。原frame115fill/2px提供真黑鐵中心/克制銅緣，文字/原圖/原handler/active及44/EFP完整；同99b每size120幾何值獨立重算maxDiff0（不只算式）。原native返回/domain/8還原通過。舊99b art-rejected保留，未執行舊版acceptance腳本。

- 僅OFF中文與關閉/原menu開關/返回，未操作quick toggle/choice/map；ON、真自動/巡怪/回復/戰鬥/交易未驗
- 3actor長名/其他地區/真實手機硬體未驗；8欄raw/meta/actors/inventory/loadouts/equipment/patrolkey/saveAPI精確還原，私有cache與map進場瞬態不主張完全還原
- 原PNG微字未重畫，功能名稱/狀態由可讀caption補充；不宣稱整素材已重製
- 本次材質delta與99b同尺寸同階段120值各size實測maxDiff0；初加caption確比35增加寬高，不宣稱與35完全同幾何
- 99b讀性/操作通過但art退回完整保留；新241獨立實圖審核才有限批准，不拿report.complete或舊審核替代
- build/check及完整CSS/生成包逆向scope proof通過；最新Head必要CI未確認，未merge/deploy

## 35F 三角色長名限定驗收

無產品修改，source 7b0e9eb43b500d2d2f59bc6e6e1ad5f570a81316，四尺寸8張圖/24真tap，三方獨立圖證見segment35f-three-long-names-accepted。三16字名各兩行完整，列高58.61/63.98/67.07/73.26px，44/EFP/末項native安全區通過。原純factory種第三只display、不register/create，creation讀取值與前兩actor除id原值前後相同。

- 僅三16字名原選單顯示/開關/返回；未點choice/quicktoggle/map，不是真選角/創角/ON/巡怪/戰鬥/獎勵交易驗收
- 第三actor僅原純buildAdditionalCharacter返回值，未register/create，前兩actor僅id變；creation讀取值與原數值前後相同，不改level/成本/資料schema
- popup合理前景覆部分地圖，不承諾其下人物全部可見；三列全文/末項/nav/可操作控件無裁切
- 8欄精確還原只raw/meta/actors/inventory/loadouts/equipment/patrolkey/saveAPI；map進場瞬態/private cache非exact，隔離profile丟棄
- 真手機硬體、其他名字/其他地區仍未驗；art看靜態圖，真關閉/返回由interaction及scope追操作證據，不把closed-before圖片充關閉結果
- 無產品修改，源7b四尺寸8圖/24真tap，最新必要CI未確認，未merge/deploy
