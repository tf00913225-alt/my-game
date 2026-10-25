# 桃溪村首版施工紀錄

Work ID：`EXPLORATION-CORNER-20261023`。施工線與即時狀態 Owner：[PR #985](https://github.com/tf00913225-alt/my-game/pull/985)。交接來源只取 #997 固定 `9340c24e00420421b83bbd37484cde887d8fbeb9` 的本目錄。最新 dev 正常 merge 至原工作線，不另開探索實作 PR。

## 配置與負責模組

- `js/exploration/taoxi-content.js` 集中管理五屋、十點、三名 NPC、入口與解鎖。A/B 初開；C 需阿芸交談與 A 信件；D 完成 c1_06；E 完成 c1_16 與 C 手記。線索可重讀。六獎勵各為一包既有 `hpPotion10` 或 `spPotion10`，其餘四點是描述／線索。這些是可逆初值，並非使用者逐項選定內容。
- `prototypes/exploration-corner/scene.js` 與 `runtime.js` 是原工作線的單一幾何／移動與生命週期來源，正式 builder 直接重用，沒有另一份移動公式。新增場景參數、互動資料與連續虛擬搖桿；既有點地接觸即改道、安全 swept-circle 碰撞及清理維持。
- `taoxi-ui.js` 只負責原 `showPage` 導航之 native sibling、場景切換與探索 UI。Display 坐標仍用 `eventToGamePoint`。返回順序為室內→門口安全點→大地圖→原主城／故事來源。
- 普通對話用 Adventure UI 的純展示 `presentDialogue`，沒有 Story cursor 或 `startStory`／`advanceDialogue` 呼叫。探索開放只讀前五關 completed 與已結束的 onboarding；不改主線。
- 保存由 `taoxi-progress.js` 經原 Inventory transaction、既有補品 API、`saveGame`、AccountSave 寫 UID 主存檔。新增 optional 欄位見 Persisted State Registry。

## 保存適用範圍

目前是與既有普通玩法一致的 **UID 本機暫存**，畫面明示尚非雲端同步。不得視為可信雲端權益。既有 Cloud Save Phase 4 未完成：權威雲端帳號產生 local-dirty 差異後，重載會停在原 MIGRATION_REQUIRED，完整原資料保留。探索不得解除此 Gate。既有沒有權威快照的 UID 本機模式可由原 Boot resolver 載入。這兩種條件必須分開驗證，不能拿本機模式 PASS 宣稱所有帳號重載／跨裝置完成。

## 美術來源與幀資料

使用 built-in imagegen，以三張交接參考和八張現有創角立繪作參考，另製作無文字／UI／示範人物的大地圖、空室內、空地面、透明房屋、家具／桃樹圖集、村民圖集及八款動作圖。參考 PNG 不被 runtime 引用。

母圖在 `assets/inbox/taoxi-v1/`，正式無損 WebP 在 `assets/exploration/taoxi-v1/`。逐圖尺寸、模式、SHA-256 與逐 RGBA 位元一致檢查保存在 `validation.json`。轉檔未縮放、裁切、調色或改透明度。

八張人物圖均為 1086×1448，3 欄×4 列，每格 362×362；三欄為站立及兩個行走 pose，四列預設 down/left/right/up。實際生成的 male03 第二列為 right、第三列為 left，因此由 renderer 交換方向映射；female03 第二列站立向左而行走向右，左行走由相應 pose 水平鏡射顯示。保持原母圖排列。所有人物採四向、斜行取主軸面向，是工程初值；生成幀仍需實際畫面驗收，不以圖集存在宣稱動作完美。

家具圖集為 1261×1247。圖框取樣：bed `[0,0,620,624]`、desk `[640,0,621,610]`、chest `[0,624,560,623]`、peach `[560,610,701,637]`；這是 runtime 幀視窗，不是轉檔裁切。村民為 2172×724、三個 724 方格。房屋／人物／家具／樹冠是獨立物件，原碰撞資料與腳底深度排序控制遮擋。

## 驗證階段

第一批 22 個 targeted tests 通過：既有原型幾何／生命週期 15、探索配置／進度 7。新增測試含解鎖可達性、前五關與教學條件、普通交談不改主線、重複領取、保存失敗、滿包、UID／損壞紀錄拒絕與所有出入口／互動點可達性。

Browser QA 使用正式 index／build／Display／導航／Inventory／AccountSave，只隔離外部 Auth/Cloud 與明確設定 QA 主線進度 fixture。它不證明真實闖關取得資格、雲端接受或真手機操作。實際畫面與後續完整驗證以 PR 最新 checkpoint 為準。未完成 Gate 不得宣稱首版完工或合併；不發布 main。
