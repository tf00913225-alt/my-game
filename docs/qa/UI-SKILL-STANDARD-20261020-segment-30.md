# 第30段：經驗池主要卡片及總額文字（限定驗收）

Work UI-SKILL-STANDARD-20261020 / PR955。skin來源31a30660fe8d54c77381f6d1ec7b781bd7931c14，總額留白來源5cdb3c8634649f2b286f66fe48e14158c8117763。

before4f360實圖證實總池及持續充能兩主卡仍平滑漸層細框；僅CSS49原共用skin增加兩個selector，沿技能原panel115fill/6ui雕框與黑鐵，沒有新增素材/全域補丁/另種排版，內角色卡保留。原字級/幾何/44操作/浮字28空間與4秒計時、1.45秒動畫及所有JS完全未改。

31a四尺寸各6圖，三16字角色/完整3rows，真進入/捲至充能區/同筆自然浮字peak及end/末端/footer/返回重開。無手動charge視覺API或停鐘，原save委派保留，不稱零存檔。fixture在startup及gameplay-core公式Owner後、顯式skill ensure前；不能稱冷boot/moduleinit前。raw/meta/actors/inventory/name/saveAPI精確還原、來源hash不變。三審皆實看圖片/report，art四尺寸24張全看，input/scope代表首末/浮字限定通過。

審核再發現既有總額末字貼框：3abc360 probe實測Range right335、box right337，實圖P進入右雕框。原CSS31 summary padding-inline2→12，字級不縮。5cdb四尺寸最小probe（不重跑自然動畫），右距12/13.10/13.73/15screen px，祖先overflow裁切/正文/操作列安全Gate、真末端及重開/精確還原通過；三獨立審核皆實看四圖，解除疑點。before與兩有效快照分層保存，沒有把早期報告改成最終Head驗證。

證據segment30-exp-skin-footer-accepted原PNG/JSON/helper gzip/hash；focused EXP scroll regression、build/check通過。僅本次原3角色正常呈現/0分配，未實際分配確認、消耗、其他交易或實機。不重做24B/C矩陣，不稱全EXP狀態完成。
