# 第二十二段B：六個秘寶材料圖示（runtime驗證待完成）

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
