# 35F 三角色長名選單：獨立互動審核

限定通過。實看 7b0e9eb43b500d2d2f59bc6e6e1ad5f570a81316 四尺寸全部八張 PNG（map-static、appearance-open）及四份 report。來源：artifacts/ui-skill-standard/segment35f-patrol-three-names-7b0e9eb4/three-names-before/{360x640,393x873,412x915,1280x800}/。四份 complete/clean/sourceUnchanged 均 true。

三列依序為「天地玄黃宇宙洪荒日月盈昃辰宿列張」、「寒來暑往秋收冬藏閏餘成歲律呂調陽」、「雲騰致雨露結為霜金生麗水玉出崑岡」，皆精確16個中文字。四尺寸均自然兩行、文字完整，逐行 Range 皆在各自按鈕內；選單銅框、第三列及末字未裁切，未壓住底部導覽。選單在地圖前景遮到部分人物是正常 popup，不列為缺陷。

| 尺寸 | 每列高度 | 第三列底 | 導覽頂 |
|---|---:|---:|---:|
|360×640|58.61|265.82|568.67|
|393×873|63.98|377.36|707.96|
|412×915|67.07|395.50|742.09|
|1280×800|73.26|332.28|710.83|

三列 EFP 均命中且寬高大於44。每尺寸六次原輸入全部 hit=true：訓練、森林資訊、進入、同一 switch 開／關、原 leaveMap 返回。關閉後 show=false、選取 local raw 不變，返回 trainingActive=true/mapActive=false；未點三個選項，不宣稱選取切角已驗。

fixture 審查：備份在原 PREPARE actor seed 前；之後只改前兩角色 id、第三角色使用原 buildAdditionalCharacter(name,'wind','female') 純回傳。creationStats/creationStats2、creationPoints/creationPoints2、INITIAL_CHARACTER_SKILL_POINTS 前後 JSON 完全一致，前兩角色除 id 外數值相等。第三角色為原 factory 的 Lv1/EXP0/expNext100/HP100/SP50/points10/skillPoints2、六屬性0與空buff/status，沒有 register/create 或另外改 factory 產物。未替換 RNG。

各記錄 phase domain 與 seed 後 baseline 完全相等，battle=false/token0/timer=null、auto false、三 config false、元素匣 inactive/0 不變；僅針對實際定義的 HP/SP 記錄，不擴稱原最小第二角色未定義的欄位。八項 raw/meta/actors/inventory/loadouts/equipment/patrolKey/save API 精確還原全 true。保留原載入／normalize／save 委派副作用，不宣稱零保存或私有 cache、巡邏瞬態 exact。

本段只補三角色長名呈現與原開關／返回；未選形象、未開啟 auto／patrol、未點地圖／怪物、未驗其他區域、交易與實機。未啟 Chrome、未動 tracked。
