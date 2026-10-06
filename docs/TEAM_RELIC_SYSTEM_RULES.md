# 《四象江湖傳》隊伍秘寶系統永久規則

本文件是秘寶系統的正式設計與架構規則。除非後續需求明確修改，所有 AI 開發代理與後續秘寶功能都必須遵守。

## 核心定位

- 秘寶是「隊伍共用戰場神器」，不是角色個別裝備。
- 每支出戰隊伍目前只能裝備 1 件主秘寶；資料層可保留未來副秘寶欄位，但第一版不得啟用或在 UI 顯示第二槽。
- 秘寶不占角色技能欄、不占角色行動、不消耗角色回合、不消耗角色 SP，也不視為角色施放技能。
- 秘寶是獨立戰場事件，用於戰術補助、戰場節奏修正、少打多補償與元素 Build 聯動，不得取代角色技能、裝備、元素與養成本體。
- 敵方數量越多時，至少部分秘寶應透過敵方有效行動、我方有效受擊等事件自然提高價值；禁止用隱藏攻防倍率直接替少人隊伍放水。
- 每件秘寶核心能力都須有泛用價值。元素與特定一般負面狀態只能提供額外收益，不能成為核心能力啟動門票；禁止沒有火／水角色、燃燒或冰封就完全無效。

## 唯一資料真相

- `js/relic-summary-catalog.js`：主城 First Screen 必要的秘寶 `id / name / triggerText` 唯一靜態來源；必須保持小型、無戰鬥／VFX／Boss 依賴。
- `relicCatalog`：完整秘寶靜態定義，從上述摘要資料橋取得 `name / triggerText`，再組合分類、稀有度、Trigger、Effect、等級成長與 `iconPath`；完整 Catalog 與 Team Relic Trigger Engine 固定放在 `gameplay-core` 最末端，確保所有正式戰鬥入口成立前已同步執行完成。Boss／Tower 與秘寶養成 UI 仍由 `feature-boss-relic` 按需載入。
- `playerRelics`：玩家實際擁有狀態，只保存解鎖、等級、EXP／養成與已查看狀態。
- `teamLoadout.relicId`：目前隊伍唯一裝備真相。禁止在每件秘寶資料內複製 `equipped=true`。
- 秘寶持久化必須寫入目前正式 `SAVE_KEY` 的同一份存檔文件；禁止建立秘寶專屬 localStorage save key。
- 舊存檔沒有秘寶欄位時必須安全 migration，`teamLoadout.relicId` 預設為 `null`。
- 戰鬥 counter、cooldown、當回合觸發次數等 `relicBattleState` 僅存在於當場戰鬥，不得寫入永久存檔。

## Trigger / Effect 架構

- 新秘寶以資料設定為主，禁止每件秘寶各自新增一套戰鬥 if/else。
- Trigger engine 至少保留：`battle_start`、`round_start`、`round_end`、奇偶回合、`every_n_rounds`、`enemy_action_count`、`ally_hit_count`、`ally_hp_below`、`ally_debuffed`、`enemy_defeated`、`ally_down`、`before_lethal_damage`、`once_per_battle`。
- 所有秘寶傷害、治療、護盾、Buff、Debuff 都必須帶 `sourceType="relic"` 或等價來源標記。
- 秘寶傷害不得累積 enemy_action_count／ally_hit_count，也不得觸發角色技能被動；秘寶擊殺不得觸發 `enemy_defeated` 型秘寶。HP Crossing 依正式實際 HP 事件判定，焚星仍受每回合一次與存活條件限制。
- Trigger 必須支援 `maxTriggersPerRound`、`maxTriggersPerBattle`、`cooldownRounds`、`resetOnTrigger`、`oncePerBattle` 等限制。
- `enemy_action_count` 只計敵人真正完成的有效行動；被冰封、暈眩、石化等硬控完整跳過的行動不得計數。DOT、VFX、環境動畫不得計數。
- `ally_hit_count` 以一次敵方角色行動完成的有效攻擊事件計一次，不因同一行動的多段 hit 瞬間灌滿 counter。
- `before_lethal_damage` 必須在死亡 finalize 前完成保命處理，禁止先移除／播放死亡再復活。

## 戰鬥與狀態整合

