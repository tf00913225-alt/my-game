# 《四象江湖傳》隊伍秘寶系統永久規則

本文件是秘寶系統的正式設計與架構規則。除非後續需求明確修改，所有 AI 開發代理與後續秘寶功能都必須遵守。

## 核心定位

- 秘寶是「隊伍共用戰場神器」，不是角色個別裝備。
- 每支出戰隊伍目前只能裝備 1 件主秘寶；資料層可保留未來副秘寶欄位，但第一版不得啟用或在 UI 顯示第二槽。
- 秘寶不占角色技能欄、不占角色行動、不消耗角色回合、不消耗角色 SP，也不視為角色施放技能。
- 秘寶是獨立戰場事件，用於戰術補助、戰場節奏修正、少打多補償與元素 Build 聯動，不得取代角色技能、裝備、元素與養成本體。
- 敵方數量越多時，至少部分秘寶應透過敵方有效行動、我方有效受擊等事件自然提高價值；禁止用隱藏攻防倍率直接替少人隊伍放水。

## 唯一資料真相

- `relicCatalog`：秘寶靜態定義、分類、稀有度、Trigger、Effect、等級成長與 `iconPath`。
- `playerRelics`：玩家實際擁有狀態，只保存解鎖、等級、EXP／養成與已查看狀態。
- `teamLoadout.relicId`：目前隊伍唯一裝備真相。禁止在每件秘寶資料內複製 `equipped=true`。
- 秘寶持久化必須寫入目前正式 `SAVE_KEY` 的同一份存檔文件；禁止建立秘寶專屬 localStorage save key。
- 舊存檔沒有秘寶欄位時必須安全 migration，`teamLoadout.relicId` 預設為 `null`。
- 戰鬥 counter、cooldown、當回合觸發次數等 `relicBattleState` 僅存在於當場戰鬥，不得寫入永久存檔。

## Trigger / Effect 架構

- 新秘寶以資料設定為主，禁止每件秘寶各自新增一套戰鬥 if/else。
- Trigger engine 至少保留：`battle_start`、`round_start`、`round_end`、奇偶回合、`every_n_rounds`、`enemy_action_count`、`ally_hit_count`、`ally_hp_below`、`ally_debuffed`、`enemy_defeated`、`ally_down`、`before_lethal_damage`、`once_per_battle`。
- 所有秘寶傷害、治療、護盾、Buff、Debuff 都必須帶 `sourceType="relic"` 或等價來源標記。
- 預設秘寶造成的效果不得再次累積會觸發自己或其他秘寶的條件；秘寶擊殺預設不得再次觸發 `enemy_defeated` 型秘寶。
- Trigger 必須支援 `maxTriggersPerRound`、`maxTriggersPerBattle`、`cooldownRounds`、`resetOnTrigger`、`oncePerBattle` 等限制。
- `enemy_action_count` 只計敵人真正完成的有效行動；被冰封、暈眩、石化等硬控完整跳過的行動不得計數。DOT、VFX、環境動畫不得計數。
- `ally_hit_count` 以一次敵方角色行動完成的有效攻擊事件計一次，不因同一行動的多段 hit 瞬間灌滿 counter。
- `before_lethal_damage` 必須在死亡 finalize 前完成保命處理，禁止先移除／播放死亡再復活。

## 戰鬥與狀態整合

- 秘寶只能接入目前正式 `startBattle`／`startTurn`／行動／傷害／死亡／狀態 runtime owner，不得建立平行戰鬥迴圈。
- 秘寶造成燃燒、凍傷、冰封、護盾或其他既有狀態時，必須沿用正式狀態 owner 與「同名狀態不可疊加、覆蓋或刷新」規則。
- 秘寶傷害使用獨立 `relicPower`，不得直接借某名角色技能傷害；預設不能暴擊、追擊、吸血或觸發角色技能被動。
- 平衡常數集中在 `RELIC_BALANCE_CONFIG`；BOSS 傷害／Debuff 效率等修正不得散落在各秘寶函式。
- 戰鬥開始時鎖定本場裝備秘寶；戰鬥進行中禁止 hot swap。

## UI / 稀有度

- 稀有度沿用正式六階：白階 → 藍階 → 紫階 → 橙階 → 桃紅階 → 四象階。禁止新增 SSR／UR／傳說／神話等第二套制度。
- 秘寶頁手機優先、滿版、兩欄 Grid、內部垂直捲動；分類列可橫向滑動。
- 主城左側新增「秘寶」、右側連到既有「元素匣」 owner；不得複製第二套元素匣。
- 正式美術尚未提供時只能使用高質感 placeholder，並保留 `iconPath`／`assets/treasures/` 擴充位置；禁止自行下載網路素材。
