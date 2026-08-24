
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
     * 是真正可以垂直捲動的容器，就允許手勢通過。
     */
    function isInsideAllowedScroller(target){
        if(!target){
            return false;
        }

        const allowedSelector =
            ".content, .content-scrollable, .creation-page-scroll, .inventory-grid-scroll, .quest-tab-body, .battle-item-list, " +
            ".characterTabContent, #characterTabContent, #inventoryPage, " +
            ".home-feature-modal-box, .auto-settings-expanded, " +
            ".inventory-character-detail-box, .item-modal-box, #skillDetailStats, " +
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

                const canScroll =
                    (
                        style.overflowY==="auto" ||
                        style.overflowY==="scroll"
                    ) &&
                    node.scrollHeight >
                    node.clientHeight + 1;

                if(canScroll){
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
