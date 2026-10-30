# 玩家戰鬥立繪可讀性候選

Work ID: BATTLE-PORTRAIT-READABILITY-20261030
Base dev: c2d99cefccd87610b57fadc3e582d502986f881d
Branch: fix/battle-portrait-readability-20261030
Status: 1.20 候選 checkpoint；before／after 實際畫面、獨立 QA 與使用者預覽決定尚待完成，禁止提前合併。

只在正式 `css/fixed-slot-battlefield-rendering-v2.css` 對 canonical 玩家 Card 0～2 的 artwork 局部設定 `--battle-paint-scale:1.587`（原 1.3225 × 1.20）。敵方、英雄 Card 3～5、Slot、血條、光學密度／reference、JS、數值、存檔與圖片來源維持；不新增永久 will-change 或恢復 VFX。101.55／105.27px 是 monster 規則，本工程不修改。

before 正式 CSS 為 `build/gameplay-core.830c08f5bea1.css`，after 候選為 `build/gameplay-core.f5d512b027bb.css`；兩份 manifest 由原 build 產生。build、build --check、玩家 battle mapping 與 party optical focused checks 通過，不代表畫面已驗收。

下一步使用既有安全隔離 runner 唯一執行，保持相同角色／編隊／viewport，比較八位、單人與滿隊的手機／桌面 before／after；檢查實際放大、頭腳武器、鄰角臉身、血條及邊界。若安全尺寸不足，先依畫面證據調整候選，不盲目擴大至 25%。
