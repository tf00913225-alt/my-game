# Foreground navigation / Starter potion convergence

Work ID: `FOREGROUND-NAV-STARTER-POTION-20261004`。PR #794 → dev。
開工 dev: `f47862cc592870e359d31da5da52a5d530c831a8`。main 禁止修改。
Game / Cache: 173.73。最終 CI、merge、deployment 與清理狀態由 PR #794 記錄，避免自身 SHA 提交循環。

## 正式控制來源

| 責任 | Owner / Contract |
| --- | --- |
| Bottom Nav DOM、內容與可見性 | `js/04-stage-v11-native-bottom-nav-runtime.js::FourSymbolsBottomNav`；唯一 `#bottomNav`／`.native-bottom-nav-layer` |
| 前景狀態判定 | 同 Owner 的 `foregroundSuppressionReason()` 讀取 `homeFeatureModal.show`、背包頁／overlay 語意、`itemModal.presentationMode`；不新增鏡像狀態 |
| 開關生命週期 | 既有正式 show / close 點同步呼叫 `syncContext()`；`renderMain`／`renderContext` 同樣遵守 suppression |
| 底層情境 | `syncContext()` 依目前真正的 active page、巡怪／副本／深淵 DOM 決定內容；前景關閉不猜按鈕 |
| 情境背包返回 | core `openInventoryContext` 在離開前保存 source；`closeMapInventoryOverlay` 的 restore-source 直接返回該頁；`showPage(...,{restoreSource:true})` 保留副本／Boss Tab |
| 補品資料 | `js/40-v144-rules-and-abyss.js::ensurePotion`；core app-shell 首次資料也遵守 flat66 |
| 補品回復規則 | `js/00-main.js::resolvePotionRecovery`；輸入正式 definition、current、max；輸出實際回復值 |
| 玩家效果文字 | core `getPotionEffectDescription`；商店、背包、戰鬥入口共用 mode 語意 |

## 正式入口與相容性退場

- core `openHomeFeature`／`closeHomeFeature` 承接角色、元素匣與共用主城功能。
- V141 crafting Wrapper 自行開啟鍛造／合成；Team Relic `prepareRelicModal` 是獨立 lazy 開啟點。兩者直接在既有 lifecycle 通知 Nav Owner。
- 主城 ad-free、背包快速售出、release update 的直接共用 Modal show／fallback close 同樣同步；沒有各自寫 Nav style。
- V148 context inventory／relic 入口維持；背包的舊「離開巡怪／跳玩法總覽」分支只允許非 restore-source navigation 相容用途。未刪巡怪 exit Owner。
- V131、V141、V148、V154、V169、quest QA、Team Relic／relic progression 既有 open／close Wrapper 因內容、樣式、通知點、元素匣設定或秘寶 lifecycle 保留；不取得 Nav 可見性決策權。只有相關責任正式遷移後才能刪其相容入口，不以本案跨範圍盲刪。
- 五處舊百分比回復公式已移除，入口只保留扣庫存、選角色、回饋、保存、auto 選擇等既有責任。Adventure `manualOnly` guard 保留自動補品合法性責任，其排序讀 canonical priority；沒有第二份回復公式。
- starter definition／庫存的 `recoveryPercent` 實體移除；舊 50%、100% 與 rare 定義只以百分比／全回復相容讀取，永不解讀為固定點數。完成所有舊百分比資料宣告遷移後才可刪此讀相容。
- 未新增 Runtime timer、MutationObserver、rAF、CSS override、z-index、Shell 或 Bottom Nav Owner。

## 補品資料與公式

| ID / 名稱 | resource | mode | value |
| --- | --- | --- | --- |
| hpPotion10 / 回春散 | hp | flat | 66 |
| spPotion10 / 凝氣散 | sp | flat | 66 |
| hpPotion20 / 養命丹 | hp | percent | 20 |
| hpPotion30 / 大還丹 | hp | percent | 30 |
| spPotion20 / 聚氣丹 | sp | percent | 20 |
| spPotion30 / 歸元丹 | sp | percent | 30 |

flat = min(max-current, value)；percent = min(max-current, round(max×value/100))；full = max-current。
名稱／Icon／ID 保持；舊 hpPotion10／spPotion10 庫存不改 ID 或數量。

五個正式呼叫者：core `applyPotionEffect`、V141 `v17342UseInventoryPotion`、V173.50 `batchPotion`、core `applyPostBattleAutoRecovery`、V154 `finishAutoRecovery`。

## 精準驗收

`tests/starter-potion-recovery.test.js` 與 context inventory actual VM lifecycle 通過；production build、syntax、相關 fixture／nav-owner regression 已執行。

正式 Chrome 透過 production index／build bundles／CSS／lazy loader 載入；僅隔離外部 Firebase 為唯讀 QA 帳號，不替換規則、stats getters、庫存扣除或 UI 更新。角色 bonusHP／bonusSP 建立真正的 4520／1190 上限，兩種正式 stat getters 均需一致。Reload 只清除 disposable QA UID 的 local fixture，避免唯讀 cloud seed 與測試改動形成衝突。

390×844、412×915；每個前景開關兩次。主城15功能；野怪 training／巡怪、每日副本、玩法、Boss、Tower、深淵選擇與20／40地圖各4功能。共204次；另外36次正式返回。開啟當下與完整樣式後 hidden／零 hitbox／玩家前景 hit test；關閉恢復同一 active page／Nav signature／button handlers；Shell1／Nav1／legacy0。cold character／lazy relic／Reload 均單獨驗。

五入口每次實際核對：HP4000→4066、4500→4520；SP1000→1066、1170→1190；HP20/30%=904/1356，SP20/30%=238/357；100% rare 手動回滿且 auto 排除。單次扣1；批次滿值停止；hpPotion10 10份／HP4400 使用2份→4520，剩8份。舊321／456份 hydration 不變。

功能2/2 VERIFIED：Head `e08fdec08d69095b65e6bd464849441e2e03354c`／CI37182829899 的 Nav/Potion step PASS，artifact11296230697 SHA256 `c78d148d376297bc557a177ec266fc66712497d0f1dd566d1a588ffbe32c8e6e` 已獨立核對；204／36、94個實際回復案例與4個auto稀有guard均PASS，三張最終畫面已檢視。完整永久證據見 `foreground-nav-starter-potion-browser-evidence-20261004.json`。最新 Head 必要 CI、dev merge／部署精確 SHA 與線上相同矩陣另為完成 Gate。
