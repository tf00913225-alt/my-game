# 《四象江湖傳》System Contracts / 系統契約

本文件定義跨模組、跨版本都必須維持的正式系統契約。若歷史註解、測試、交接或舊功能卡規格與本文件衝突，以本文件與最新需求批次為準。

## Boss 術語與契約邊界

術語唯一 Owner：`docs/MONSTER_PORTRAIT_SPEC_V1.md` 第 0 節。世界／個人 Boss 統稱大 Boss，深淵等一般首領稱小 Boss；rank、mode、sizeClass 與 footprint 是獨立契約。下方 Boss 專屬模式的中央六格／援軍／功能物件規則只適用個人／世界大 Boss，不得因一般敵人 `rank="boss"` 套用到塔、每日副本或深淵。既有 World Boss／Personal Boss／Abyss Boss 名稱及內部 identifier 保留。

## 戰鬥目標契約

- 一般戰鬥維持 `single / tri / row / column / all` 的 Fixed Slot（固定格位）規則。
- `FourSymbolsBattleSkillTargeting` 是技能 Target Shape（目標形狀）與 hostile primary eligibility（敵對主要目標可選性）的唯一協調入口；玩家→敵方、敵方→玩家、手動、自動與支援技能都必須使用同一份正式 Skill Data／effective target type，再交由 `FourSymbolsBattlefieldSlots` 解析幾何。禁止同一 Skill ID 因施放方不同而硬寫第二份目標人數或範圍。
- Stealth（隱身）只禁止成為 hostile primary target（敵對主要選定目標）：普通攻擊與任何需要指定 primary 的 `single / tri / row / column` 都不得選中隱身單位；但 `tri / row / column / all` 已由其他合法 primary／全體範圍解析出的波及名單仍可包含隱身單位。
- Boss（頭目）專屬模式內，Boss、援軍、圖騰、戰旗、法器與技能召喚物都是獨立的數字索引 target entity（目標單位）。
- Boss 模式中，除 `all / enemyAll` 外，所有技能只結算 primary target（主要目標）。視覺範圍與傷害目標數量彼此獨立。
- Boss 是單一 entity（單位）；中央 `B2/B3/B4/F2/F3/F4` 六格只構成 visual footprint（視覺佔位）、點擊面積與 VFX（視覺特效）錨點，不得複製六份生命或傷害判定。
- 援軍只使用 `B1/B5`；Boss 技能物件只使用 `F1/F5`。
- Boss 技能物件使用一般敵方單位呈現與受擊管線，但必須 `canAct=false`、不進 AI（人工智慧）行動序、不提供一般掉落或擊殺進度。
- 金剛護體是 Boss 自身 Shield（護盾）；傷害先扣 Shield，剩餘值才扣 Boss HP（生命值）。
- `MECH_L / MECH_C / MECH_R`、`mechanism:*` 字串目標與功能卡傷害管線已退役，不得重新加入。

## 戰鬥呈現契約

