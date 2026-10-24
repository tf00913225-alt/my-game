# 第35F段限定範圍審核

已實看 source 7b0e9eb43b500d2d2f59bc6e6e1ad5f570a81316 四尺寸 appearance-open.png；三個合法16字名稱均完整分兩行，彈層雕框與各列完整。彈層擴高覆蓋部分地圖前景，但未裁到底部導航或兩個快捷控制；不主張所有地圖內容無遮擋。

權威：artifacts/ui-skill-standard/segment35f-patrol-three-names-7b0e9eb4/three-names-before/{360x640,393x873,412x915,1280x800}/report.json。四份 complete/clean/sourceUnchanged 均 true；同一 Head。每份三列真 hit 且高度58.61/63.98/67.07/73.26px，文字與角色ID逐項相同。實際輸入只有訓練入口、森林資訊、進入、切換面板開/關、原 leaveMap 返回；無選擇、切換開關、地圖或怪物動作。

已讀實際 helper：原 PREPARE seed 前備份 actors，兩既有角色僅改 id；第三人直接使用原 buildAdditionalCharacter(name,'wind','female') 回傳。未呼叫 register/createAdditionalCharacter，未改 level/HP/SP/技能點或 RNG；factoryOnly/noRegisterOrCreate 不單憑報告布林，而由實際程式呼叫核對。creationStats/creationStats2/creationPoints/creationPoints2/INITIAL_CHARACTER_SKILL_POINTS 前後序列相同，兩既有角色去 id 後資料相同。第三人原 factory level1、HP100/SP50、技能點2。

各階段受監測 domain 深度相同，原三組 auto config 全 false，未先強關；原 saveGame 透明委派。八項 raw/metadata/actors/inventory/loadouts/equipment/patrolKey/saveApi 還原均 true。私有選取快取、currentZone、monsters/grid、動畫及其他非列舉快取不聲稱 exact restore；不是全時段零儲存證明。

結論：此新增三人長名菜單的顯示、真開關與返回子集，可限定接受；無 production 修改、無業務操作或過修。本段不是24B角色TAB重驗。ON、真選角持久化、真建立/註冊第三人、戰鬥/巡怪、雲端及硬體裝置均未驗。
