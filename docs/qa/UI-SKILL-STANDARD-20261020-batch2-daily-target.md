# 批2最小子項：日常分類觸控高度

沿用 Work ID UI-SKILL-STANDARD-20261020 / branch fix/ui-skill-standard-polish-20261020 / Draft PR955，起點ba2c451a。原工作樹乾淨、遠端Head一致。既有已驗成果不重做。

360×640真實正式loader/隔離QA角色→原副本頁的圖與DOM量測：標題/分類及分類/內容間距各約5.14screen px，未見大片空白，故不憑推測改標題/佈局。可證實問題是日常分類按鈕實高41.1429screen px，低於44。唯一尺寸Owner `css/38-v141-system-expansion.css` 的 `#dungeonTabBtnDaily min-height:48px`；只改52，保持原文字/字級/樣式/事件及所有間距。沒有疊wrapper/全域CSS/important或改遊戲邏輯。

前圖與量測見 [source evidence](evidence/UI-SKILL-STANDARD-20261020/batch2-daily-target-source)。build/check必要，四尺寸修後實圖、44/EFP、重要文字/底nav邊界與原返回、獨立審核及最新Head CI尚待，不以52CSS數值批准。

批序/邊界：此純CSS子項先做；故事#984不重修；VFX#983圖層/浮字/動畫及時間Owner不碰，modal穿透與速度倍率待協調順序；一般nav只走04JS/06CSS正式Owner、尚未施工；元素匣入口移除及PWA各自依賴待處理，不混入本最小子項。Chrome#976唯一負責，必要CI啟動失敗不在此猜修/重跑。PR尚未合併部署，實機與未驗狀態仍明列。

## b977限定修後驗證

四尺寸固定Head、source clean/manifest不變；原分類真點及原context返回完成，分類height/EFP見manifest（360最小44.5714px），共12張場景圖。三方各實看4張分類修後圖並核各自scope，未聲稱全部12張獨審。證據 [reviewed](evidence/UI-SKILL-STANDARD-20261020/batch2-daily-target-reviewed)。原錯用#homeNav的QA失敗保留excluded，非產品返回故障；早期未設Windows exe及語法變數重名沒有進入產品驗證，不作通過證據。此helper未記完整input trace/同task存檔restore，僅隔離原QA角色，不宣稱精確還原/實機/整個副本列表end。

完整生成CSS可逆scope與build/check通過；必要CI仍待最新Head，不以舊ba2 Chrome失敗或其他Owner綠燈替代。後續批次與#983/#984/#976邊界保持，完成本小段保存後先回報Gate狀態，不擴動其他UI。
