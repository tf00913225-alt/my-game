# 第31段：首頁Browser QA契約同步（限定驗證）

Work UI-SKILL-STANDARD-20261020 / PR955。原QA來源4f741c138743025431347fc99732860359ca90fc，外層selector修正3abc38b3173cb2f42066fcbe7887315f473fb4ae。

舊c349 CI39460404586 ui_browser118760376897首敗於原bottom-nav runner203，仍要求home overflowhidden且不捲動，與第24段正式home自身auto/max-content Owner衝突。僅替換原home契約：exactauto、真swipe>0、外content hidden/top0及document0、原native nav identity/位置保持、bounded真swipe末端、最後city grid系統入口44且完全可見可命中。原冷訓練/其他導覽/背包/通知/技能/reload檢查未刪或放寬；Chrome啟動/期限/flags/profile/cleanup完全未碰。

focused helper直接抽取正式home Gate與原swipe函式，3abc四尺寸真執行皆pass，首末8PNG三方實看，sourcehash與QA身份不變。桌面也是touch-emulated viewport，不稱native mousewheel；沒有重跑共同整套nav或其他玩法。末system row與隊伍秘寶列在nav上方。

三個失敗如實保留：4f helper猜getState身份API；31a/v2 PREPARE原技能modal未先關；31a/v3驗到新Gate錯假設borrowed home祖先含.content。前兩非產品失敗，第三修原QA至正式document #app .content，未降低任何斷言。保存當前helper bytes，不冒稱早期未封存helper原碼已復原。

證據segment31-home-scroll-qa-accepted，nodecheck與四尺寸focused驗證通過；不取代最新Head GitHub Required CI或部署驗收。舊同run Linux Chrome無LISTEN/晚DevTools證據已依使用者授權轉交唯一P4根因Owner，UI不混入該工程。
