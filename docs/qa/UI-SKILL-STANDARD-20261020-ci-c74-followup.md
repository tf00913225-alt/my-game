# c74 CI：商店殘留契約與英雄QA捲動

Work ID UI-SKILL-STANDARD-20261020 / 原Branch / PR955，base c74f1286c5d3b1b9247014d73ed3218b4b539ca3。正常CI39934804387/a1之core120352034391首錯為batch4商店min-height42；ui120352034340首錯為英雄QA164候選卡occluded；adventure120352034430首錯為formal manual turn/visible guide等待，依Story #984，不改Story或Chrome工具。

商店直接判因：git blame css49:1398–1399及productcommit0b408c143114b5407634e6e8071fd0dbe909b4f8證實先前已改native132=authored44，數量同44，退休QA尺寸覆蓋且當時已更新v173.48測試。batch4遺留42/38與舊QA覆蓋要求。本輪第一次test-only變更遭自動審查拒絕，未繞過；補git來源、對應產品commit、正式scroller/既有segment13實圖證據後，重新提交窄範圍修正獲准。只對齊既有44與禁止舊QA尺寸覆蓋，不改產品或交易斷言。

英雄直接實測：原隔離hero fixture在360×640，正式formationContent CSS31:495 overflow-y:auto；scrollHeight1155/client1008，初始候選中心落在footer。正常scrollIntoView nearest使scrollTop0→147，EFP命中候選，真tap候選與ALLY_B3完成。診斷DIAGNOSTIC_STOP是刻意採集終點，不當suitePASS。QA原point排除所有formation捲動，且要求零verticalOverflow/scrollTop，違反正式scroller；產品無需壓縮或新增Owner。

最小QA修正：依正式控制用nearest捲入、保留connected/enabled/EFP檢查；drag先捲兩端，再不捲動重算兩點，防止舊座標；保留9:16/邊界/橫向overflow，以真末端可達取代禁止垂直捲動。confirmed位置、swap、失敗不寫、pending/retry、服務端保存與reload等原斷言保留。沒有修改runtimeJS/CSS/Auth/Save、loading/PWA或#987工具。

驗證：原run-hero-page-browser-qa全套360×640/412×915/1280×800 exit0；shop batch4、v173.48、v173.56三suite PASS；syntax/diffcheck PASS。同有效產品snapshot的其他高成本測試未重跑。393×873未獨立執行，硬體/部署/所有UI與Story仍未驗收；不引用此結果聲稱它們完成。

獨立Scope/Input/Art實看證據與審核結果見evidence/UI-SKILL-STANDARD-20261020/ci-c74-followup；所有證據綁定verification.json來源hash，產品與base相同。Latest Head必要CI待新checkpoint正常觸發，不重跑舊SHA或取消必要CI。下一步先讀最新Head真首錯；工具依#987原Owner交付、Story依#984，不混探索接線。