- 玩家、普通／精英敵人、Boss、援軍、圖騰與戰旗全部使用無卡框立繪。
- Fixed Slot 只擁有站位、幾何、點擊、HUD（資訊介面）與 VFX 錨點；不得重新成為可見卡框。
- `FourSymbolsBattlefieldSlots` 是格位與範圍幾何唯一 owner（控制來源）；`battlefield-render-geometry-adapter.js` 只投影 DOM（文件物件模型）；`FourSymbolsBattlePresentation` 只裝飾立繪與瞬時回饋。
- 動態生成單位必須在插入 DOM 當下套用正式 presentation（呈現），不得依賴輪詢修正。
- 受擊回饋只使用傷害數字、立繪震動、技能 VFX 與爆擊效果；`.red-hit` 根卡框狀態已退役。Heal（治療）不得使用傷害語意。
- 玩家與普通敵方共用資源條高度與 HUD 錨點；Boss 可使用自己的大型 HP／Shield HUD。
- Target Reticle（目標準星）由 Fixed Slot V2 唯一投影；敵方、我方、Boss、援軍與可破壞 Boss object 共用同一金色準星。歷史 `::after` 準星不得與正式 `::before` 準星並存。
- Status Icon（狀態圖示）HUD 必須位於 HP／SP 資源條之上，正式 24px Icon 不得被塞入低於自身高度的容器或被資源條 z-index 蓋住。
- Stealth（隱身）有效期間只將 combatant artwork（戰鬥立繪本體）投影為 `opacity: 0.35`；HP／SP、名稱、Status Icon、Target/VFX 錨點不得一起變透明。狀態解除或死亡後必須在正式狀態同步時移除半透明呈現。
- 正式 Battle Info Drawer（戰鬥資訊抽屜）外殼永遠透明；收合／展開都保留左側回合文字，只有右側「戰鬥資訊／返回」小 Tab 與展開後的紀錄正文可有黑底。巡怪 `#mapBattleInfo` 是獨立固定黑色紀錄框，不得再共享正式 Drawer 外觀 owner。
- Battle Info Tab 固定錨定於戰鬥畫面右下；不可拖曳、不可自由定位。展開／收合只允許改變 Drawer（抽屜）狀態，不得改變 Tab 錨點。
- 巡怪頁底部導覽與副本／Gameplay 共用 `js/04-stage-v11-native-bottom-nav-runtime.js::FourSymbolsBottomNav.syncContext()` 的 app-shell context navigation owner；順序固定為「角色／背包／秘寶／元素匣／返回」，冷進野怪區不得等待或預載 gameplay-core 才取得正確情境。`js/42-v148-combat-dungeon-fixes.js::syncContextNavigation()` 只保留深淵頂部返回控制與相容轉呼叫，不得重新持有底部情境選擇。巡怪頁不得再建立右上角第二顆返回鈕或自行硬寫另一套底部按鈕 markup。
- 通知紅點共用 `css/38-v141-system-expansion.css::.v141-notice-dot` 的 Legacy 呈現契約；1080×1920 原生底部導覽只可由 `css/06-stage-v11-native-bottom-nav.css` 做明確座標換算。禁止後載 CSS 將同一個 7px 直接套到兩種座標層，紅點不得攔截點擊或在呼吸動畫最小幀失去可辨識性。
- 手動戰鬥在技能／物品／目標選擇期間，回合／倒數列必須保持 100% 可見並位於選擇 UI 上層；不得以降低 opacity（透明度）或被其他 UI 覆蓋的方式讓位。
- 巡怪人物初始畫面不得顯示 legacy `patrol-character.png` 再切換；`js/26-v131-patrol-appearance.js` 必須先解析玩家選定角色／性別／元素素材，待 decode/load 成功後直接顯示正式 WebP。

## VFX 與回合流程契約

- V142 只擁有視覺生命週期與剩餘時間；V143 只擁有 raster VFX（點陣視覺特效）渲染與幾何。
- `00-main.js` 是 `finishPlayerAction()` 與 `processNextCombatant()` 唯一 owner。功能模組不得替換這兩個函式，也不得以 Promise（非同步承諾）阻塞回合佇列。
- 功能模組需要觀察或暫時攔截完成通知時，只能使用 `FourSymbolsBattleFlow` 的訂閱／攔截 API（應用程式介面），並確保攔截器可解除。
- single 的中心是實際目標格；tri 即使只剩一個單位也保留三人格視覺尺寸；all 永遠保留完整目標側範圍；projectile（飛行技能）從施放者中心飛向正式主要目標中心。
- DOM 例外、MISS（未命中）、Buff（增益）、Heal、Shield、Debuff（減益）與 VFX 清理都不得讓同一 initiative（行動序）永久等待。

## 持續效果回合生命週期契約

- 「持續 N 回合」統一採用 Round-End Duration（大回合結束持續時間）：施放當回合立即有效，於該回合結束時消耗一次；`turnsLeft=1` 必須在該 Round End 立即移除，下一回合開始不得存在。
- `finishBattleDurationAction()`／Action Finish（單一行動完成）不得扣除 round-based state；`startTurn()`／Round Start（大回合開始）不得再扣除或重複 Tick。唯一正式入口是 `consumeRoundEndDurations()`，由 `FourSymbolsBattleFlow` 的 `round_end` 邊界同步呼叫。
- Buff、Debuff、Freeze、Petrify、Hard Control 與 Burn 必須使用同一個大回合結束語意。Burn 在 Round End 只由 `tickStatusEffects()` 造成一次 DoT、扣除一次 `turnsLeft`，到期後移除；持續 N 回合必須恰好造成 N 次傷害。
- `Charge-owned`／`Event-owned` 狀態（例如 `remainingBlocks`、`chargeCount`、`charges`、`triggerCount`、`oneShot`、Relic Count、追擊次數）不得因看到 `turnsLeft` 就被 Round-End sweep 誤扣，仍由其正式事件／次數 Owner 消耗。
- `FourSymbolsDurationLifecycle` 仍是跨模組協調入口，但不得在 Action Finish 或 Round Start 消耗持續時間。
- 狀態視覺與 Battle Status Detail（戰鬥狀態詳情）必須在 Round-End 移除／同步後反映最新資料；下一回合只讀取已收斂狀態。

## 命中、閃躲與異常判定契約

