# 第二十二段B：六個秘寶材料圖示（六圖runtime限定通過）

延續22A；原材料SVG為純色幾何占位，與正式碎片原畫品質不一。正式runtime及origin/assets-library索引未找到對應精華/突破石/四自選箱。既有任務/副本木金箱及元素匣有明確其他身份，未混用。

使用built-in image_gen（依imagegen SKILL），六個最終母圖：藍/紫/橙/桃紅自選箱、突破石、精華v2。四箱沿同一黑鐵古銅雕龍結構、品階玉印差異。精華首母圖像補品被獨立審圖退回，v2移除瓶口/玻璃/液面/環扣，成開放古銅座托藍靈核；原退回圖明列REJECTED，不導入。五圖與v2母圖皆獨立有限通過，尚不代替runtime小尺寸驗收。完整prompt集/引用鏈與生成模式保存於evidence/UI-SKILL-STANDARD-20261020/segment22-material-art/prompts.json。

每張保留原1254×1254畫布，Sharp lossless WebP，未resize/crop/trim/rotate。全部Alpha逐像素完全相同，alpha>0所有RGB逐像素相同；encoder對alpha=0完全不可見RGB有normalization，並未宣稱全RGBA位元組一致。透明範圍/邊緣及所有可見像素不變；母圖/輸出SHA與數量逐張在provenance.json。新正式runtime只WebP，母圖留工作區/Codex來源，runtime本身為無損可還原可見母圖。

只在原js/relic-progression-drop-system.js材料圖片Owner加入六條不可變路徑，原materialSvg轉交既有fragmentIconMarkup；同一img/contain/slot/rarity owner，無CSS/大小/控制改動。可逆scope-byte-proof重建原來源其餘bytes完全一致，沒有ID/type/rarity/數量/cost/機率/handler/存檔更改。原20秘寶/碎片資產測試保留，新增六WebP lossless/1254方形/Alpha header檢查，4case通過；原養成focused通過。

本記錄為候選來源checkpoint：待固定Head四尺寸只六物品真背包格/詳情/返回與decode/load/slot稀有度實畫，完成三方review後才能解除六row素材問題。22A其餘21項與全部來源末端不重跑。未合併/部署/全UI完成。

正式候選路徑：

- assets/relics/materials/relic-choice-box-blue.8a6cfdd5fb40.webp
- assets/relics/materials/relic-choice-box-purple.0cbbe8fd9b70.webp
- assets/relics/materials/relic-choice-box-orange.6f30554e90e6.webp
- assets/relics/materials/relic-choice-box-pink.32e7de00c345.webp
- assets/relics/materials/relic-breakthrough-stone.2d2814201552.webp
- assets/relics/materials/relic-essence.4c8469805189.webp

## e583 四尺寸實際驗證完成

固定Head e58331ecc5427486f2bd18a90ea146eeddf56d98，四尺寸各12圖（六bag小格/六detail）與完整reports；手機各29records、desktop31，逐六ID/UID/sourceIndex及六真reopen，decoder natural1254×1254/visible/contain，真page2。所有相關控制至少44，未碰交易selector。source/bundle hash前後相同、clean、Chrome/server退出。三方獨立實看各尺寸代表，小圖可辨識、無Alpha方底/白邊/裁切、題牌與完整文案/rarity原Owner保留。六row artIssue解除；只有所列呈現與返回通過。

22A其餘21和來源末端沿有效42f3不重跑。母圖審核不代替上述runtime，首精華仍REJECTED。provenance改以preflightArtGate保留歷史待驗狀態，另附本Head runtimeQa，不混成現在仍pending。scope/原圖/完整prompt及無損Alpha/可見像素proof均保留。

限制：僅六個正式material ID的圖示呈現與原入口返回重開；22A其餘21材料與所有來源長表沿42f3既有有效證據，不重跑；未使用/出售/合成/選箱/升級/領獎/驗機率或經濟交易；choice-box bag detail不是relic-strip自選池驗收；未驗真帳號/雲端權威/硬體裝置/軟鍵盤。Latest Head required CI尚未接受，未合併/部署/全UI完成。
