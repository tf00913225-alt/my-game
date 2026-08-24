
(function(){
    "use strict";

    function findScrollableBattlePanel(target){
        if(!target || !target.closest) return null;

        return target.closest(
            '[data-battle-log-scroll],' +
            '.battle-log-scrollable,' +
            '.battle-log,' +
            '.battle-info,' +
            '.battle-info-box,' +
            '.battle-log-box,' +
            '.battle-log-container,' +
            '.combat-log,' +
            '.combat-log-box,' +
            '.battle-text,' +
            '.battle-message-list'
        );
    }

    function canScrollVertically(el){
        if(!el) return false;

        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;

        return (
            (overflowY === "auto" || overflowY === "scroll") &&
            el.scrollHeight > el.clientHeight + 1
        );
    }

    /*
     * Mark the actual scrollable battle log so the existing global
     * touch lock can recognize it.
     */
    function markBattleScrollers(){
        const selectors = [
            '[class*="battle"][class*="log"]',
            '[class*="battle"][class*="info"]',
            '[class*="combat"][class*="log"]',
            '[id*="battle"][id*="log"]',
            '[id*="battle"][id*="info"]',
            '[id*="combat"][id*="log"]'
        ];

        document.querySelectorAll(selectors.join(",")).forEach(function(el){
            if(canScrollVertically(el)){
                el.setAttribute("data-battle-log-scroll", "true");
                el.style.touchAction = "pan-y";
            }
        });
    }

    /*
     * A capture-phase listener runs before the old global touch lock.
     * For the actual battle log, allow the browser's vertical scroll.
     * For everything else, the existing game-wide lock remains unchanged.
     */
    document.addEventListener("touchmove", function(event){
        const scroller = findScrollableBattlePanel(event.target);

        if(scroller && canScrollVertically(scroller)){
            event.stopImmediatePropagation();
            return;
        }
    }, {capture:true, passive:false});

    document.addEventListener("pointermove", function(event){
        if(event.pointerType !== "touch") return;

        const scroller = findScrollableBattlePanel(event.target);

        if(scroller && canScrollVertically(scroller)){
            event.stopImmediatePropagation();
            return;
        }
    }, {capture:true, passive:false});

    markBattleScrollers();

    const observer = new MutationObserver(function(){
        markBattleScrollers();
    });

    observer.observe(document.body, {
        childList:true,
        subtree:true,
        attributes:true,
        attributeFilter:["class","style"]
    });

    window.addEventListener("resize", markBattleScrollers, {passive:true});
})();
