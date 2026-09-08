
(function(){
    "use strict";

    /*
     * V78 ROOT FIX
     *
     * 舊版用 target.closest(...) 只看第一個符合元素。
     * 背包裡第一個符合的是 #inventoryPage，
     * 但真正的 scroll owner 是它上面的 .content。
     *
     * 這裡改成一路往祖先走，只要其中任何一層
     * 是真正可以垂直或水平捲動的容器，就允許手勢通過。
     */
    function isInsideAllowedScroller(target){
        if(!target){
            return false;
        }

        /*
           ★ 修正（依照使用者回報，「全屬性技能預覽」頁面
           「不能捲動，下面看不到」）：
           這裡是全域的觸控鎖，`#game-stage`裡任何觸控目標
           只要不在這份白名單覆蓋的可捲動容器內，一律
           `preventDefault()`擋掉原生捲動手勢。
           `.skill-preview-body`（全屬性技能預覽彈窗真正
           的捲動容器）從一開始就沒有被加進這份白名單，
           程式化設定`scrollTop`看起來正常、但手指真的滑動
           時（真正會經過touchmove事件）完全被這裡擋掉，
           這是原本就存在的bug，只是內容字級變大、真的需要
           捲動才會看到內容之後才會被踩到——之前字級小、
           內容剛好塞得進viewport，從來沒真的需要捲動過。

           V173.45 shop frame hotfix：商店改成固定 Large Panel 後，
           真正的內容 scroll owner 是 #homeFeatureModalBody。
           外框 .home-feature-modal-box 只負責固定尺寸且 overflow:hidden，
           因此不能代替內頁通過觸控鎖；把真正 scroll owner 納入
           同一份權威白名單，避免再次出現「看得到 scrollbar、
           但手指滑不動」的假捲動狀態。

           合成裝備選擇列是水平 scroll owner。舊判斷只接受
           overflow-y，因此即使畫面已出現橫向 scrollbar，手指左右
           滑仍會被全域 touch lock 阻擋。現在同一份權威判斷同時
           接受真正可捲動的 X/Y 軸，避免再為單一頁面另做事件補丁。

           角色詳細能力視窗的真正 scroll owner 是
           .inventory-character-detail-grid；外框
           .inventory-character-detail-box 本身是 overflow:hidden，
           不能替內容區通過觸控鎖。把真正內容層加入同一白名單。

           練功區地區資訊收斂成 Medium Modal 後，真正 scroll owner
           改為 #trainingZoneModalBody；外框只負責固定尺寸。

           狀態／能力說明收斂成 Medium Modal 後，真正 scroll owner
           是 #statusHelpModal 內的 .item-stat-list；外框與返回鍵固定。

           V174：秘寶頁的垂直 scroll owner 是
           #homeFeatureModal.team-relic-mode #homeFeatureModalBody，分類列
           .team-relic-tabs 則是水平 scroll owner。兩者都必須通過這個
           全域觸控鎖；否則手勢從分類列或秘寶內容起始時會被
           preventDefault()，造成「有時能滑、有時不能滑」的裝置差異。
        */
        const allowedSelector =
            ".content, .content-scrollable, .creation-page-scroll, .inventory-grid-scroll, .quest-tab-body, .battle-item-list, " +
            ".characterTabContent, #characterTabContent, #inventoryPage, " +
            ".home-feature-modal-box, #homeFeatureModalBody, #homeFeatureModal.team-relic-mode #homeFeatureModalBody, .team-relic-tabs, .v141-synthesis-body, #trainingZoneModalBody, .auto-settings-expanded, " +
            ".inventory-character-detail-box, .inventory-character-detail-grid, .item-modal-box, #itemModalStats, #skillDetailStats, " +
            "#statusHelpModal .item-stat-list, .skill-preview-body, .creation-skill-detail-levels, #dungeonTabContent, .gameplay-panel-scroll, .v17342-abyss-battle-log, .v143-item-picker, .v17358-reforge-tiers, .v17363-game-select-menu, .v17351-compare-stats, " +
            "textarea, select, input";

        let node =
            target.nodeType===1
            ? target
            : target.parentElement;

        while(node && node!==document.documentElement){

            if(
                node.matches &&
                node.matches(allowedSelector)
            ){
                const style =
                    window.getComputedStyle(node);

                const canScrollY =
                    (
                        style.overflowY==="auto" ||
                        style.overflowY==="scroll"
                    ) &&
                    node.scrollHeight >
                    node.clientHeight + 1;

                const canScrollX =
                    (
                        style.overflowX==="auto" ||
                        style.overflowX==="scroll"
                    ) &&
                    node.scrollWidth >
                    node.clientWidth + 1;

                if(canScrollY || canScrollX){
                    return true;
                }
            }

            node=node.parentElement;
        }

        return false;
    }

    document.addEventListener(
        "touchmove",
        function(event){
            const gameSurface =
                event.target &&
                event.target.closest &&
                event.target.closest("#game-stage");

            if(
                gameSurface &&
                event.touches &&
                event.touches.length>1
            ){
                event.preventDefault();
                return;
            }

            if(
                gameSurface &&
                !isInsideAllowedScroller(
                    event.target
                )
            ){
                event.preventDefault();
            }
        },
        {passive:false}
    );

    document.addEventListener(
        "pointermove",
        function(event){
            if(
                event.pointerType==="touch" &&
                event.target &&
                event.target.closest &&
                event.target.closest("#game-stage") &&
                !isInsideAllowedScroller(
                    event.target
                )
            ){
                event.preventDefault();
            }
        },
        {passive:false}
    );

    /*
       全遊戲瀏覽器原生互動鎖：
       - 單指仍依既有 scroll whitelist 正常捲動。
       - 兩指以上永遠不交給瀏覽器做 pinch zoom。
       - 非文字輸入 UI 不開啟長按 context menu、不原生拖曳、不文字選取。
       這是全域 owner，禁止各頁另疊長按／縮放補丁。
    */
    function isGameSurfaceTarget(target){
        return !!(
            target &&
            target.closest &&
            target.closest("#game-stage")
        );
    }

    function isEditableGameControl(target){
        return !!(
            target &&
            target.closest &&
            target.closest('input, textarea, [contenteditable="true"]')
        );
    }


    document.addEventListener(
        "contextmenu",
        function(event){
            if(
                isGameSurfaceTarget(event.target) &&
                !isEditableGameControl(event.target)
            ){
                event.preventDefault();
            }
        },
        {capture:true}
    );

    document.addEventListener(
        "dragstart",
        function(event){
            if(
                isGameSurfaceTarget(event.target) &&
                !isEditableGameControl(event.target)
            ){
                event.preventDefault();
            }
        },
        {capture:true}
    );

    document.addEventListener(
        "selectstart",
        function(event){
            if(
                isGameSurfaceTarget(event.target) &&
                !isEditableGameControl(event.target)
            ){
                event.preventDefault();
            }
        },
        {capture:true}
    );

    document.addEventListener(
        "wheel",
        function(event){
            if(
                event.ctrlKey &&
                isGameSurfaceTarget(event.target)
            ){
                event.preventDefault();
            }
        },
        {capture:true,passive:false}
    );

    window.addEventListener(
        "gesturestart",
        function(event){
            if(
                event.target &&
                event.target.closest &&
                event.target.closest("#game-stage")
            ){
                event.preventDefault();
            }
        },
        {passive:false}
    );

    window.addEventListener(
        "gesturechange",
        function(event){
            if(
                event.target &&
                event.target.closest &&
                event.target.closest("#game-stage")
            ){
                event.preventDefault();
            }
        },
        {passive:false}
    );

    window.isInsideAllowedScrollerV78 =
        isInsideAllowedScroller;
})();
