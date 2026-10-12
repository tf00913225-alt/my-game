# EQUIPMENT-AUTHORITY-20261012

Target: dev；Branch: feature/equipment-authority-20261012。禁止合併；2026-10-12 使用者已確認六種能力／部位權重各1、2%增幅與20%回收價。

## 正式來源與改接

`js/equipment-factory.js` 是新裝備 instance（實例）、UID、普通名稱與價格的唯一 Owner。`create` 統一建立，`starter` 僅選起始定義；`migrateGraph` 保留舊能力、冶煉、UID，先驗證衝突再補缺 UID、收斂引用。身份不等於雲端持有權，原 protected settlement／server readiness gates 不變。

起始物品 `00-main` 改接 starter；商店與寶箱的 `equipment-progression.generateEquipment` 僅選 catalog，再呼叫 create；副本發寶箱，開箱每次三件；一般掉落、套裝及其他獎勵的 `27-v132-content-expansion.addItemToInventory` 統一 create，已建立的單件保留原實例。`definitionId` 保留套裝定義查詢相容性。舊 661 筆 catalog 僅是能力／資產定義，移除 runtime 名稱；舊文件名只保留歷史標籤。

移除 v141 延遲 UID 寫入、起始能力覆蓋、起始 render 修補及 mage 名稱替換。舊「幽月幽月法冠」直接存在普通 catalog 的 mage/catalog-054.webp、purple、intelligence19 定義中；移除 runtime catalog 名稱欄位，由工廠一次抽取保存，v146 不再字串替換名稱。舊無效名依 UID 穩定修正，不重抽能力。主角色 element／party alias 衝突時把原裝備保留背包，容量不足拒絕同步。

圖示由工廠保存 assetPath／icon，舊資料僅補缺；冶煉槽由共用 `functions/src/equipment-reforge.js` 決定：1/1/2/2/3/5。新裝備初始空槽，不能從 catalog 複製既有冶煉結果。JSON 載入後先 migrateGraph，再進行其他 inventory 正規化。

## 機率與測試開關

`equipment-progression` 的 `EQUIPMENT_SHOP_DROP_TABLE`：70/19/10/1；`EQUIPMENT_CHEST_DROP_TABLE`：50/35/10/5。UI 引用同表，不包含桃紅／四象。

`SHOP_UNLIMITED_REFRESH_TEST_MODE=true`：免費無限刷新，每次更新內部安全整數序號與六件商品 UID，UI 隱藏次數。改 false 恢復既有每日限制行為，沒有決定新的正式成本／次數／重置政策。canonical reader 只放寬序號的舊 10 上限，仍校驗日期、整數、領取／購買收據與原雲端 Gate；沒有新增持久化 key。

## 已核准價格規則

卡片、詳情、扣款、單件出售、批量出售共用 `factory.prices`。保留白500／藍1500／紫4000／橙10000基準；Vmin=5/11/17/23。沒有初始額外詞條價格，冶煉結果不加入基礎價格。工廠裝備載入時同步保存的 shopPrice／price，不改 UID、名稱、能力或冶煉；舊版／特殊裝備保留已記錄價格。

戰鬥證據：`00-main.SIX_STAT_COEFFICIENTS` 每點攻擊4、智力2.75、體力50HP、精神15SP、防禦4、敏捷1；防禦契約 K=400+目標等級×10，減傷 K/(K+Defense)。不同輸出單位及職業／技能／續航情境不能直接用4:2.75:50:15:4:1定價。

已核准並實作 `STAT_PRICE_WEIGHT`：attack=1、intelligence=1、vitality=1、energy=1、defensePoints=1、agility=1；`SLOT_PRICE_WEIGHT` 所有支援部位各1。兩份不可變表由價格 Owner 保存，沒有 UI 平行公式。

公式：`P=B[tier]*S[slot]+ceil(B[tier]*0.02*W[stat]*max(0,V-Vmin[tier]))`；回收 `floor(P*0.2)`。起始裝備維持既有基準 B=原回收價×5、Vmin=原起始能力值，套用相同增幅／回收公式，避免不相關基準改價。標準普通裝備生成值至少 Vmin，因此每增加1點必定加價。

例：紫階同部位+20，4000+ceil(4000*0.02*3)=4240；+21=4320；藍+12=1530；橙+24=10200。攻擊與智力在W=1下同價，但不宣稱兩者戰鬥效益相同。

## 驗證範圍

背包堆疊正規化不再複製單件裝備引用；既有裝備 count>1 或異常數量屬無法判定的歷史資料，拒絕正規化並保留原資料，不以拆分產生重複 UID。既有四象套裝定義的正式基礎能力／百分比單位遷移契約仍保留；本次 UID 遷移不重新生成能力。CI 舊 runtime fixture 的 UUID 替身改為每次唯一值，維持真正 UID 衝突的拒絕測試。

精準自動測試覆蓋起始工廠／實際冶煉 eligibility、UID 補齊與引用、衝突前置驗證、穩定名稱、catalog 全部661筆、單主能力、兩份獨立機率表、25次免費刷新、唯一價格讀取及單調性、套裝／冶煉／canonical cloud reader 相容。實際瀏覽器覆蓋冶煉選擇、鎖定、冶煉 rollback／重載及裝備詳情／寶箱預覽。

未進行正式部署、main 發布或 dev 合併；最新 Head CI 結果另記 PR。已採用核准價格公式；不宣稱已驗證六種能力的實戰經濟等價。免費無限刷新測試模式保留。
