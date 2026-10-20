# Segment25 技能詳情：修復候選，尚未全項驗收

Work ID UI-SKILL-STANDARD-20261020；PR #955；Branch fix/ui-skill-standard-polish-20261020。
候選Head a17d2357107f3dd41a5268c64cbb173ce03dda14，原症狀Head 8ba3488a60fbbfd3e4e3767c5d4c244f829e6bbd。

## 實際症狀／修法

360真production loader／真技能詳情按鈕：火焰斬首次top及捲末可見，關閉後重開仍scrollTop3516，停在舊末端；末端『技能元素』直接顯fire。原js00 showSkillDetail把reset移到原show class之後，仍同task，無新增timer/開窗Owner；原js60 progression純顯示列直接沿用原SKILL_ELEMENT_TAB_META中文label，不另複製詞表。技能數值/效果/成本/等級/學習/裝備handler不變。

原ui-medium-modal-skill-detail測試Owner新增真opener VM regression（隱藏scrollbox不接受reset）：原8ba red、候選green；涵蓋首次、重開、換技能及unknown id不開窗，loadout不變。21項既有skill-progression-rebalance focused通過；正式build/check通過。Windows原smoke定位不到Chrome明確skip，不作Browser證據。兩份正式generated policy只相應js00/js60 sourceDigests改變，其餘欄位exact，proof已保存。

## QA目前狀態與排除

首準備版只單向整頁滑動會越過第一卡到列表末，無技能開窗，屬QA路由問題，排除。修為按真DOM順序、有界雙向小幅手勢後取得原重開症狀。marker縮排準備錯及拒覆寫既有輸出均未啟Chrome，不作產品故障。候選ff713初次QA因漏納一份generated sourceDigest而dirty gate拒啟，a17已保存完整產物/clean。

候選a17實測火焰斬/爆擊等前幾技能top/end與原真重開回頂、中文元素已出現；整輪在explosiveFlurry後跨await全localStorage嚴等失敗，包含原rested/exp-pool/asset-cache/metadata背景變化，**不視為技能UI改存檔或整輪通過**。準備以透明原show/close委派記錄同步handler同task前後exact identity/storage、精確還原原API，同時保留跨時間自然副作用紀錄；不凍結時鐘、不阻save、不改production邏輯。

## Next／未驗

完成48技能真詳情逐ID綁定/長短文/捲末/返回重開及代表已學Lv1；四尺寸與三方實畫審核仍待完成。角色三選角×三TAB、未創slot、合法1/mid/max狀態與其他未列狀態仍未驗，不稱技能詳情完成。不學習/升級/裝備/施放/消耗，不進Combat/雲端交易。最新必要CI待核，未合dev/部署。

## Base四尺寸限定驗收

Authority be598b486010157f3a707718458ecd2aa255adcf，source與a17候選相同；四尺寸各100張圖、48ID真末端/返回重開、200同步show-close handler全部sameTaskUnchanged、exactBeforeRestore/restored=true，clean/sourceUnchanged。各208個真tap（200個開關詳情、8個元素TAB），其餘紀錄是scroll/定位幾何，不能把整份touches誤稱tap數。

三方實看scope詳見segment25-base/independent-reviews.json：360美術逐48首圖，其他尺寸每5張代表圖，並非人工逐張審400張。四份完整原JSON以gzip無損保留（SHA/bytes記於可讀summary），400張原PNG不改動。新增48個per-ID ledger。

- 語言3ID淨心訣/焚血訣/結界仍有Buff/Debuff/Shield/Barrier/Boss/DoT，未通過，待原supportEffectText4個display字串修復及3ID四尺寸delta。
- 已學狀態只fireEX/healSpell/earthShield/dinghaishenzhen四個Lv1隔離fixture；不批准其他合法mid/max等級或學習/升級/裝備/施放/消耗/戰鬥/交易。
- 同步show/close同task identity/storage exact無變，跨await仍有背景資料變化完整保留；不按storage key斷定每筆timer來源，不稱零save。
- 原PREPARE/seed/normalize與同步handler比對分段，fresh local QA非真帳號雲端；無真實硬體/鍵盤驗收。

此為布局/閱讀/輸入base限定通過，非全25語言通過。下一步只修4個生效display字串、對3個ID四尺寸delta，不重跑48矩陣。
