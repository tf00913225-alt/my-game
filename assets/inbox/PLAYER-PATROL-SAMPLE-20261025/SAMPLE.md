# 巡怪正背樣張：player_male_01

Work ID: PLAYER-PATROL-SAMPLE-20261025
Branch: feature/player-patrol-sample-20261025
Base dev: 4ef6a09cf56d6789d1968481da1ee669b1cafd61
Status: male01 human-approved 2026-10-25 22:40 Asia/Taipei; remaining seven pairs in production. Inbox only; runtime wiring requires shared-file handoff.

代表原角色：assets/characters/player_male_01.webp。male01正背樣張已由使用者22:40直接回覆「可以」批准；沿同一方向製作其餘七位正背，仍須分離獨審與84×126檢視。此目錄僅 inbox，無正式引用或 manifest 更動。與 #998 主城定位修正分離。戰鬥八圖由原 Owner 負責。

使用內建 image_gen（非 CLI/API key），原始輸出 PNG 保留，lossless WebP 不裁切、不縮放、不改 Alpha；84×126 PNG 與對照圖僅為顯示尺寸檢視副本。Pillow lossless=True, quality=100, method=6, exact=True；RGBA 解碼逐像素等同原圖。

生成提示詞規格（兩次各一張，reference 都是原角色）：
- Use case identity-preserve. Same player_male_01 from 四象江湖傳: handsome youthful illustrated face, black high ponytail with silver ornament, navy/white robes, teal sash, silver feather/crane motifs, dark tall boots and sheathed sword on HIS LEFT hip. Polished stylized hand-painted 2D wuxia, not photorealistic or chibi. Readable at 84x126, restrained cloth, natural gentle walking, centered full body with all feet, hair, ornaments and sword inside portrait 2:3 canvas, transparent padding. No scenery/floor/glow/text/UI/background shadow. Real transparent alpha, high quality source.
- FRONT: facing camera, subtle forward walking pose, relaxed bent knees and arm motion, confident expression; sword viewer right. One front sample, not a multi-view sheet.
- BACK: exact same man walking away directly up-screen; no visible face or over-shoulder turn. Preserve hair, outfit, motifs and sword on HIS LEFT (viewer left). Physical consistency, no mirror clone. One rear sample, not a multi-view sheet.

待人工決策：確認比例、走姿、輪廓與正背一致性後，才可授權其餘七位；不得據此自動導入巡怪或變更方向切換。

獨審 v1：正面同角色與84×126可辨，背面劍/肩正確，但不對稱鶴紋衣襬應在身體左側、背面錯在右側；後腰扣鏈與後護脛像前面複製。v1不判正背一致通過，保留 rejected-back-v1，精確修背圖再審。

背面 v2 精確修訂提示：Image1 back edit target, Image2 front reference only. Move only large asymmetric teal/silver crane panel to back viewer LEFT, matching character LEFT. Keep sword and feather pauldron at viewer LEFT; do not mirror entire character. Replace viewer RIGHT crane panel with plain navy/teal cloth. Remove front-only rear waist diamond buckle and dangling chain; plain wrapped teal sash. Rear boots simple leather seams/trim, no copied front shin guards; retain walking sole. Preserve pose, ponytail, palette, proportions, canvas and transparent alpha. No background/text/new accessories.

背面v2獨審：先前阻塞解除，可交人工審樣，非正式採用通過。左右衣襬/劍/羽肩一致，後腰後靴合理，正背同角色、雙腳完整、84×126可辨。人工仍須確認細長身形在巡怪畫面的比例，以及步態強度；未驗runtime/動畫/點擊。Status: INDEPENDENT_REVIEW_READY_FOR_HUMAN_SAMPLE_APPROVAL.
