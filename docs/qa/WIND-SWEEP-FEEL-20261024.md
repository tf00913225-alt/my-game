> 後續版本：使用者已授權自動規則與四種樣板；目前設定、分層與新增數字請見 [自動技能特效說明](AUTOMATIC-SKILL-FEEDBACK-20261024.md)。本頁的原數字表仍有效，下面舊checkpoint／單畫布測量保留為歷史證據，不能代替最新PR Head。

# 暴風亂擊：橫掃風感候選

Work ID：WIND-FLURRY-SAMPLE-20261024／原 PR #989。只加強暴風亂擊，候選版尚待手機與人類美術驗收；最新結果以 PR body 為準。

## 進遊戲怎麼看

更新到這個候選版後，用已學會並裝備「暴風亂擊」的角色進入普通戰鬥，選「技能 → 暴風亂擊」，再選敵方一排。有三名敵人時最容易看出左、中、右的節奏；只剩一或兩名時只顯示實際目標，Boss仍遵守原本單一實際目標規則。

起手有同方向風屑與葉片，三次命中相隔約0.1秒，青白爆裂、衝擊圈與尾跡依序出現。右側最後一下較重，伴隨短而淡的畫面閃光。削弱成功才有向下氣流圈及原本的小圖示；圖示跟實際狀態保留／消失。

正式最終平衡表維持50%基礎機率、2回合。這次不更動機率計算、傷害、消耗、目標、回合或大小／景深；較早只讀基礎表得到1回合的說法已更正，使用者確認保留現行2回合。

## 一份設定就能調

檔案：`config/battle-vfx-feedback.json`。`defaults` 是共同預設，`skills` 裡的暴風亂擊設定優先。只改這份數字再正常建置，會一起帶入遊戲，不需逐處找動畫數字。

| 設定 | 調大會怎樣／調小會怎樣 |
| --- | --- |
| `enabled`／技能內 `enabled` | true開、false關；關閉回到原特效，不影響傷害 |
| `sweepEnabled` | 開啟橫掃與風屑、葉片等加強；關閉保留基本命中回饋 |
| `stopFrames`（3）、`fps`（60） | 停頓為前者除以後者；增加幀數更頓，增加fps則停得更短；預設約0.05秒 |
| `sweepGapMs`（100） | 大：三下分得更開；小：更密、更快。只改視覺，最多150毫秒 |
| `hitStrength`（0.72／0.92／1.25） | 對應左、中、右。大：震得較重、碎屑飛較遠、命中停留較長；小：較輕 |
| `shakePx`（4） | 大：畫面晃較明顯；小：較穩 |
| `referenceDamage`（168） | 大：相同傷害震得較小；小：較容易震強 |
| `minDamageScale`（0.35）、`maxDamageScale`（2） | 控制低／高傷害震動的最小／最大倍率，避免完全感覺不到或過度晃動 |
| `decay`（0.85） | 接近1：震動留較久；接近0：很快收住 |
| `shakeSteps`（8）、`stepMs`（12） | 步數或每步時間增加，震動較久；減少更俐落 |
| `brightness`（2.5）、`flashMs`（80） | 敵人閃光的亮度與毫秒數；大：更白／更久，小：較淡／較短 |
| `hitFrameMultiplier`（2） | 大：命中畫面停留較久，其餘尾幀會分配剩餘時間；小：收得快，不延長技能總長 |
| `frameDurations`（null） | null維持預設。可填12個各幀時間權重；某格越大，該格相對停久，仍保留正式命中邊界與總長 |
| `windCount`（10）、`leafCount`（5） | 大：風屑／葉片較密；小：較乾淨，也較省效能 |
| `burstCount`（6） | 每次命中的青白碎屑數量；大更熱鬧，小更清爽 |
| `maxEffectNodes`（48） | 同時保留的裝飾節點上限；小較省效能，大容許較密。硬上限48，不會無限增加 |
| `canvasDpr`（1.5） | 這次特許粒子層的清晰度；大較細緻但較耗能，小較省。只影響粒子，不縮小角色，限制1～2 |
| `poolLimit`（48） | 可保留重用的節點數；大可減少重建，但用較多記憶體；小少留一些備用節點 |
| `colors` | 依序青綠、淡白、深青綠；換色會一起影響風屑、碎屑、尾跡與圈，不改其他技能 |
| `blendMode`（plus-lighter） | 加亮混色；不支援時自動使用screen。兩者都維持透明背景，不增加遮擋 |
| `glowPx`（3）、`glowBrightness`（1.18） | 大：邊緣光暈較寬／本體較亮；小：輪廓較銳利／較淡 |
| `particleOpacity`（0.76） | 大：風屑葉片更實、更明顯；小：較透明 |
| `windMs`（900） | 大：風屑橫掃較慢；小：較快掠過 |
| `windSize`（2）、`leafSize`（7） | 大：風屑或葉片較大；小：更細碎 |
| `windSpread`（0.6） | 大：上下散得較寬；小：集中成較窄風帶 |
| `trailLength`（1.8）、`trailWidth`（2） | 大：尾跡較長／較厚；小：較短／較細 |
| `trailMs`（460） | 大：尾跡淡得較慢；小：更快收尾，最多500毫秒 |
| `burstMs`（300）、`burstRadius`（0.6） | 大：碎屑留較久／飛較遠；小：短促／集中 |
| `shockwaveMs`（380）、`shockwaveScale`（1.45） | 大：圈擴得較久／較大；小：短而緊 |
| `screenFlashOpacity`（0.09）、`screenFlashMs`（90） | 最後一下的畫面閃光；大：較亮／較久，小：較淡／較短。亮度最多0.15 |
| `weakenMs`（420）、`weakenDrop`（0.5） | 成功削弱時，氣流圈下沉的時間與距離；大：較慢／沉較遠，小：較快／較短；不會改持續回合 |

