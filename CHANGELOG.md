# 四象江湖傳版本紀錄

## V173.63 — 2026-09-07

本版本收錄自 V173.62 之後，已完成自動化測試、DEV 部署、手機實機驗證與正式 main 發布驗證的修正。

### 合成／裝備／副本 UI
- 冶煉材料階級改為橫向滑動排列，避免內容被向下擠壓裁切。
- 裝備冶煉與材料合成內頁支援完整垂直捲動，可滑至最底部。
- 材料合成移除瀏覽器原生下拉選單，改為《四象江湖傳》黑金／階級色自訂選單。
- 材料合成圖片縮小，釋放下方設計圖升階操作空間。
- 裝備合成與符咒合成首次開啟即顯示正式 icon，不再需要先點擊一次。
- 背包装備比較改為同部位雙欄比較，修正武器／頭部／鞋子等槽位錯配與「明明已裝備卻顯示未裝備」。
- 裝備比較重新分隔 icon、數值與穿戴／售出／鎖定操作區。
- 副本獎勵預覽框加高，長文字不再穿出框或壓到背景圖片。

### 全域 UI／手機操作
- 全遊戲禁止雙指 pinch zoom，同時保留合法的單指上下／左右捲動。
- 全遊戲圖片、SVG、Canvas 等視覺素材禁止長按叫出下載、分享、Google Lens、開新分頁等瀏覽器原生選單。
- 禁止遊戲視覺素材原生拖曳與非輸入區文字選取，避免破壞手遊操作感。

### 戰鬥／技能動畫
- 修復技能 VFX 偶發或整體不顯示問題。
- 恢復玩家與怪物技能 badge 對 V142 動畫 runtime 的 direct trigger，不再依賴容易被後載入程式覆蓋的 wrapper 順序。
- V142 支援 partial-sentinel recovery：若只留下 installed 旗標但 director／trigger 不完整，會重新建立動畫 runtime。
- 移除 V173.51 QA 對 V143 VFX stage visibility 的錯誤 ownership，避免技能名稱／傷害出現但特效舞台被隱藏。
- 新增永久 regression，防止未來再次退回 wrapper-only 導致技能動畫失效。

### 系統／發布安全
- 正式移除巡怪省電模式舊 DOM、handler、設定 key 與相容性 WakeLock 殘留。
- Release Gate、Requirement Checklist、deprecated-code assertion、DEV exact-SHA deploy 與部署後 SHA/version/cache read-back 已實際運作。
- 正式版本升級現在必須同步更新本 CHANGELOG；沒有對應版本紀錄時 CI 會拒絕發布。

### 對應 Requirement Batches
- `2026-09-07-synthesis-dungeon-equipment-ui`
- `2026-09-07-synthesis-vertical-scroll`
- `2026-09-07-synthesis-first-render-icons`
- `2026-09-07-global-ui-gesture-vfx-lock`
