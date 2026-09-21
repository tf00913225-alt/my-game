# 四象江湖傳 VFX Asset Index

本索引記錄本批次由 `origin/assets-library` 的 `assets/inbox/技能icon/` 原始透明 PNG 轉換出的正式 Runtime WebP。原始 PNG 保留在 `assets-library`，正式 Runtime 不直接引用 `assets/inbox`。

## 技能釋放 Sprite Sheet

三張素材均保留原始 `1448×1086` RGBA 畫布、`4×3`、12 幀與 Alpha；未裁掉透明邊界、未重排影格。

| 技能 | 原始 PNG（assets-library） | 正式 Runtime WebP |
|---|---|---|
| 焚血訣 | `assets/inbox/技能icon/焚血訣 技能釋放.png` | `assets/vfx/fire/blood-burn-cast.webp` |
| 炎魂共鳴 | `assets/inbox/技能icon/炎魂共鳴 技能釋放.png` | `assets/vfx/fire/fire-soul-resonance-cast.webp` |
| 淨心訣 | `assets/inbox/技能icon/淨心訣 技能釋放.png` | `assets/vfx/water/purify-mind-cast.webp` |

## 持續狀態 Front / Back Sprite Sheet

所有正式檔案均為與來源相同尺寸的透明、無損 WebP；每張為 `4×2`、8 幀。Front 與 Back 使用相同畫布、影格索引與 Runtime 動畫時鐘。

| 狀態 | 原始 Front / Back PNG（assets-library） | 正式 Front WebP | 正式 Back WebP |
|---|---|---|---|
| 凍傷 | `凍傷 前景.png` / `凍傷 後景.png` | `assets/vfx/status/water/frostbite-front.webp` | `assets/vfx/status/water/frostbite-back.webp` |
| 岩盾 | `岩盾 前景.png` / `岩盾 後景.png` | `assets/vfx/status/earth/rock-shield-front.webp` | `assets/vfx/status/earth/rock-shield-back.webp` |
| 岩石壁壘 | `岩石壁壘 前景.png` / `岩石壁壘 後景.png` | `assets/vfx/status/earth/rock-wall-front.webp` | `assets/vfx/status/earth/rock-wall-back.webp` |
| 暴怒／怒火 | `暴怒 怒火 前景.png` / `暴怒 怒火 後景.png` | `assets/vfx/status/fire/rage-front.webp` | `assets/vfx/status/fire/rage-back.webp` |
| 殤風 | `殤風 前景.png` / `殤風 後景.png` | `assets/vfx/status/wind/damage-down-front.webp` | `assets/vfx/status/wind/damage-down-back.webp` |
| 氣定神閒 | `氣定神閒 前景.png` / `氣定神閒 後景.png` | `assets/vfx/status/wind/dodge-skill-front.webp` | `assets/vfx/status/wind/dodge-skill-back.webp` |
| 炎魂共鳴 | `炎魂共鳴 前景.png` / `炎魂共鳴 後景.png` | `assets/vfx/status/fire/fire-soul-resonance-front.webp` | `assets/vfx/status/fire/fire-soul-resonance-back.webp` |
| 焚血訣／焚血 | `焚血訣 前景.png` / `焚血訣 後景.png` | `assets/vfx/status/fire/blood-burn-front.webp` | `assets/vfx/status/fire/blood-burn-back.webp` |
| 燃燒 | `燃燒 前景.png` / `燃燒 後景.png` | `assets/vfx/status/fire/burn-front.webp` | `assets/vfx/status/fire/burn-back.webp` |
| 石化 | `石化 前景.png` / `石化 後景.png` | `assets/vfx/status/earth/petrify-front.webp` | `assets/vfx/status/earth/petrify-back.webp` |
| 破防 | `破防 前景.png` / `破防 後景.png` | `assets/vfx/status/earth/defense-down-front.webp` | `assets/vfx/status/earth/defense-down-back.webp` |
| 結界 | `結界 前景.png` / `結界 後景.png` | `assets/vfx/status/earth/barrier-front.webp` | `assets/vfx/status/earth/barrier-back.webp` |
| 萬象土盾 | `萬象土盾 前景.png` / `萬象土盾 後景.png` | `assets/vfx/status/earth/earth-shield-front.webp` | `assets/vfx/status/earth/earth-shield-back.webp` |
| 重力 | `重力 前景.png` / `重力 後景.png` | `assets/vfx/status/wind/agility-down-front.webp` | `assets/vfx/status/wind/agility-down-back.webp` |
| 隱身 | `隱身  前景.png` / `隱身 後景.png` | `assets/vfx/status/wind/stealth-skill-front.webp` | `assets/vfx/status/wind/stealth-skill-back.webp` |
| 風行 | `風行 前景.png` / `風行 後景.png` | `assets/vfx/status/wind/dinghaishenzhen-front.webp` | `assets/vfx/status/wind/dinghaishenzhen-back.webp` |
| 鳳威 | `鳳威 前景.png` / `鳳威 後景.png` | `assets/vfx/status/fire/phoenix-might-front.webp` | `assets/vfx/status/fire/phoenix-might-back.webp` |
| 暈眩 | `image-gen-1(20260920-141230).png` / `image-gen-2(7).png` | `assets/vfx/status/wind/stun-front.webp` | `assets/vfx/status/wind/stun-back.webp` |

## 尚待雙層遷移

下列既有狀態在本批次來源資料夾沒有完整 Front + Back 配對，因此維持原正式單層 VFX，不共用其他狀態素材作 placeholder：

- `freeze`／凍結
- `yuanZuBlessing`／元祖祝福