- Normal Hit（一般命中）的唯一公式 owner 是 `js/00-main.js::calculateHitChancePercent()`／`rollHitChance()`。正式公式為：`clamp(95 + accuracyPercent + finalAccuracyBonus - targetFinalEvasion - finalHitReduction, 5, 99)`；這是唯一一次一般命中 Clamp。Accuracy 與 Evasion 本身不得預先硬封頂。命中提升、命中下降與閃躲都以最終百分點直接加減；禁止再使用「先封頂命中，再乘上 (1 - 閃躲率)」。
- Final Hit Chance 最低為 5%、最高為 99%；故一般規則下最高實際 Miss Chance 為 95%、最低為 1%。`HIT_CHANCE_MIN_PERCENT = 70` 已 RETIRED；只有明確 Gameplay Flag 的 Guaranteed Hit／Guaranteed Dodge 才能繞過一般 Roll，不得以極端 Accuracy／Evasion 模擬。
- Evasion 40% 代表 Final Hit Chance 直接 -40 個百分點；Evasion Buff／Debuff 同樣直接加減，不得乘算。多個閃躲來源由 `v173CombineEvasionRates()` 加總後只限制最低 0；`FINAL_EVASION_RATE_CAP = 85` 已 RETIRED，Evasion 可超過 95% 並繼續對抗高 Accuracy。
- 普通怪物沒有明確 `evasion` 時，正式預設值為 `0`；明確指定的怪物／Boss 閃躲仍保留。
- Status / Hard Control（異常／硬控）的唯一公式 owner 是 `js/00-main.js::calculateStatusEffectChance()`／`rollStatusEffectHit()`。正式公式在上限前為：`skillBaseChance + offensiveAttribute×0.05 + finalStatusBonus - targetFinalStatusResistance`。目標抗性只能來自獨立的 Equipment、Skill、EX、Relic、Buff／Debuff、Passive 或 Monster Combat Stat；Spirit 與其他六圍不得提供抗性。不得再加入 level factor（等級差倍率）、`sqrt(attribute)`、六圍衍生抗性或第二套 Boss 乘算抗性。
- 物理技能的異常主屬性使用有效 Attack Points（攻擊六圍點數）；法術技能使用有效 Intelligence（智力）。符咒、怪物技能、Boss／深淵技能與玩家技能必須走同一公式 owner，不得各自重算。
- Hard Control 最終上限固定為：Regular 90%、Elite 75%、Boss 60%、Enemy-to-player 60%；上限只在同一套最終成功率公式最後套用一次。Freeze／Petrify 的互斥 Gate 仍先於正式寫入，禁止 Boss 額外再乘第二套隱藏抗性。
- Frostbite（凍傷）是 Soft Debuff：造成傷害 -30%，最終閃躲 -25%、最終異常狀態抗性 -25%；不禁止使用技能。任何戰鬥狀態文字若再顯示「凍傷＝無法使用技能」都屬 Contract violation。
- V140／V158／V169 等歷史模組不得再 override（覆寫）上述核心公式。Guaranteed Burn（必定燃燒）必須透過正式 `guaranteedHit` 參數，不得暫時替換全域 `rollStatusEffectHit()`。
- 內部公式仍以 percentage point（百分點）做最終命中／閃躲／抗性加減；玩家可見 Buff／Debuff 一律顯示「最終…±N%」，禁止顯示「個百分點」。UI 的 `%` 是顯示語法，不改變內部百分點數學語意。

## 技能成長與說明契約

- Character Element = Element DNA：`character.element` 唯一負責元素克制、EX 身份與本命元素身份；普通攻擊與所有玩家技能（包括跨修）均以施放角色 DNA 對目標元素結算克制。
- Skill Element = Skill Identity：`skill.element` 只負責 VFX、Icon、技能／狀態類型與視覺身份，不得改寫角色 DNA 或元素克制。Skill Category 唯一負責 Physical／Magic 與 Attack／Intelligence 公式。
- Cross Element：需已學至少一招本命技能；跨修免 `requires`、初學成本 ×2、後續升級仍 1 點；每名角色最多裝備 1 招跨元素技能，存檔／自動配裝／戰鬥 Ready Gate 都必須保留欄位順序中的第一招並自動卸下其餘跨修技能。EX 永遠本命限定。
- Wind EX：Final Evasion +15%、Final Accuracy +15%；自身 HP <25% 時，正式一般命中公式完成後，對該角色套用 `finalHitChance = min(finalHitChance, 50)`。這是 Special Final Cap，不另設普通 Evasion 上限；HP >=25% 立即失效，且不適用 DoT、Reflect、純 Status Formula、Skill HP Cost 或明確不可閃避機制。

