# 必要 CI 的已證實驗證相依修正

Work ID UI-SKILL-STANDARD-20261020 / #955，續接7addc8c4。來源失敗是 [CI39532551714/a1](https://github.com/tf00913225-alt/my-game/actions/runs/39532551714)。

- core原13行綁定舊item-open區塊內bottom:calc。改核對item偏移的完整三項公式、原row使用同一變數及獨立round的相對位移；沒有刪除其他斷言。
- v170測試VM原URL只有createObjectURL/revokeObjectURL，Abyss原資產Owner使用new URL時失敗。隔離VM類別繼承原生URL並保留兩個靜態替身，既有production order測試新增相對URL解析回歸。沒有改產品資產/存檔/業務行為；原minimal DOM null-textContent診斷仍透明保留，不能當無瀏覽器錯誤證明。
- responsive-item驗證器292行仍要求home hidden，與原首頁reading owner及segment31四尺寸真手勢有效證據矛盾。僅改為精確auto，保留後續每個控制的scrollIntoView、clip邊界及EFP原斷言。未重做有效高成本全矩陣；新Head實際必要Actions仍待驗。

focused執行原battle靜態合約與v170原41cases，輸出lossless保存 [focused evidence](evidence/UI-SKILL-STANDARD-20261020/ci-contract-focused)。responsive runner語法檢查通過。這是測試相依修正，不是Boss/Abyss全Gate已通過的結論。

Session idle preload patrol時序相依已確認：原Browser runner先在533–535明確ensure Abyss（其正式依賴包含feature-patrol），後在545斷言patrol未執行。原fetch-only idle斷言完整移至明確Abyss入口之前，並增加其前置未執行檢查；產品feature依賴不改。原boot-architecture及feature-loader-runtime兩檔針對性回歸通過、語法通過。這不代替最新Head的實際Browser/Session必要Gate。

仍待直接診斷：Adventure guide pointer timeout、battle far-row artwork geometry，以及後續必要CI可能揭示的其他首次失敗。不因新Head覆蓋而把舊失敗稱為通過，不手動重跑碰綠燈。Chrome根因仍由#976單一負責，本工程未修改Chrome、安全、交易或遊戲邏輯。PR維持Draft，未合併或部署；不需使用者提供產品決策或額外權限，現阻塞是必要工程Gate。
