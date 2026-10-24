# dev986 素材依賴最小整合

Work ID UI-SKILL-STANDARD-20261020 / #955；UI parent94593d32，dev parent34c41385（#986正常merge）。本機乾淨起始後，唯讀merge-tree證明兩manifest/index與生成包存在實際衝突，不是只因遠端dirty而造提交。原分支正常merge，不提前吸收991/989，不重開素材工程。

index僅保留新female01預設圖及交原builder重建boot槽；八PNG/WebP/config/js24/新素材測試逐blob與正式dev相同，js52只換八張preload URL，原955 main/js01/CSS/Story/safety來源不動。兩manifest及hash bundle由原builder重建，不手選舊包。沒有轉檔、重繪、裁切、改布局或修改其他Owner工作樹。

focused player-creation-portraits test、build/check、diffcheck通過。原94575項來源未變之回歸與986三尺寸24選取/無損證據沿用，不重跑。僅針對整合新產物補360×640與1280×800：原隔離profile原showCreation、真mouse男/土選擇，female-fire/male-earth四張實圖；decode、contain、原視窗邊界及actors/gold/exp/inventory/loadouts前後一致。沒有submit/create/save或真帳號操作；不稱四尺寸/eight-choice/硬體皆重新驗證。

三類獨立審核：source核對23個素材/接線blob及原UI保留；art實看四PNG，完整髮/武器/衣襬/腳、標題與原控制清楚無新重疊；input核對真hit、讀取/比例及狀態證據。[耐久證據](evidence/UI-SKILL-STANDARD-20261020/dev986-integration/)。原全台帳其他未驗範圍保留。

input另外觀察到現存元素按鈕寬360約33.9px、1280約42.4px，未滿44px；這不是本次素材導入新增，但仍是UI台帳待處理問題，不能宣稱所有控制項達標。本輪限986依賴整合，不順帶改原創角布局。

新Head正常push後，只讀自然CI/mergeability；不反覆輪詢舊422、不空提交/手動rerun/cancel。若仍無checks，精確列遠端Gate未完成。955排程PAUSED；此checkpoint不合併dev、不部署、不動Git main，保留986發布窗口。
