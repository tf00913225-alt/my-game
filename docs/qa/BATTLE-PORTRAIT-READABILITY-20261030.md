# 玩家戰鬥立繪可讀性候選

Work ID: BATTLE-PORTRAIT-READABILITY-20261030
Base dev: c2d99cefccd87610b57fadc3e582d502986f881d
Branch: fix/battle-portrait-readability-20261030
Status: 1.20 候選 checkpoint；before／after 實際畫面、獨立 QA 與使用者預覽決定尚待完成，禁止提前合併。

只在正式 `css/fixed-slot-battlefield-rendering-v2.css` 對 canonical 玩家 Card 0～2 的 artwork 局部設定 `--battle-paint-scale:1.587`（原 1.3225 × 1.20）。敵方、英雄 Card 3～5、Slot、血條、光學密度／reference、JS、數值、存檔與圖片來源維持；不新增永久 will-change 或恢復 VFX。101.55／105.27px 是 monster 規則，本工程不修改。

before 正式 CSS 為 `build/gameplay-core.830c08f5bea1.css`，after 候選為 `build/gameplay-core.f5d512b027bb.css`；兩份 manifest 由原 build 產生。build、build --check、玩家 battle mapping 與 party optical focused checks 通過，不代表畫面已驗收。

下一步使用既有安全隔離 runner 唯一執行，保持相同角色／編隊／viewport，比較八位、單人與滿隊的手機／桌面 before／after；檢查實際放大、頭腳武器、鄰角臉身、血條及邊界。若安全尺寸不足，先依畫面證據調整候選，不盲目擴大至 25%。


## Adopted readable artwork and detail integration

User adopted small-size readable art and existing-detail enlargement. Battlefield retains player-only 1.20 scale. Eight new lossless WebP files use player_battle_readable_*; original high-detail player_battle_* remain for the 260px contain detail portrait. General artwork and hero mappings are unchanged. P2 preloads only the eight readable battle images; detail images load on demand. Original PNGs are preserved under assets/inbox/player-battle-readable-20261030. No crop, resize or alpha processing.

Optical metadata uses measured sequential alpha/255 area divided by height squared, unchanged reference .520696867047023. New heights117.862–149.280%. Asset/optical reports are BATTLE-PORTRAIT-READABILITY-20261030-assets.json and -optical.json. Build/check and20 focused cases passed; independent final runtime/art/source separation QA and latest-head required CI remain pending. Latest dev67a3da17 was normally merged; its cloud-source change is independent. Prior a0fe CI mock dataset failure was repaired in the existing enemy-resource fixture without weakening assertions.
