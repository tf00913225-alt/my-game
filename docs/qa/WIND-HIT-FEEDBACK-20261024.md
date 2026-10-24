# 暴風亂擊 hitFeedback 樣板

Work ID: `WIND-FLURRY-SAMPLE-20261024` · PR #989 · 原分支續接。

## Owner 與範圍

`js/39-v143-skill-animation.js` 檔首 `installHitFeedback` 是 V143 的呈現工具模組，公開 `window.FourSymbolsHitFeedback`。放在原來源檔內，保留 production script order 與其安全 policy，不建立第二套 renderer、Combat Owner 或載入器。

只預設啟用 `stormFlurry`。原素材、正式目標、傷害／SP／狀態結算、750ms命中點、1500ms gate、定案大小與敵方景深不變。非直接傷害、MISS、無效身份與 reduced-motion 不觸發新增 hit stop／shake。沿用原致死 Overlay 身份與快照。

## Config 與開關

所有可調手感數值集中在同檔首 `CONFIG`，`defaults` 與 `skills[skillId]` 合成每次 cast 的快照。

```js
const feedback = window.FourSymbolsHitFeedback;
feedback.setEnabled(false); // 關閉；恢復在途停頓、取消震動，既有flash自然完成
feedback.setEnabled(true);
feedback.config.skills.stormFlurry.enabled = false; // 該技能下次cast停用
feedback.config.skills.stormFlurry = {
  enabled: true,
  stopFrames: 3, fps: 60,                 // 50ms，visual-only
  shakePx: 6, decay: .85,
  shakeSteps: 12, stepMs: 16,
  referenceDamage: 168,
  minDamageScale: .35, maxDamageScale: 2,
  brightness: 2.5, flashMs: 80,
  hitFrameMultiplier: 2,
  frameDurations: [1,1,1,1,1,1,1,1,1,1,1,1],
  blendMode: 'screen', poolLimit: 24
};
```

`frameDurations` 可填每幀希望的停留時間（毫秒權重），前／後半段先依原命中邊界配置；命中幀原始配額再乘 `hitFrameMultiplier`（預設125→250ms），其餘命中後幀分配剩餘時間。過大的倍數至多用完後半段，不能延長技能結算。未填者等權重。Hit Stop 使用有界恢復timer，不暫停Core／回合clock；cast視覺軌道恢復後略加速，在原deadline結束。已暫停或完成的動畫不會被擅自播放。一次範圍命中只震動／停頓一次，依第一個有效recipient的實際HP損失縮放，避免三目標疊震。

Sprite以整張sheet在裁切viewport內做離散transform，取代此樣板原background-position track；原Envelope仍僅transform／opacity。Hit Flash用原Overlay複製正式立繪，靜態brightness(2.5)加opacity80ms；screen只套本樣板Sprite／Flash。未新增filter tween、Canvas或其他技能改動。

## 介面

| 介面 | 用途 |
| --- | --- |
| `config` / `configFor(skillId)` | 單一設定來源／經範圍校驗的技能快照 |
| `setEnabled(boolean)` | 全域開關，關閉時清理停頓與震動 |
| `create(skillId)` → `{config,pooling,hit,dispose}` | 由V143每cast建立，沿原生命週期清理 |
| `hit({key,damage,roots})` | V143 committed-hit回呼唯一入口，去重／傷害縮放 |
| `frameTrack(sprite,config,hitRatio)` | 保留命中邊界的transform離散keyframes |
| `acquire(kind)` / `release(kind,node,limit)` | Sprite viewport、sheet與Flash節點池；取消動畫、清屬性與引用 |
| `disposeAll()` / `poolSize(kind)` | 換場／關閉清理及唯讀池大小診斷 |

玩家設定與存檔沒有新增欄位。console調整是當次session，下次cast生效；持久預設需修改CONFIG並經原PR Gate。

## 驗證與限制

- focused module regression：開關／MISS、50ms、保留原pause、傷害震幅與.85衰減、deadline、減少動態、dispose、逐幀權重與transform-only、池重用與上限。
- 原Wind27、Fire15、raster Owner9，以及原直接命中Overlay／cold clock／impact tests保留。
- 完整production bundle之本機Chrome、手機viewport隔離帳號：真Core普通命中168×3、暴擊239×3、MISS全0、關閉模組168×3；各場SP消耗一致。觀察到WAAPI pause／追時、80ms brightness／screen、單一換幀Owner、真節點重用；Hit Stop途中dispose清掉stage／Flash／shake與sheet animations。
- 最終原始證據：`C:/Projects/my-game/.vfx-work/wind-flurry-sample/artifacts/wind-hit-feedback-final-browser/evidence.json`，相鄰PNG；可見技能實際影像 `frame-0037.png`。QA使用原pause/finish intercept與標示的固定RNG，不操作真玩家存檔／獎勵。
- 125→250ms配額精確化後的最終bundle補驗：`C:/Projects/my-game/.vfx-work/wind-flurry-sample/artifacts/wind-hit-feedback-dwell-final-browser/evidence.json`，只補普通／MISS、真pool重用與stop中dispose。此輪先等待正式登入遮罩自然關閉再測，不改boot或Chrome期限；前一輪暴擊／關閉證據保留引用。測試來源與證據摘要hash記於同名JSON報告。
- 這是Chrome手機viewport驗證，**不是新增手機實機錄影或人類美術定案**。初場測量時登入頁短暫遮住底層戰場，後續暴擊／MISS／關閉場及中斷驗證可見；不把該初場截圖當可見美術驗收。舊b755手機影片只證明前一個樣板，不背書本次新增回饋。
- CI須綁最新提交Head；PR body保存當前run／狀態。仍為單技能Draft，沒有擴改其餘風系或自動部署。

## 本輪檔案

- `js/39-v143-skill-animation.js`：檔首模組／CONFIG及原Owner接入。
- `css/40-v143-combat-dungeon-polish.css`：原換幀animation名稱可由此樣板替換；其他技能fallback原名稱。
- `tests/battle-hit-feedback.test.js`：focused回歸。
- `SYSTEM_CONTRACTS.md`：只記錄此樣板的呈現例外與原安全邊界。
- `docs/qa/WIND-HIT-FEEDBACK-20261024.md`／同名JSON：介面、證據及限制。
- 原builder重建：`build/gameplay-core-primary.7eacee2ddb19.js`、`build/gameplay-core.ce00a5646973.css`、`asset-manifest.json`、`build/asset-manifest.json`；移除原對應hash檔。builder與載入順序無變更。