- 玩家四元素「主要效果包含直接傷害」技能的正式傷害曲線唯一 owner 為 `js/00-main.js::getSkillDamageAtLevel()`。Lv1 使用 `baseDamage`；Lv2～4 依 `damagePerLevel` 線性增加；Lv5 = Lv4 × 1.5；Lv6～9 再依固定成長增加；Lv10 = Lv9 × 1.5。突破與最終傷害取整統一使用正式戰鬥 `Math.round` 語意。
- 玩家直接傷害技能正式上限為 Lv10；純 Buff／Heal／Revive／Control／Support／EX 不得因本規則被誤升 Lv10。既有玩家已學等級必須原值保留，Max Lv 提升不得重置、退點、自動補滿或重複扣點。
- 所有可升級技能 Lv2～Max 每次固定消耗 1 技能點。初次學習成本仍由正式技能階級／資料 owner 決定，不得拿升級成本覆蓋學習成本。
- `js/60-v173.64-skill-progression-rebalance.js` 是正式玩家技能 Final Data／Progression／玩家說明 projection owner，並隨 `gameplay-core` 固定載入；V144／V169 等舊層不得再各自覆寫技能詳細文字或另算下一級傷害。
- 技能列表、詳細頁、Lv1～Max 明細與下一級傷害必須由正式 Skill Data 與 `getSkillDamageAtLevel()` 投影。禁止在 UI 寫第二份 10 級傷害表、舊「最高5級」或用「每級+X」假裝完整描述 Lv5/Lv10 突破。
- Battle Quick Bar（戰鬥技能快捷列）必須驗證每格的 canonical structure（正式結構），並由正式 Skill Data／`FourSymbolsSkillSpec` 投影技能名稱、SP、目標範圍與效果說明；只檢查「有四顆按鈕」不得視為結構有效，缺少內部節點時必須重建正式結構。
- 輔助技能 Runtime 必須讀正式 `...ByLevel`／duration／target 欄位；不得在施放前暫時 mutation `skill.xxx` 再還原作為等級縮放。敵方／深淵同名支援技能也必須讀同一份正式數值與 Targeting owner。

## Team Relic Runtime 載入契約

- `js/60-team-relic-system.js` 的 Catalog／Trigger／Effect Engine 固定置於 `gameplay-core` 最末端。任何能成立的正式 Battle Runtime 都必須已同步 execute 此 owner；不得以「玩家是否先開秘寶頁」或 idle prefetch 是否碰巧完成決定秘寶能否觸發。
- 只允許 Team Relic Runtime 本身進入 `gameplay-core`；Boss／Tower／秘寶養成仍維持 `feature-boss-relic` lazy load，且兩者都不得塞進 Critical Boot。禁止為 Team Relic 再建立額外 feature gate、戰鬥開始後 Promise 補載或 polling。
- `runtimeReady:false` 秘寶不是可用功能：不得正式裝備、強化、觸發或顯示虛構下一級數值；舊存檔 loadout 若指向未實裝秘寶必須 fail closed 為未裝備。禁止逐件補 `if` 建立第二套 Trigger Engine。

## Battle Statistics（戰鬥統計）與戰況介面契約

- `FourSymbolsBattleStatistics` 是每場戰鬥統計的唯一 owner（控制來源）；每場開始建立一次、戰鬥中累積、結束時凍結同一份 snapshot（快照），戰後結算禁止重新推算第二份數字。
- 統計必須以 combatant ID（戰鬥單位唯一識別）為 key，至少支援 `playerCharacter`、`heroNpc`、`reinforcement`。禁止寫死三名玩家角色；未來 Hero NPC（英雄非玩家角色）只能註冊進同一 owner，不得另建統計核心。
- 正式統計欄位只有：實際總傷害、有效治療量、實際承受傷害、真正 Critical（暴擊）次數。技能施放次數不是正式欄位。
- 傷害／治療只能從戰鬥結算前後的實際 HP 差額或正式 settlement（結算）事件累積；不得讀浮字、VFX、紅字顏色或戰鬥紀錄反推。
- Shield（護盾）、減傷、Barrier（結界）、無敵／吸收後未真正扣 HP 的部分不得算承受傷害；Overheal（過量治療）未另有正式規則前不得算入有效治療。
- 左側「戰鬥數據」Drawer（抽屜）與右側 Boss 功能卡 Drawer 都是 non-blocking observer UI（非阻塞觀察介面）：打開時不得取得 `FourSymbolsBattleFlow` pause／presentation lock，Auto／Manual Battle（自動／手動戰鬥）都必須照常推進。玩家主動打開戰鬥數據、Boss 功能卡、戰鬥資訊或戰鬥狀態視窗時，該互動資訊層必須暫時位於技能 VFX 與傷害／治療浮字之上，禁止被瞬時演出遮住；關閉後恢復一般戰場繪製順序。左側「戰鬥數據」入口固定貼齊戰場左邊並允許玩家上下拖移。
- Auto Battle（自動戰鬥）回合提示是正式 round lifecycle 的 0.5 秒 tracked lock；新回合成立後先顯示「第 X 回合」，提示結束後才允許第一個宣告／行動。手動戰鬥維持既有節奏。
- 個人 Boss、世界 Boss、深淵可在 battle finish 後顯示 `FourSymbolsBattleStatistics` 的 frozen snapshot，直到玩家主動關閉；一般巡怪與每日副本不得因此增加長駐結算 Modal。

