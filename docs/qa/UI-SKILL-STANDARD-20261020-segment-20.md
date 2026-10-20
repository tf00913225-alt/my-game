# 第二十段：真背包材料與兩種箱子

Work ID UI-SKILL-STANDARD-20261020；PR #955。先保存第21normal，再續本段，編號保留。基準UI d66dec130ff15d6515f3f29d256725cc713427b4，最終礦石delta db6a633cfa949a103ed0275826ed7bd35cefad37。

正式inventoryNav→分類/真slot，逐oreLow/materialChest/equipmentChest核ID/name/UID及原realIndex(sourceIndex)。Ore與equipmentChest用正式getter；materialChest無exportgetter，fixture忠實正式definition加原hydrate。1234ore經原999上限拆999+235，兩stack同UID，前QA把物理stack總數當三item錯誤；已只去重三logicalID且保全部stack並核sourceIndex，未改堆疊規則。最早Chrome env缺失、總數/UID斷言接線失敗皆排除。

實際裝備箱批量button36.33/input34，原CSS52改44，不動原handler/quantityclamp。其餘獲取途徑/開啟/預覽/返回真rect44且無墨跡溢出，保留不擴修。原箱configure限定equipmentChest，把裝備空屬性fallback改沿原preview『每箱固定隨機3件裝備；可先查看預覽』。js27原open wrapper只正式materialChest/getOreDefinition空raw文字節點改用途，保真stats與售價；材料箱依正式preview有鍛造材料與實戰消耗品、每箱一項，不猜新掉落。兩箱/礦石原雕框/對稱題牌/品階素材保留。既有3focused檔與build/check通過。

四尺寸360×640、393×873、412×915、1280×800各27圖/34records，其中26真tap/8末端或無需捲動紀錄；真詳情首末、來源首末回原detail、兩箱preview首末回detail、close回原分類/slot、再真重開。短內容不造捲動；material preview有真長末端。No open/sell/use/claim提交。

art/root再發現礦石不可裝備暗字，原js00 inline opacity只material由.4到1，其餘.4、disabled=true/文字/handler保留。每尺寸僅礦石7圖/10records（8tap/2末端紀錄）補用途/售價0/來源返回與reopen，兩箱沿有效d66不重跑。正式restricted-forest生成Owner同步唯一js00 sourceDigest，policy其他所有內容相同，獨立SHA已核；非策略修改，必要CI不降級。delta focused2檔與正式build/check過。

全部report clean/sourcehashunchanged、Chrome/server退出，三方看實圖限定通過。證據evidence/UI-SKILL-STANDARD-20261020/segment20-accepted，before控制與舊用途僅360實拍，d66四尺寸礦石暗字before也保留在base；沒有假造四尺寸最初before。精確records/tap分離見bindings。限制：未開箱/批量執行/出售/使用/領取/交易或驗機率計算；quantity只量測target/字與clip，未編輯數值或驗真軟鍵盤；精華/通用碎片/專屬碎片/其他材料及箱種未在這三個ID段驗證；真帳號/存檔權威/雲端/實體裝置未驗。

CI：db6 CI39421695682 queued、Session Authority39421695811 pending為最後讀取，不當通過；下一checkpoint仍核Latest Head。未合併/部署/全UI完成。Next：先獨立安全clock隔離activeguard呈現（未證實就維持未驗），再其餘材料類別/主城/正式battle與帳號讀檔提示台帳，不重已驗部分。
