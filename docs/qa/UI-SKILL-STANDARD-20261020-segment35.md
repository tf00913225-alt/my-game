# 第35段：巡邏入口與靜態頁（施工中）

Work ID UI-SKILL-STANDARD-20261020 / PR #955。Before source297d72ab，360×640真trainingNav進野怪區後forest列實際36px，命中正常但不達44px，驗證立即停止，未進map。8項還原均true，失敗原圖/report保留segment35-entry-before。

CSS00原training-zone-item唯一Owner新增border-box/flex垂直置中/min-height52px；原字體、灰底、地圖、列表間隔、所有onclick保留。Generated CSS由原builder重建，build/check通過。未改遊戲邏輯。修後四尺寸與獨立審核待完成，不得稱巡邏已驗收。

下一步：真列表末端/返回forest→原資訊進入→靜態map→形象面板開關（不選）→原native返回。所有原party autoConfig必須已關、無巡怪/戰鬥/timer，否則停止；不主動改config製造安全。無map移動/怪物/auto點擊，啟用補給、戰鬥、選取寫入、其他地區及實機仍未驗。private selected/decode/generation/進場瞬態不主張完整還原。
