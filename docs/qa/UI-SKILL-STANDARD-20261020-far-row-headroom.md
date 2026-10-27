# far-row原Gate因果與最小修正

Work ID UI-SKILL-STANDARD-20261020 / PR955，續接bd003a9f。原CI0f5的far-row>99失敗保留，未降低門檻。

原始412×915測得farArt90.08362screen，依原canvasScale0.98095238與Gate .94正規化為97.69448。只在隔離原fixture把turn-row64→20（不改產品）時，center由160.87619縮到117.71429，ally區244.24179增到263.73825，farArt增至100.80664；確認是已修64px可讀倒數帶增加center最小值後分走友方區空間。不能回退20px或縮字掩蓋。

最小候選保持64、全部region fr、卡片與HUD/腳點不動，只增加遠排繪製上餘量：以原Gate保留100、當前depth1.10及實測值推得需ceil((100×.94−90.08362/.98095238)/1.10)=2logical px。原far-ally規則保depth1.10，overhang-top7→9；敵方原1.10不變，近排1.18不變，配對HUD原高度限制不變。隔離候選art92.24170screen，原Gate正規化約100.035，不再調比例。新selector不是全域patch，沿同一fixed-slot CSS原far-row規則；未改manual-turn-arrow/JS54/VFX/結算。

原完整Fixed Slot Browser Gate四尺寸412×915、393×873、390×844、360×800全通過，包含原>99、command內畫素exact、HUD/腳點/row不重疊、target與指令觸控、原箭頭相對檢查，沒有刪改原Browser斷言。它是原靜態geometry fixture，不是自然玩法或實機。12項focused slot/drag/reading/target回歸通過。唯一static test251原綁敵友共同一行CSS，改為分別精確核原敵方1.10及友方1.10/9px，保原near-depth及其他全部斷言。

[原四尺寸報告、畫素圖、單因子及candidate資料、完整source/bundle expected proof](evidence/UI-SKILL-STANDARD-20261020/far-row-headroom-source)。本機Browser Gate執行時產品尚未commit，故以完整source/bundle hash綁定，沒有把dirty報告重標clean。最新Head必要CI及獨立實圖審核仍待。兩次前期診斷未產結果不得當因果：dump-dom JSON空；第一次CDP誤把server.url(index.html)再接子路徑導致404，改URL resolver後原完成訊號有效。未提高期限/改原Chrome調查工具，失敗helper/log透明保存。

既有13項test-only修正、Modal8938及#983限定自然交叉成果保留。#983的箭頭/技能名不碰；#984未合併故事修復、#976 Chrome原Owner不重修。副本：日常按鈕四尺寸已驗，原大片留白此Head未重現；一般nav圖示/邊框/選中等尚未施工，modal全技能/393/實機亦未全驗。先完成本far-row Gate最新CI，再接原副本/一般導覽未驗清單，不並行展開元素匣移除/倍率/PWA。

## 限定獨審

三方已核原四尺寸JSON/全source與bundle expected transform；美術實看before+after party6及party1三張，互動看兩張after，scope看指定before/after。原full Browser與12focused/buildcheck通過；遠排約100.03原Gate值、腳點/中心與指令區保持一致。審核見同證據目錄。自然戰鬥/實機/最新CI仍未批准，不以static fixture外推。