## Boss 功能卡資訊契約

- 右側驚嘆號與 Drawer 只投影目前正式 Boss object entity（功能物件）狀態；不得重建已退役的 `MECH_*`／`mechanism:*` 第二套機制資料。
- Drawer 必須列出目前所有存活 Boss object，而非只列第一張；名稱、效果、觸發來源、目前狀態、倒數／剩餘回合全部從 `FourSymbolsBossBattle`／active battle context（當前戰鬥上下文）讀取。
- 功能物件生成、被破壞、倒數、退休時必須同步 inspector（檢視器）；沒有存活功能物件時紅色「！」必須消失。

## Enemy Runtime Identity／Element Owner 契約

- `window.v132ActiveDungeonRun` 只代表「共用 Dungeon Battle Runtime 正在使用」，不得再等同某一玩法。正式入口必須在 `v132LaunchDungeonBattle(..., options)` 提供 `mode`：Daily=`daily`、四象塔=`tower`、個人／世界 Boss=`boss`（另以 `gameplayMode` 區分 personal/world）、Adventure=`adventure`、Abyss=`abyss`；舊私有入口未遷移前只可標示 `legacy-dungeon`。
- 四象塔 `monster.element`、`skillIds`、`v141SupportSkillIds` 的唯一玩法 Owner 是 `js/gameplay-boss-tower-system.js::buildTowerRoster()`／`configureBossSkills()`。Tower monster 一旦帶有 `v132FixedSkillLoadout=true`，共用 Dungeon／Battle 初始化不得重抽元素或技能。
- `js/40-v144-rules-and-abyss.js` 是敵方技能元素合法性的唯一 Guard Owner。一般元素怪物只有 `skill.element === monster.element` 的實際攜帶技能可進 Attack／Support／Heal／Buff／Debuff／Hard Control AI；缺少 element、舊殘留 ID 或非攜帶技能一律 fail closed。
- 真正跨元素的 Emperor／Abyss／Boss 特例必須以明確 `v144CrossElementSkillIds` metadata allowlist 宣告；禁止依怪物中文名稱偷偷追加另一元素技能。
- 敵方 AI 只能從 Guard 後的 `monster.skillIds`／`monster.v141SupportSkillIds` 選招；Forced Skill ID 也必須仍在合法攜帶清單內。

## Four-Symbol Tower Formation／Small Boss 契約

- 四象塔每個元素、每層（含第 100 層）固定 10 個真實戰鬥單位，唯一格位 `B1...B5 + F1...F5`。一般層 10 Regular；每 5 層且非 10 倍數為 2 Elite + 8 Regular；每 10 層為 1 Tower Boss + 2 Elite + 7 Regular。All 結算所有存活目標；其他目標形狀不變。
- 10 人 Boss 層 `ENEMY_B3` 永遠是唯一 Tower Boss；沒有 Boss 的 10 人特殊層，`ENEMY_B3` 優先為 Elite。死亡後 Slot 不重排、不補位。
- Tower Boss gameplay `rank="boss"`，但不是 Large Boss entity：固定單格 `ENEMY_B3`、`unitKind="tower-boss"`、不啟用 `FourSymbolsBossBattle` 的中央六格 footprint、B1/B5 援軍、F1/F5 Boss objects、Boss Shield／Mechanism Inspector。
- Large Boss 架構只保留 Personal Boss 與 World Boss；Abyss 仍使用自己的正式編成 Owner。
- Tower Boss portrait `sizeClass="standard"`，正式規格 1024×1536、2:3；`rank` 與 portrait `sizeClass` 不得混為同一語意。

## Element Tower（元素塔）自動續戰契約

- 「自動挑戰下一層」屬 `gameplay-boss-tower-system.js` 的正式 Tower lifecycle（塔生命週期），不是戰鬥核心第二套迴圈。
- 勾選後只有本層正式勝利且下一層存在／可進入時才啟動 3 → 2 → 1；倒數必須使用單一受管理 timeout owner，禁止裸 `setInterval` 或離頁後仍存活的背景計時器。
- 戰敗、最高層、下一層不存在、進入條件不符、正式 launcher 回報不能繼續、玩家取消或離開 Tower 頁面，皆必須取消倒數並停止自動挑戰；戰敗禁止自動重試同層或跳下一層。
- 第 50 層等正式獎勵／秘寶選擇 gate（閘門）若阻止下一層，必須停止自動續戰，不能繞過正式 progression（進度）條件。

