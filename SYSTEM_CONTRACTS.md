# 《四象江湖傳》System Contracts / 系統契約

本文件定義跨模組、跨版本都必須維持的正式系統契約。若歷史註解、測試、交接或舊功能卡規格與本文件衝突，以本文件與最新需求批次為準。

## 戰鬥目標契約

- 一般戰鬥維持 `single / tri / row / column / all` 的 Fixed Slot（固定格位）規則。
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

## VFX 與回合流程契約

- V142 只擁有視覺生命週期與剩餘時間；V143 只擁有 raster VFX（點陣視覺特效）渲染與幾何。
- `00-main.js` 是 `finishPlayerAction()` 與 `processNextCombatant()` 唯一 owner。功能模組不得替換這兩個函式，也不得以 Promise（非同步承諾）阻塞回合佇列。
- 功能模組需要觀察或暫時攔截完成通知時，只能使用 `FourSymbolsBattleFlow` 的訂閱／攔截 API（應用程式介面），並確保攔截器可解除。
- single 的中心是實際目標格；tri 即使只剩一個單位也保留三人格視覺尺寸；all 永遠保留完整目標側範圍；projectile（飛行技能）從施放者中心飛向正式主要目標中心。
- DOM 例外、MISS（未命中）、Buff（增益）、Heal、Shield、Debuff（減益）與 VFX 清理都不得讓同一 initiative（行動序）永久等待。

## 布陣與儲存契約

- `FourSymbolsBattlefieldSlots` 的六個我方格位與 V131 既有 Formation（布陣）面板是唯一布陣系統。
- 首頁布陣入口必須載入並開啟正式面板；交換／前後排調整後透過既有 `saveGame()` 與帳號存檔 owner 持久化。
- 不得建立未連動正式 party formation state（隊伍站位狀態）的第二套視窗。

## dev → main 發布契約

- `main` 只代表已在 `dev` 通過驗證的發布內容，不是獨立開發線。
- dev → main 發布檢查若發現 Bug，必須從最新 dev 建立新的 `fix/` 分支，修復並以 PR（合併請求）回 dev；CI（持續整合）通過且 dev 合併後，才可重新執行 main 發布檢查。
- 禁止只在 main、發布 PR 的 head（前端提交）或發布暫存分支修一份 dev 沒有的程式差異。
- 永遠維持：`main ⊆ 已驗證 dev`。若 `main = dev + 獨立修復`，發布必須停止。
- 禁止 rebase（變基）、force push（強制推送）或直接修改 dev／main。
