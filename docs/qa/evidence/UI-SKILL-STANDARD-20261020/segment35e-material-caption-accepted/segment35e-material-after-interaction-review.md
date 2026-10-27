# 35E 材質修正版：互動與可讀性獨立審核

結論：241cb3edce33d421dc9d1fac020accda310fcac2 的 OFF 呈現與既有操作限定通過。實際看完四尺寸共八張新 PNG（各 patrol-map-static、appearance-open）及四份 report；沒有使用舊 99b 的通過狀態批准新 Head。99b 純黑貼片維持 art-rejected。

證據：artifacts/ui-skill-standard/segment35e-patrol-caption-241cb3ed/material-after/{360x640,393x873,412x915,1280x800}/。四份 complete、clean、sourceUnchanged 均 true，來源前後 SHA256 相等。

實畫：兩塊說明牌均可見鐵紋中心與雕飾銅緣，「自動戰鬥／自動巡怪」與「關閉」全文完整。四尺寸均未壓住人物、形象切換按鈕或展開選單；兩牌彼此不疊。形象面板開啟後，角色兩列與地圖人物仍完整可見。未發現本輪新增遮擋或裁切。此為互動／可讀性有限結論，美術品質另依 art 審核。

材質實際 computed border-image 指向 assets/ui/skill-iron-bronze/panel.827d9ba9a6f8.webp；四尺寸、兩階段、兩牌皆為 slice `115 fill`、width `2px`、outset `0`。各尺寸與原 99b 同階段的 button、caption box、caption/name/off Range，共兩組各 60 個座標／尺寸比較，最大差值全部 0px（合計 480 個比較），非僅符合 1px 容許值。

| 尺寸 | quick 實際目標寬×高 | 名稱／狀態投影字級 | 六次輸入最小高度 |
|---|---|---|---|
|360×640|70.29×96.63|15.43／13.71|44.57|
|393×873|76.73×105.49|16.84／14.97|48.66|
|412×915|80.44×110.59|17.66／15.70|51.01|
|1280×800|87.86×120.79|19.29／17.14|55.71|

兩牌名稱／狀態 Range 均在目標內，原圖片 native width 78 保留、decoded；OFF 顯示，ON 為 display:none、零 rect。quick 按鈕只量測 EFP 與原 aria/onclick，未點擊。每尺寸六次真輸入均 hit=true：訓練入口、森林資訊、原進入、形象開／關、原底部返回；兩個原 handler 為 toggleAutoBattle()/toggleAutoPatrol()，返回綁定 leaveMap()。

每個記錄 phase 與 staticBaseline 的 domain 完全相等：現有角色 HP/SP（第二個最小角色原本未定義者不擴稱）、金幣、物品、裝備、battleActive=false、token=0、timer=null、auto false、三 config false、元素匣 inactive/0 未變。delegatedSaveCalls 本次觀測為 0，不能推論正式載入／其他路徑零保存。八項 finally 精確還原均 true：raw/meta/actors/inventory/loadouts/equipment/patrol key/save API；不聲稱私有 runtime cache 或巡邏瞬態完全還原。

未驗：ON 真切換、形象選取、三角色／長名、其他區域、地圖／怪物互動、自動戰鬥／巡怪啟動、業務交易、實機。原 bitmap 內微小文字仍保留，本次驗證新增可讀 DOM 說明牌，不稱所有地圖美術或全遊戲完成。未啟 Chrome、未修改 tracked。
