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

- 唯一VFX Owner仍為js39；同一stage承接有界DOM裝飾，沒有Canvas、額外版型／縮放器／傷害管線。
- config由原builder嵌入原js39唯一marker；正式script順序不變，沒有新增runtime請求或boot等待。
- 原target timer投影依實際螢幕x排序為750／850／950ms，Core HP／狀態同步結算不變，gate維持1500ms；每個目標有自己的settled狀態，避免第一下提前釋放後兩個回呼。
- 成功氣流圈必須同時有正式applied-status追蹤及當前真實damageDown；小圖示沿用原status Owner，沒有自建2回合計時器。
- focused module7／Wind29／原Fire15／raster9及原impact／cold-clock等回歸保留。獨立審核與原始瀏覽器／手機證據在PR body續記，不把舊cf5影片當成本版證明。
- 初次完整bundle Chrome證據：`artifacts/wind-sweep-candidate-browser/evidence.json`。成功／未成功／混合正式狀態補驗：`artifacts/wind-sweep-status-browser/evidence.json`，隔離QA僅注入判定RNG，仍呼叫原正式判定與Core，未修改產品資料或存檔。
- 部署與最新Head CI只依原PR即時狀態；合併前仍需必要Gate與此樣板的人類美術確認。

### 實機效能直接相依

首輪4f實機功能正確，但全段RAF p95約33–67ms，不能稱流暢PASS。去除逐幀DOM量測／錄影後，baseline關閉效果仍約66.8ms，完整與低粒子設定約100.2ms；減粒子沒有解掉瓶頸。CPU取樣主要落在原js38::fitEnemyBars的重複文字縮字排版，原始證據 `artifacts/wind-sweep-phone-cpu-diagnostic/cpu-profile.json`（4f bundle11157）。因此只在原函式加WeakMap跳過相同文字／寬度／字形寬度／inline style的重算，保留原13→11px與最低.82比例算法；文字、容器、外部樣式及FontFaceSet loadingdone/loadingerror世代改變會失效。沒有改字級、版型、數值或其他技能。

新增3個focused測試包括真scrollWidth下限與字體載入後應恢復13px的案例，獨立審核修正原字體失效缺口後通過。一次有界實機cache probe中效果開啟p95約50.2ms（baseline66.9ms），只有改善證據，仍非整場完全無長幀保證。最終手機錄影／完整與播放窗口幀時間以PR body及相鄰raw report為準；保留所有較早結果，不覆寫為PASS。
