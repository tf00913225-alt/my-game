
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
        */
        const allowedSelector =
            ".content, .content-scrollable, .creation-page-scroll, .inventory-grid-scroll, .quest-tab-body, .battle-item-list, " +
            ".characterTabContent, #characterTabContent, #inventoryPage, " +
            ".home-feature-modal-box, #homeFeatureModalBody, #trainingZoneModalBody, .auto-settings-expanded, " +
            ".inventory-character-detail-box, .inventory-character-detail-grid, .item-modal-box, #itemModalStats, #skillDetailStats, " +
            "#statusHelpModal .item-stat-list, .skill-preview-body, .creation-skill-detail-levels, #dungeonTabContent, .v17342-abyss-battle-log, .v143-item-picker, " +
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