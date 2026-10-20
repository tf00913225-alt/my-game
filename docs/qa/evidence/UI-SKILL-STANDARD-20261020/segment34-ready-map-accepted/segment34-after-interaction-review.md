# Segment34 after independent interaction review

結論：四尺寸 ready Lv20/Lv40 第一區地圖呈現與兩種正式返回路徑限定通過。Reviewer interaction_review 實際逐張看24張：每尺寸 selection-end、map20-ready、map40-ready、top-return-gameplay、bottom-nav-return-selection、gameplay-returned各1張；四report全部check/input/restore另獨立讀取及核對。不是宣稱36張全看。未啟Chrome、未改tracked。

Snapshot：`7025fe9664709590451526f2b3f1b390cffb34a8`；有效證據 `artifacts/ui-skill-standard/segment34-abyss-7025fe96/owner-after-context-nav/{360x640,393x873,412x915,1280x800}/`。各report complete/clean/sourceUnchanged true。

- 原玩法hub自身scroll owner真手勢使深淵卡完整可命中，沒有再點belowfold被nav擋住的座標。選擇頁原卡片scroller真末為top79/client353/total433（1native px量化差），Lv40卡與按鈕完整在nav上方；頂部標題/返回玩法不隨卡片捲走。Lv20卡在末端部分移出scroll viewport是正常捲動，不是內容被固定控件壓住。
- 每尺寸8個原入口/返回tap均EFP true且width/height>=44。20/40選擇鍵與topReturn最低44.57screen，393約48.66，412約51.01，desktop55.71。原小控件失敗沒有被鬆門檻算過。
- 20/40實畫均正確區分初境/真境，選中Difficulty/root與DOM一致，原第一區地圖、人物、HUD、提示文字完整可讀。沒有brown空背景/人物遺失，也沒有兩個返回互相蓋住。正式topReturn恰1，舊.v174-abyss-back=0；地圖URL為站點/assets/dungeons/abyss/maps/floor-1.png，非/build/assets，原HTTP200及decode941x1672，人物原src decode56x84，投影span背景非none；原feature-patrol依賴ready與apply函式存在，QA未呼叫apply或ensurepatrol補畫面。
- 真topReturn由map20回實際gameplayHubContent，selectedDifficulty=null；重入選40後真原生context返回（aria返回、onclick精確v174AbyssBackToSelection）回實際selection且selectedDifficulty=null，再真leave回hub。玩法hub保留其原捲動位置，截圖看得到深淵卡，不以錯誤隱藏host判返回成功。
- 所有phase的battleActive=false/token0/timer=null/autoBattle=false，actorsHP/SP/level、gold、inventory/equipment與fixtureDomain相同。兩run始終region0/encounter0/ready/noBattle/noChest/noPortal/noComplete。只選擇/返回原local persist造成active與raw/meta/abyss狀態寫入，原source與bytes已記錄；不稱零保存。
- raw/meta/actors/inventory/loadouts/equipment/abyssKey/legacyKey/saveApi九restore皆true。canonical原Owner寫回/publicreload後最後還原原字串bytes；私有runtime/mapEntered cache未稱exact。

原失敗分開：原hub未reach/錯descendant selector是QA接線；原36px控制、重疊topReturn與map資產問題保留其before/diagnostic；同7025 owner-after最後找不存在#bossNav是context導覽QA選擇器錯配，該run complete=false保留，不拿其exit/failure批准。唯owner-after-context-nav上述四run作本次有效驗收。

限制：只fresh isolated account、兩個ready難度第一區stage0的只讀地圖/選擇/返回。未驗locked兩tier、其他region/stages、長內容/後續地圖、移動/encounter/戰鬥/寶箱/portal/reset/首通獎勵/Cloud權威、真帳號、實機與私有cache精確還原。未把本段宣稱整個深淵完成。
