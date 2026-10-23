# 批2副本完整列表末端

沿用Work ID UI-SKILL-STANDARD-20261020 / branch fix/ui-skill-standard-polish-20261020 / PR955，起點f4e32d54。既有分類按鈕、Modal及far-row不重做。只補原清單尚未驗的分類真點、四張日常卡完整末端及原context返回/重開；不點挑戰、領獎或業務交易。

360×640原主城底nav真進副本→原日常分類→兩次真手勢到scroll932/client545/total1477。四卡exp/material/gold/equipment；末卡bottom549小於scroll owner bottom568及nav top568，內容未被底nav蓋住。但「獎勵預覽/挑戰」各32.5714screen px低於44，EFP仍true，原Gate拒絕。初次helper未catch前保存末端steps，沒有失敗圖；改存圖/有界清理後同源重現並保存，不把前次當通過。

原Owner css/42-v146-system-polish.css .v141-dungeon-cover-actions button min-height38→52，原18px字、line1.2、藝術/卡片/間距與全部handlers不變，沒有CSS疊補或新Owner。[前圖/原步驟/失敗/精確source與bundle證明](evidence/UI-SKILL-STANDARD-20261020/batch2-dungeon-card-source)。build/check及修後四尺寸/獨審/最新Head必要CI仍待。此QA為隔離角色/browser模擬，不搶實機，runtimeRestoreExact=false。

P4 collector7af1b8c僅回覆可行性：原runtime helper blob c7809e9b與補丁父相同，既有battle target lifecycle步驟會走terminal observer。副本新缺陷是原必要更新，不為採證造Head/run；沒有套用collector或改Chrome，不動原39905811946。#976仍唯一取證分析者，identity及其他UI/Abyss/backpack覆蓋未概稱。

本輪無新增/替換runtime點陣資產，WebP轉檔不適用。#983箭頭/技能名/時間與#984故事不碰。一般nav一致性仍待本段後按原04JS/06CSS Owner接續；不並行開元素匣移除/倍率/PWA。全UI與實機未完成。
