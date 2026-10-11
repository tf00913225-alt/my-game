# 冶煉 V2

Work ID: `REFORGE-V2-20261011`。此規格取代冶煉主副槽、屬性去重及雙最高值 5% 規則；不改裝備取得政策與原始 stats。

| 階級 | 標準槽數 | 每槽範圍 | 金幣 | 礦石開放 |
|---|---:|---|---:|---|
| 白 | 1 | 5–10 | 1000 | 是 |
| 藍 | 1 | 11–16 | 3000 | 是 |
| 紫 | 2 | 17–22 | 8000 | 是 |
| 橙 | 2 | 23–28 | 20000 | 是 |
| 桃紅 | 3 | 29–34 | 30000 | 否 |
| 四象 | 4 | 35–40 | 50000 | 否 |

`functions/src/equipment-reforge.js` 唯一持有逐槽模型、槽數、礦石規則、驗證、相容投影與純抽取；`js/36-v141-content-systems.js` 持有既有交易／UI／選擇生命週期。`getEquipmentBonus()` 保持人物及戰鬥裝備加成 Owner。

每個未鎖定槽獨立等機率抽取 attack、intelligence、vitality、energy、defensePoints、agility；允許重複。每槽 10% 取得最高值，其餘 90% 均勻抽取最低至最高減一。裝備階級不影響選用礦石或其數值。最多鎖兩槽且至少保留一槽，空槽不可鎖；0/1/2 鎖消耗 50/100/150 礦石。

main-save 的每件裝備使用 `reforgeVersion:1`、`reforgeAffixes:[null | {stat,value}]` 與槽數。索引穩定、順序持久化；同屬性各自鎖定。舊 `reforgeStats` 僅保留歷史復原證據；只要 canonical array 存在，所有讀者只從 array 投影，不加算舊物件。歷史合法非六圍及數值保留，僅新抽取限制六圍與本次礦石範圍。超出標準的舊容量／詞條全部保留；未知版本、異常資料不改寫並禁止冶煉。

`loadGame()` 原裝備遷移入口在既有 combat-unit migration 後處理背包與穿戴資料；不得在 render 中新增逐槽遷移。新增裝備以正式階級槽數產生，空槽的純投影不發免費屬性。舊零槽新手修復退休。槽數讀取、穿脫、反覆載入皆冪等。

V132 礦石 definitions 已有六階；素材寶箱／現有來源僅白藍紫橙。桃紅／四象保持 available=false，背包數量不構成取得證據；未新增商店／掉落／獎勵。未達正式取得及開放條件以前禁止扣款及抽取，UI 只預覽。

交易沿用 V132 rollback 及 UID main-save；資源在開始時消耗，保留舊效果不退費，套用時整份替換。結果存檔失敗回滾裝備欄位；相同實體及原詞條快照才可套用，UID／權威改變使 pending 失效。權威雲端角色禁止本機交易；不新增 Cloud callable、server gameplay RNG、candidate 採納、revision writer 或公開 ready 狀態。原始候選／archive 不回寫，未發布的 canonical projection 保留逐槽欄位；Cloud／Recovery Gate 依 DATA_SECURITY_CONTRACTS 與原子系統契約。

直接消費端：00-main 人物／戰鬥加成、35 item detail、36 冶煉頁、55 背包數值／比較；53 inventory clone 深拷貝 slots。equipment-progression 只持有生成階級設定與既有套裝 presentation，不能產生第二套抽取或加成。
