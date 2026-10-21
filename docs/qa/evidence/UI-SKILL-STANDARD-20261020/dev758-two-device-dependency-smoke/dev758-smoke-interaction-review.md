# dev758 merge：35 靜態巡邏依賴煙測獨立審核

限定通過。Source bee66eaa6a8d4470b0e04565b7bb06e6b5d2d77d；證據 segment35-patrol-static-bee66eaa/appearance-after/{360x640,1280x800}。實看兩尺寸 training-zone10-reached 與 appearance-open 共四圖，並讀兩份全部 inputs/checks/restore；其餘12圖未作本次獨立逐張審查。這是兩裝置依賴煙測，不是重新完成四尺寸矩陣，也不能由另個戰場 prompt case 代替。

原 .training-zone-list 為 overflow:auto/touch-action:pan-y，client663/total714；兩尺寸真 mobile 手勢／desktop native wheel 均 top0→51（精確末端），第十列完整在 owner 與底部 nav 之上，終點 EFP=true。原反向手勢／wheel 回 top0 後森林入口 EFP=true。新增 touch-lock 依賴沒有破壞這條真實捲動路徑。初始第十列 belowfold hit=false 已如實保留，未直接點擊或當成產品錯誤。

每尺寸六次真點擊均 EFP=true、實際目標至少44（360森林/進入44.57，desktop55.71），另有兩次捲動輸入；原森林進入、形象 switch 開／關及 leaveMap 返回均完成。展開圖兩個角色全文、按鈕與銅框完整，無導覽固定遮擋。未點形象選項與 quick toggles。

所有 domain phase 等於原 staticBaseline：battle=false/token0/timer=null、auto false、3configs false、元素匣inactive/0及已定義HP/SP、gold/inventory/equipment不變。四個原呈現 phase 的 map/training 開關與最終返回紀錄一致。raw/meta/actors/inventory/loadouts/equipment/patrolKey/save API 八項 restore 均 true；不聲稱私有cache、巡邏瞬態exact或載入零save。

兩報 complete/clean/sourceUnchanged 均 true。未驗ON/角色選取/怪物地圖點擊/其他區域/交易/實機。本次未啟 Chrome、未修改 tracked。