## 布陣與儲存契約

- `FourSymbolsBattlefieldSlots` 的六個我方格位與 V131 既有 Formation（布陣）面板是唯一布陣系統。
- 首頁布陣入口必須載入並開啟正式面板；交換／前後排調整後透過既有 `saveGame()` 與帳號存檔 owner 持久化。
- 不得建立未連動正式 party formation state（隊伍站位狀態）的第二套視窗。

## dev → main 發布契約

- `main` 只代表已在 `dev` 通過驗證的發布內容，不是獨立開發線。
- dev → main 發布檢查若發現 Bug，必須從最新 dev 建立新的 `fix/` 分支，修復並以 PR（合併請求）回 dev；CI（持續整合）通過且 dev 合併後，才可重新執行 main 發布檢查。
- 禁止只在 main、發布 PR 的 head（前端提交）或發布暫存分支修一份 dev 沒有的程式差異。
- 永遠維持：`main ⊆ 已驗證 dev`。若 `main = dev + 獨立修復`，發布必須停止。

## 玩家正式版本通知契約

- `release/release.json` 是工程用 Game／Cache Version 唯一來源；`release/release-update.json` 是玩家可見 `releaseVersion`、`noticeId`、標題、摘要、完整更新內容、發布時間、`normal / forced`、`minimumVersion` 與 `publicNotice` 的唯一來源。三個玩家入口（線上跑馬燈、首頁／首次登入公告、Update Detail Modal）必須讀同一份資料。
- `release-manifest.json` 記錄部署 Commit SHA 與驗證，僅供部署核對；不得拿 Git SHA 當玩家版本或公告唯一識別。
- `js/release-update-notification.js` 在 startup ready 後檢查一次，之後每 4 分鐘、頁面回到前景與網路恢復時以節流方式檢查。請求必須 cache-bust 並採 `cache: no-store`；失敗安靜略過，不能阻塞登入或遊戲。
- 玩家每次新的登入工作階段進入主城後，當前正式版本公告必須自動顯示一次；`last-seen` 只控制已讀／通知狀態，不得永久阻止後續登入公告。公告底部固定提供「今日不再跳出提醒」checkbox（勾選框）；勾選後只以 per-UID `localStorage` sidecar 記錄當地日期＋目前 `noticeId`，同一帳號／同一公告僅當日停止自動跳窗。隔日必須重新顯示；同日若 `noticeId` 改變，新公告仍必須顯示。此設定不得寫入 Cloud Save、UID、金幣、背包、裝備或任何權威遊戲資料。
- 一般更新只通知、可稍後更新；玩家點「立即更新」時才 reload。強制更新在安全狀態顯示不可略過的既有共用 Modal；若正在高風險操作，只標記 pending，完成後才鎖定後續操作，絕不半途 reload。
- 安全 reload 的唯一判斷為 `canSafelyReloadForUpdate()`：戰鬥／戰鬥演出或結算、獎勵、背包交易、合成／冶煉／商店高價值視窗、帳號存檔寫入與已登記的 critical operation 均為不安全。未來任何非同步雲端寫入或高價值 transaction 都必須使用 `beginCriticalOperation()` 登記其生命週期。
- 每次 dev → main，除非專案負責人明確說「本次不公告」，發布 owner 必須自行從實際 `main...dev` 全量 diff 整理所有玩家可感知變更，再更新同一份正式 manifest；純文件、CI、開發工具或完全玩家不可見的內部修改才可以不公告。
- DEV／本機驗收可在精確允許 host 加上 `?releaseUpdatePreview=marquee`（點擊跑馬燈再看視窗）或 `?releaseUpdatePreview=modal`（直接看視窗）。預覽仍只讀正式 manifest，不能寫 localStorage 已讀紀錄、不能 reload，且正式 `main` host 必須完全忽略該 query。Preview Modal 不得顯示「立即更新」造成可更新假象，主要動作固定使用「關閉預覽」或等價明確語意。
- 禁止 rebase（變基）、force push（強制推送）或直接修改 dev／main。


## Battle Presentation Final Contract (2026-09-27)
- Relic Target Focus uses Foreground Projection: only Geometry Owner-provided transparent artwork plus data-driven HP and SP resource projections are rendered above the document-level dim layer. Resource projections contain rect and runtime ratio data only; they must not clone HUD HTML, show numbers/name/status, mutate live-unit z-index, use a rectangle aperture, or own geometry.
- Floating feedback remains the sole transient-text owner. Critical format is `💥 N`; status capsules are black with white text and retain `statusType` only as semantic metadata.
- A live V143 impact is scheduled as one target-plus-`impactId` batch. Its requests register before the batch flushes and sort Shield → Damage/Critical/MISS/Resist → Status. Synthetic feedback without an `impactId` stays on the normal queue; clear cancels every pending batch.
- Persistent state Gate returns a reason. `sameNameDuplicate` is a silent reject before hit rolling or mutation; `exclusiveConflict` (Freeze/Petrify) emits formal status MISS; resistance remains distinct.
- Skill-name presentation derives color from `skill.element` through `data-skill-element`; character element must not participate. It is a document-level fixed viewport surface and shares the ordinary floating-feedback visual font size.