- 秘寶只能接入目前正式 `startBattle`／`startTurn`／行動／傷害／死亡／狀態 runtime owner，不得建立平行戰鬥迴圈。
- 秘寶造成燃燒、凍傷、冰封、護盾或其他既有狀態時，必須沿用正式狀態 owner 與「同名狀態不可疊加、覆蓋或刷新」規則。
- 秘寶傷害使用獨立 `relicPower`，不得直接借某名角色技能傷害；預設不能暴擊、追擊、吸血或觸發角色技能被動。
- 平衡常數集中在 `RELIC_BALANCE_CONFIG`；BOSS 傷害／Debuff 效率等修正不得散落在各秘寶函式。
- `calculateDamage()` 消費普通直接傷害加成、鎮魂敵方 Direct Final Damage 與萬象 Active Skill Final Damage。唯一正式 Incoming Owner `applyPlayerDirectIncomingModifiers()` 在有效敵方直接傷害成立、Barrier 完全格擋排除後、正式護盾吸收前消費減傷與岩甲；禁止在 showPlayerHit 顯示層事後回補 HP。鎮魂使用 per-effect Boss Efficiency 80%，不改全域 bossDebuffEfficiency。
- 玩家護盾沿用 activeBuffs，由 `FourSymbolsPlayerShield` 統一建立、按 sourceType/sourceId 刷新與吸收。玄武週期刷新只替換自己來源的完整值；其他合法來源護盾保留。玄武盾破守勢 Lv1～9 無、Lv10～19 6%、Lv20 10%，到下一回合結束移除。
- 戰鬥開始時鎖定本場裝備秘寶；戰鬥進行中禁止 hot swap。
- `js/60-team-relic-system.js` 是 `gameplay-core` 固定末端 Runtime。一般巡怪、一般戰鬥、每日副本、裝備副本、Boss、Tower、深淵、Adventure 等入口只要能取得正式戰鬥核心，就必定已 execute 同一份 Team Relic Trigger Engine；不得依賴玩家曾開過秘寶頁、背景 prefetch、戰鬥開始後才補載或 `setTimeout`／`MutationObserver` 補救。
- `runtimeReady:false` 的秘寶不得進入 `teamLoadout.relicId` 正式有效值；舊存檔 hydrate、裝備 action、合成／強化 UI 都必須 fail closed。玩家只顯示「效果尚未覺醒／能力尚未開放」等遊戲語言，不得顯示假的下一級或工程 metadata。

## Final Spec 20/20

20 件皆有正式 Catalog、Scalar、Trigger、Effect、生命週期與 Regression；不是未開放的 metadata。Lv1／Lv10／Lv20 為正式錨點，數值可線性插值；離散解鎖與次數不可插值。

| 秘寶 | 正式 Trigger | Lv1／Lv10／Lv20 核心效果 |
|---|---|---|
| 乾坤玉壺 | 奇數回合 End | 4／5／7% HP；Lv10／20 加 1／2% SP；無每場總上限 |
| 烈陽神珠 | 偶數回合 Start | 全敵 0.75／0.90／1.10×秘寶威力；Lv10／20 燃燒 Bonus 15／25% |
| 玄武靈印 | Battle Start，3倍數回合 Start | 每人 6／9／12% HP 來源護盾完整刷新；Lv10～19 盾破守勢6%，Lv20 10%，到下一回合 End |
| 鎮魂古鐘 | 3倍數回合 Start | 直接最終伤害 -8／10／12%，最終命中 -4／6／8 百分點，2回合；本效果 Boss 80%，不硬控 |
| 天罡戰旗 | 6次敵方有效受擊事件 | 全敵 0.65／0.80／1.00×；Lv10／20 降攻5／8%一回合；每回合一次 |
| 九龍神火罩 | 7次完整敵方 Action | 全敵0.80／0.90／1.10×；Lv10／20 燃燒20／30%，Lv20 燃燒目標傷害Bonus15%；跨回合累積，7次後歸零 |
| 寒泉玉珮 | 存活隊友 HP ≥35% 跌至 <35% | 12／15／18% HP；Lv10起淨化1，Lv20 SP4%；每場2次，冷卻3回合 |
| 岩岳鎮印 | Battle Start 每人2層 | 有效敵方直接 Action 每人最多耗1層，-8／10／12%；Lv20末層6%來源護盾；MISS／Barrier完全格擋／DOT不消耗 |
| 青嵐羽符 | Battle Start | 閃避／異常抗性各8／10／12百分點，所有等級3回合；同一RNG真正因青嵐才失敗才短提示 |
| 回天寶輪 | 隊伍首次致命傷，死亡 finalize 前 | HP保留1後恢復15／18／22%，護盾8／8／10%，Lv20淨化1；整隊每場一次 |
| 太初聖符 | 4倍數回合 End | 負面最多者淨化1／2／全部，全隊HP6／8／10%；無負面仍回血；Tie HP%低優先再固定Party Slot |
| 破軍殘卷 | 玩家普攻／主動技能擊殺 | 存活敵HP%最低者0.90／1.15／1.40×，Tie固定Battlefield Slot，每回合一次；排除秘寶／DOT／反擊／追擊 |
| 赤霄戰紋 | Battle Start | 普攻／主動技能直接傷害+6／8／10%進ordinary加法桶50%上限；爆擊+4／6／8百分點95%上限；2／2／3回合 |
| 玄冰鏡心 | 3倍數回合 End | 全敌0.85／1.00／1.15×，合法一般負面目標Bonus15／20／25%；無負面仍傷害，不附加冰封 |
| 追風行符 | 3倍數回合 Start，本回合每人首次完成Active Skill | 實際SP返還15／20／25% floor、最少1且不超實際消耗、零消耗無返還；閃避8／10／12百分點至自身下次Action Start；不改速度／隊列 |
| 山河寶鼎 | 本回合敵方實際HP損失 ≥ Round Start存活MaxHP總和30% | HP8／10／12%，減傷10／12／15%到下一回合End；Lv20觸發瞬間HP≤30%者盾8%；每回合1、每場2，DOT計入、吸收與overkill不計 |
| 焚星殘印 | 本回合首個敵HP >50% 跌至 ≤50%且存活 | 0.90／1.10／1.30×；Lv20判定目標≤25%再+30%；每回合一次，不要求燃燒 |
| 靈泉法瓶 | 3倍數回合 End | 全存活SP8／10／12%，Lv10／20再HP3／5%，不超上限 |
| 伏魔金印 | Battle Start | 抗性6／10／15百分點3回合；每人每場獨立1印，正式成功寫入可解除一般負面後即淨化；不可淨化不耗印 |
| 萬象歸元盤 | 4倍數回合 Start，存活HP%算術平均，只判一次 | ≤40%歸生HP12／15／18%＋減傷8／10／12%（Lv20各淨化1）；>40%且≤75%調和攻防10／12／15%（Lv20抗性10）；>75%破勢Active Skill Direct Final Damage10／15／20%；皆2回合 |

