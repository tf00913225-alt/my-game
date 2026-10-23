# 批2最小子項：日常分類觸控高度

沿用 Work ID UI-SKILL-STANDARD-20261020 / branch fix/ui-skill-standard-polish-20261020 / Draft PR955，起點ba2c451a。原工作樹乾淨、遠端Head一致。既有已驗成果不重做。

360×640真實正式loader/隔離QA角色→原副本頁的圖與DOM量測：標題/分類及分類/內容間距各約5.14screen px，未見大片空白，故不憑推測改標題/佈局。可證實問題是日常分類按鈕實高41.1429screen px，低於44。唯一尺寸Owner `css/38-v141-system-expansion.css` 的 `#dungeonTabBtnDaily min-height:48px`；只改52，保持原文字/字級/樣式/事件及所有間距。沒有疊wrapper/全域CSS/important或改遊戲邏輯。

前圖與量測見 [source evidence](evidence/UI-SKILL-STANDARD-20261020/batch2-daily-target-source)。build/check必要，四尺寸修後實圖、44/EFP、重要文字/底nav邊界與原返回、獨立審核及最新Head CI尚待，不以52CSS數值批准。

批序/邊界：此純CSS子項先做；故事#984不重修；VFX#983圖層/浮字/動畫及時間Owner不碰，modal穿透與速度倍率待協調順序；一般nav只走04JS/06CSS正式Owner、尚未施工；元素匣入口移除及PWA各自依賴待處理，不混入本最小子項。Chrome#976唯一負責，必要CI啟動失敗不在此猜修/重跑。PR尚未合併部署，實機與未驗狀態仍明列。