## Battle Reading Layer Contract (2026-10-01)

- `body.v174-battle-reading-open` is the sole semantic owner for Battle Reading Surface state. It is active while Battle Info, Battle Statistics, Boss Mechanism or Battle Status Detail is visibly open on the active battle page; the last surface closing, battle teardown or page navigation must remove it.
- While that state is active, every Document-Level Transient Battle Presentation (including skill VFX/Sprite Sheet, skill name, damage/heal/SP/critical/MISS/resist/status feedback, detached popup compatibility surfaces and the complete Team Relic cinematic/dim/target projection/VFX presentation) must suppress paint and must not cover reading UI. The in-stage relic banner follows the same transient-paint rule.
- Reading state never pauses or cancels Battle Simulation or presentation lifecycle. Hit frames, damage, status, healing/SP settlement, relic triggers, action completion and turn queue continue normally; hidden presentations expire on their original timeline and must not replay when the final reading surface closes.
- A z-index comparison between elements in different stacking contexts is not sufficient evidence that a Battle Reading Surface paints above document-level VFX. Regression verification must assert the semantic reading state and computed transient-paint suppression while lifecycle completion continues.

## Six-Stat Combat Attribute Convergence（2026-09-30）

本節為正式六圍、戰鬥能力與防禦 Owner（控制來源）的最新契約；若歷史段落與本節衝突，以本節為準。

- 正式六圍唯一為：Attack（攻擊）、Intelligence（智力）、Vitality（體質）、Energy（能量）、Defense（防禦能力值）、Agility（敏捷）。Spirit（精神）不再是六圍。
- Attack：每 1 點 +4 Physical Attack（物理攻擊），只負責物理攻擊。
- Intelligence：每 1 點 +2.75 Magic Attack（法術攻擊），並由同一 Intelligence Owner（智力控制來源）支援 Healing（治療）。
- Vitality：每 1 點 +50 Max HP（最大生命值）；不再提供 Defense。
- Energy：每 1 點 +15 Max SP（最大能量值）；不再提供命中、回復或速度。
- Defense：以 defensePoints 作為唯一可分配防禦能力來源，每 1 點 +4 Final Defense（最終防禦）。最終防禦為 Base Defense + Level Defense + Defense Attribute × 4 + Equipment Defense + Buff／Passive modifiers − Debuff modifiers。
- Defense 對 Physical Damage（物理傷害）與 Magic Damage（法術傷害）共用同一減傷 Owner；遞減因子維持 K / (K + Defense)，其中 K = 400 + Target Level × 10。
- Agility：每 1 點 +1 Speed（出手速度）；不得派生 Evasion（閃避）。
- `agilityDown` 與六圍 `statDown` 對敏捷的影響只改變 Speed；不得改變 Evasion。閃避變化必須由獨立 Evasion 詞條或明確技能／狀態效果提供。
- Accuracy（命中）、Evasion（閃避）、Critical Chance（爆擊率）、Anti-Crit（抗暴）、Status Accuracy（異常命中）、Status Resistance（異常抗性）不得由六圍直接派生，只能由 Equipment、Gem、Skill、EX、Relic、Buff／Debuff 或 Passive 提供。
- 舊存檔的 Spirit 投入點數必須透過正式可分配能力點池返還；不得轉成 Defense，不得遺失，不得以永久 Legacy Runtime Patch 保留舊公式。舊 Vitality 點數保留，但新版統一不再提供 Defense。
- 舊裝備／重鑄 Spirit 詞條一次遷移為獨立詞條，按既有數值語意映射：每 1 點轉為 Accuracy +0.3%、Anti-Crit +0.1 個百分點、Status Resistance +0.05 個百分點；不轉成六圍，也不改動其他裝備詞條。遷移涵蓋已裝備、背包與重鑄詞條。
- Physical Skill Elite/Boss Rank Bonus（物理技能精英／Boss 階級固定傷害加成）正式 RETIRED；相關常數與函式不得存在或被 Runtime、Tests、Skill Description 引用。
- Character、Additional Character、Monster、Preview、Save／Load、Cloud Save、Equipment、Buff／Debuff 與 UI 必須使用同一套六圍語意；Monster 的命中、閃避與異常能力若存在，必須是獨立 Monster Combat Stat，不得假裝由 Spirit 或 Agility 派生。

