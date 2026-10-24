# Segment25 技能詳情：48項四尺寸 base＋3項文案 delta 限定驗收

Work ID UI-SKILL-STANDARD-20261020；PR #955；Branch fix/ui-skill-standard-polish-20261020。
最新delta 067395727302ef1b2c76d7c1357ac095ba0487ea，base be598b486010157f3a707718458ecd2aa255adcf；以下a17候選與失敗均為施工歷史。原症狀Head 8ba3488a60fbbfd3e4e3767c5d4c244f829e6bbd。

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

## 最新限定驗收

Delta 067395727302ef1b2c76d7c1357ac095ba0487ea：只原supportEffectText4個生效display literal，總述/各級共用；淨心訣正式中文增益/減益/護盾/結界/首領，焚血訣/結界持續傷害。所有清除/排除條件、數字、HP/SP/Lv/EX及internal token保留。3ID四尺寸各6圖/15真tap/12同步handler，全文及級別字串無上述工程英詞，重開回頂/原API精確還原。21focused/build/check通過。

原48項四尺寸base沿用，另24原圖與四份完整無損report/可讀summary/三方審核已保存。Art逐24圖，input/scope四尺寸代表圖及完整報告；scope另獨立byte還原source+整bundle exact。

自動審核曾因只見舊hash bundle刪除而暫拒提交；後核R099新完整bundle、23來源及12110換行分段保留、4字串還原old整檔byte-exact、manifest正確指向新檔，同一提交重試批准，沒有繞過。正式policy僅compatibilitydigest，其他declarations/值exact。

- 本段只48技能詳情閱讀/開關/重開，四個Lv1已學隔離fixture；未驗其他mid/max級別視覺或學習/升級/裝備/施放/消耗/交易/真硬體。
- 24張delta圖不是逐級中間列圖審；完整正文/各級由同原supportEffectText4literal生成，原數值/排除條件/其餘bytes可逆exact，並保留真全文捲末與原文字快照。
- 同步handler同task exact純讀；跨await有原背景資料變化，不稱零save，也不依keys精確判每筆timer來源。
- 其他角色TAB/未創slot、摘要跨頁一致性、主城28/42觸控缺口、完整編隊等仍依全介面清單未驗，不稱全遊戲完成。

未合dev/部署；Latest Head必要CI仍待核定。Next：24B三選角三TAB與未創slot／24C先canonical fixture再原lazy hydrate的摘要一致性／主城觸控缺口與其餘清單。