- 秘寶威力唯一公式：40＋隊伍平均等級×5＋秘寶等級×8；秘寶傷害 sourceType=relic，預設不暴擊／吸血／追擊／技能被動。
- Relic Evasion 僅由正式 Final Evasion Source 投影一次；stats decorator 不再加閃避。Hit V2維持95%基礎、5～99%最終命中，Accuracy／Evasion是百分點，閃避數值不封頂。
- 狀態由正式 Status Policy 分辨一般負面與可淨化狀態；uncleansable、Boss Mechanism、internal marker 不得被一般淨化當作負面。
- 秘寶 Buff／Debuff 在正式 Round End到期，UI使用同一 activeBuffs／statusEffects；追風閃避另在自身下一Action Start移除。玄武／岩岳／山河／回天護盾共用同一來源感知Shield Owner。
- 完整 Cinematic 只在主Trigger。青嵐迴避／抵抗、盾破守勢、岩甲消耗、伏魔破邪使用短提示；萬象每次標示固定型態。Battle Reading Surface沿用既有 transient suppression。

## UI / 稀有度

- 稀有度沿用正式六階：白階 → 藍階 → 紫階 → 橙階 → 桃紅階 → 四象階。禁止新增 SSR／UR／傳說／神話等第二套制度。
- 秘寶頁手機優先、滿版、兩欄 Grid、內部垂直捲動；分類列可橫向滑動。
- 主城左側新增「秘寶」、右側連到既有「元素匣」 owner；不得複製第二套元素匣。
- 主城隊伍秘寶摘要是 app-shell First Screen UI：固定 shell 先存在，再從正式存檔 `teamLoadout.relicId`／`playerRelics` 填入名稱、Lv、觸發摘要；不得為摘要 execute `gameplay-core` 或完整 `feature-boss-relic`，也不得複製第二份裝備狀態。
- `RELIC_CATALOG_LIST[].iconPath` 是 List／Detail／Current Equipment／background prefetch 唯一正式 icon path。Runtime Ready 不等於 Visual Ready；首次開頁先顯示局部 loading，等必要 icon decode、字型與 live render paint 完成後才一次顯示完整內容。
- 玩家可見秘寶列表／詳情／目前隊伍秘寶只能使用正式「裝備／已裝備／卸下／詳情」語言；`runtimeReady`、能力階段、DEV preview 等工程 metadata 可保留於內部，但不得成為玩家 UI 文案或第二份 loadout state。
- 即使在 DEV host 驗收，裝備動作也必須寫入正式 `teamLoadout.relicId`；禁止 `devPreviewRelicId` 或其他平行配裝鏡像。尚未具正式 Trigger／Effect 的秘寶不得因此假裝已有戰鬥效果，既有已實裝秘寶仍依正式 `runtimeReady`／Trigger engine 執行。
- 正式美術尚未提供時只能使用高質感 placeholder，並保留 `iconPath`／`assets/treasures/` 擴充位置；禁止自行下載網路素材。
