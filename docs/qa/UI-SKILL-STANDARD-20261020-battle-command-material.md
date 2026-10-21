# 原五指令列材質打磨（待實畫）

Work ID UI-SKILL-STANDARD-20261020 / Branch fix/ui-skill-standard-polish-20261020 / PR #955。前來源 cc224766，驗收checkpoint dbb3c42a。四尺寸主列before位於 battle-overlay-round-accepted 各kind/裝置HUD或返回圖；美術獨立報告明確列為待修，不是以舊段通過代表其合格。

具體問題：五個主指令是平滑棕漸層、普通細金框圓角，與黑鐵古銅提示／技能頁工藝不一致。只改原 `css/00-main.css` 的 `mainBattleMenu::before`、原按鈕 skin 與相鄰分隔；一條既有技能黑鐵古銅底軌、透明原按鈕與克制分隔，不給五個按鈕各加大型窗框。不新增圖片、Wrapper 或互動 Owner。保留原五欄 token、絕對定位、66px高度、border寬、padding、16px字/22px行高、原onclick/active glow及所有JS。修正文內已過時「圖像面板／戰鬥資訊框」註釋以符合實際來源。

4 targeted tests/build/check 通過，不等於美術或觸控通過。待驗：修後四尺寸實畫、五個原控制幾何/文字中心/觸控44與狀態、原技能/背包開關/提示返回、獨立三審、checkpoint。防禦／逃脫按鈕幾何可量測，不能為驗外觀執行真防禦或逃脫；未操作狀態明列。不得據此批准攻擊、結果、結算、全部陣容或實體裝置。

最新dev e5e307 相依已另記，尚未正常吸收；技能核心／配置與既有fixture相對758未變。Chrome工程維持分開。Latest Head必要CI尚無已確認結果；PR仍Draft，未合併/部署。