## Hit / Evasion Percentage-Point V2（2026-10-02）

- Base Hit Chance = 95%；Base Extra Accuracy = 0%；Base Evasion = 0%。Accuracy 10% 直接令 Final Hit Chance +10%；Evasion 10% 直接令 Final Hit Chance -10%。同一 Hit Owner 最後 clamp 5%～99%，Wind EX 低血量特殊上限 50% 保留。等級與等級差不影響 Hit / Evasion；普通／精英／Boss 不因等級派生閃避。風系四象塔明確 +8% 保留。
- 四象鎧甲／袍 Base Evasion +10%，同系列 3 件套額外 Evasion +2%；其他能力不變，不新增普通裝備／重鑄詞條池。
- 裝備單位遷移唯一 Owner：`functions/src/equipment-combat-percent-migration.js`；App Shell 在主 Runtime 前載入，同一實作供後端 review projection 使用。`equipmentCombatPercentUnitVersion:2` 是每件裝備的單位標記，stats/reforgeStats 一起原子遷移且重複載入不再換算。
- 開工 dev 所有正式裝備 Accuracy 來源只有四象 armor/robe Base 10 與 V1 Spirit mapping；沒有普通生成／重鑄 Accuracy pool。無版本裝備先分離明確四象 Base 10→Evasion 10，剩餘舊 Equipment Accuracy 按 legacy point unit ×0.15 換算；尚存在 Spirit 時每點直接 +0.3% Accuracy/+0.1% Anti-Crit/+0.05% Status Resistance，再移除 Spirit。新定義／生成装備明確標记版本 2。不得將此遷移用於角色、怪物、技能或 Buff Accuracy。
- 本機／雲端 snapshot 經既有 hydrate/normalize 入口投影；候選與原始 Archive 的 raw bytes、hash、UID、revision 與信任狀態不改寫。後端 review ownedItem 只對副本遷移，不授予權威、不修改原始證據。
- 鎮魂古鐘命中 -5/-8% 是 Relic Final Hit Reduction Source，依 bossDebuffEfficiency 計算後與暈眩相加，既有期限與清理 owner 保留，禁止乘算 monster.accuracy。

- Relic Evasion 只由 `v174GetRelicFinalEvasionPercent(index)` 提供來源值，`getMainCharacterStats`／`getAdditionalCharacterBattleStats` 的既有 Evasion 加總一次結算並一起處理 Frostbite。Relic stats decorator 不得再次改寫 Evasion；隊伍 getter 委派角色 getter 後不得雙加。

## Four Symbols Tower Challenge Profile（四象塔挑戰特性）

- Common Skill Frequency 與 Element Profile 分離，唯一塔 Owner 是 `gameplay-boss-tower-system.js`。1～30 層 65%、31～60 層 70%、61～90 層 75%、91～100 層 80%；Regular／Elite／Tower Boss 相同，canAct=false 機制物件排除。火塔舊額外 +8 Skill Chance 退休。
- Skill Chance 是輪到可行動且有合法可負擔技能時進入技能決策的機率，不是技能命中率。Tower attack/heal/support/control 只能共用一次 roll；正式 `FourSymbolsEnemySkillAI` 與 V144 合法技能 Guard 選招，不增加第二套 AI。
- Fire：最終爆擊 +15 個百分點，遵守 Crit Cap；自身普通攻擊與直接物理／法術技能傷害 ×1.15。DoT／Burn／Reflect／Relic／Boss Object／HP Cost／Self Damage／Environment 排除。Damage Owner 只套用一次塔 direct modifier。
- Water：合法 Heal／Support／Freeze 技能決策偏輔助；友軍 HP <70% 優先治療。HP Healing ×1.15，SP 回復不加成。最新正式水系無獨立 Buff，沿用 Heal Support 及 Freeze，不引入跨元素 Buff 或新控制狀態。
- Water Status Accuracy +15 個百分點適用 Soft／DoT／Hard Control。先加入 `calculateStatusEffectChance` 正式公式，最後 Clamp：一般 Status 5～95%；Player→Regular 5～90%、Elite 5～75%、Boss 5～60%；Enemy→Player Hard Control 5～60%，與施放怪物 rank 無關。30+15=45；52+15=67→60。
- Wind：最終 Evasion +15 個百分點（不另設上限）；Agility／Speed ×1.15，只影響速度，不增加 Evasion 或 Accuracy。
- Earth：Defense ×1.15、Max HP ×1.15、建立時 hp=maxHP，Profile 同場冪等，不在 render/reload/round 疊加。
- Profile 僅套 Tower metadata；其他玩法的敵人数量、技能頻率與戰鬥數值保持既有規則。入口顯示當週元素特性、樓層施放率與每層固定 10 名敵人。