太大的值會被安全上限限制，避免粒子塞滿畫面或動畫超過原技能時間。減少動態效果的裝置設定仍有效。

## 工程驗證紀錄

- 唯一VFX Owner仍為js39。使用者在DOM實機長幀證據後明確允許「這次獨立粒子層例外」：同一stage只有一張可回收Canvas2D畫布，繪製風屑／葉片／burst／圈／trail；短screen flash保留DOM opacity，技能本體、受擊立繪Flash、持續status icon仍走原DOM。沒有額外版型／縮放器／傷害管線，也不為其他技能建立Canvas fallback。
- config由原builder嵌入原js39唯一marker；正式script順序不變，沒有新增runtime請求或boot等待。
- 原target timer投影依實際螢幕x排序為750／850／950ms，Core HP／狀態同步結算不變，gate維持1500ms；每個目標有自己的settled狀態，避免第一下提前釋放後兩個回呼。
- 成功氣流圈必須同時有正式applied-status追蹤及當前真實damageDown；小圖示沿用原status Owner，沒有自建2回合計時器。
- focused module9／Wind29／原Fire15／raster9及原impact／cold-clock等回歸保留。獨立審核與原始瀏覽器／手機證據在PR body續記，不把舊cf5影片當成本版證明。
- 初次完整bundle Chrome證據：`artifacts/wind-sweep-candidate-browser/evidence.json`。成功／未成功／混合正式狀態補驗：`artifacts/wind-sweep-status-browser/evidence.json`，隔離QA僅注入判定RNG，仍呼叫原正式判定與Core，未修改產品資料或存檔。
- 部署與最新Head CI只依原PR即時狀態；合併前仍需必要Gate與此樣板的人類美術確認。

### 實機效能直接相依

使用者看過直接手機證據後明確允許共用戰鬥效能排查，版型／大小／景深／玩法不變。

- 首輪JS RAF有長幀，baseline關閉效果也約66.8ms p95，降低粒子無法消除。初步CPU取樣落在js38::fitEnemyBars，cache試驗仍未解決；該cache與FontFaceSet事件已移除，不把改善誤稱整場PASS。
- 更精確的正式CSS證據：Fixed Slot V2 ordinary敵方exact resource文字本來就是1px/clip50%的accessibility相容節點。現在只在獨立正式HUD／FixedSlot頁面／非gameplayBoss時略過舊縮字；可見legacy/Boss保留完整原13→11px／最低.82比例算法。3個focused tests涵蓋zero style writes、負對照與字體變窄仍回13px。
- 排除建場後的播放CPU取樣 `artifacts/wind-sweep-phone-play-profile/cpu-profile.json` 顯示主要幾何讀取來自syncHud，2.3秒LayoutCount229／Recalc390。原HUD每次都把同父節點重搬，再讀下一個單位位置；同父去重對照降至LayoutCount134、LayoutDuration.126→.050秒。最終再分成準備語意→全部量位置→全部更新，僅在目前DOM順序不同時insertBefore，保留原順序／同節點／事件。原函式測試確認穩態zero moves、量完才搬、重建順序。
- 取樣與診斷保留：`artifacts/wind-sweep-phone-cpu-diagnostic`、`wind-sweep-phone-ab-diagnostic`、`wind-sweep-phone-fit-cache-probe`、`wind-sweep-phone-hidden-fit-probe`、`wind-sweep-phone-fit-owner-probe`、`wind-sweep-phone-play-profile`、`wind-sweep-phone-hud-dedupe-probe`。這些是不同邊界／來源快照，不能交叉當最新CI或影片證明。
- JS RAF排程不是compositor呈現FPS。解析Android原片PTS：舊cf5約51.5fps／p95 33.5ms、新4f約47.1fps／35.6ms、7eaf約46.0fps／35.2ms；所有舊結果保留，均有偶發長幀，不宣稱鎖60或整場零卡頓。最終實機原片與兩種量測在PR body／相鄰movie-proof記錄。

### 單一粒子畫布例外

只取代本樣板新加的DOM裝飾，沒有改原Sprite Sheet或角色動作。最多48個粒子物件與1張畫布，物件／畫布重用；混色使用lighter，外層沿設定plus-lighter／screen。僅有visual RAF，不得推進Core／目標／狀態／回合。Hit Stop同步凍結粒子年齡；若兩次命中間沒有RAF，會先結算上一停頓區間，避免漏扣50ms。screen flash與原80ms立繪Flash保留各自短時長。原1500ms deadline與dispose／hidden／supersede立即清粒子、取消RAF、清畫布像素並detach，不延長Gate。持續小圖示仍由原正式狀態Owner管理。

粒子層只覆蓋橫排及其尾跡淨空；每種尺寸／顏色／光暈先畫成快取圖，再以位移、旋轉、縮放、透明度呈現，避免逐幀模糊。快取最多64項，粒子仍最多48；不引入Worker或改安全政策。

最新USB候選證據：artifacts/wind-sweep-canvas-row-phone/native-preview.mp4 與 evidence.json、video-frame-pacing.json。真Core部分削弱／暴擊／未削弱／MISS與清理PASS。原片16秒753幀，整段平均約47fps、幀間隔p95約35.4ms、最大68.0ms；包含等待段，不宣稱鎖60或完整戰鬥效能PASS。主執行緒RAF仍有長間隔，與錄影呈現FPS分列。相較全屏快取候選41.2fps／最大219ms改善，但不同時間錄製，非精準硬體基準。人類美術／節奏與最新Head CI仍待驗收。
