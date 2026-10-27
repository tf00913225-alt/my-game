# 8fb 冒險材質來源審核

固定base b389e184f07a2de2ff1969f437f7e1e806ed5a10 / head 8fb31a9488e4cec111490cb9800126af950811c4。獨立核b389→8fb：手寫來源僅原冒險CSS；JS/functions/config/scripts/release完全無差，技能學習/配置/教學交易/獎勵/存檔邏輯未修改。758→e5變更清單無skill core/loadout/config/fixture或Firebase相依新增，先前合併60來源proof仍保留，不能把這個材質delta當重新驗過技能業務。

CSS範圍：原back補minwidth52；mapheading對稱padding52與中文眉標20/行高1.4/字重900；原sheet與stage-list沿既有rpgwindowframe材質、4角、黑鐵底，移除重複sheet after細框。原map坐標、sheet20%/27%grid、list185/240與overflow/所有handlers未動。文字尺寸與置中是實際UI幾何變化，不能稱全數幾何不變。

正式整份feature-adventure CSS bundle以新source替回舊source後逐byte相同；其餘改動manifest、docs與b389失敗/前圖保存。證明見 adventure-material-8fb-source-proof.json。未引入新Owner/JS補丁，修改限已證實不合格呈現，來源scope可接受。

尚未提供修後圖，本審核不批准美術、52實際觸控/標題/長名/節點/列表末端或新map全狀態。需要對應實圖後另審；同Head CI/部署/業務Gate仍依原流程。未改tracked、未開Chrome。

## 四尺寸實際畫面補審

已實看 existing-material-qualified 四尺寸各adventure-map.png及story-first-line.png，共8張。保留原山水路線地圖、節點位置、底部原預覽/獎勵/進入卡及人物對話配置；此次材質沒有強套其他頁排版。題牌置中、底部黑鐵雕框及story首句/下一句完整，未見本子集重要文字裁切或原map布局被過度重排。

四份report complete/sourceUnchanged true，Head同8fb31a94；原raw/meta/actors/inventory/loadouts/equipment/saveAPI還原全部true。原beginChapter/lastViewedAt/save副作用透明保留，未強稱原入口零存檔或private cache exact還原。helper沿既有PREPARE actor與原遷移決定active狀態，不改adventure進度或硬繞guard。

限定接受這四尺寸既有角色map及story第一句呈現子集；不批准20節點/全部對話、active onboarding、guarded返回、shop橋接、交易/技能學習/戰鬥/獎勵或真硬體。報告沒有clean欄位，不捏造clean=true；sourcebefore/after一致依原report記錄，原sourceproof維持。未改產品、未開Chrome。
