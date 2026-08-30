
(function(){
"use strict";

let rafId=0;

function getStageScale(){
    const stage=
        document.getElementById(
            "game-stage"
        );

    if(!stage){
        return 1;
    }

    const rect=
        stage.getBoundingClientRect();

    const scale=
        rect.width/1080;

    return (
        Number.isFinite(scale) &&
        scale>0
    )
        ? scale
        : 1;
}

function applyNow(){
    const modal=
        document.getElementById(
            "homeFeatureModal"
        );

    const body=
        document.getElementById(
            "homeFeatureModalBody"
        );

    const root=
        document.getElementById(
            "characterTabContent"
        );

    const inventory=
        document.getElementById(
            "inventoryPage"
        );

    const statusPage=
        document.getElementById(
            "statusPage"
        );

    const skillPage=
        document.getElementById(
            "skillPage"
        );

    const expPool=
        document.getElementById(
            "homeExpPoolCard"
        );

    if(
        !modal ||
        !body ||
        !root ||
        !modal.classList.contains("show")
    ){
        return;
    }

    const box=
        modal.querySelector(
            ".home-feature-modal-box.wide"
        );

    if(!box){
        return;
    }

    box.style.setProperty(
        "display",
        "flex",
        "important"
    );

    box.style.setProperty(
        "flex-direction",
        "column",
        "important"
    );

    box.style.setProperty(
        "height",
        "96%",
        "important"
    );

    box.style.setProperty(
        "max-height",
        "96%",
        "important"
    );

    box.style.setProperty(
        "min-height",
        "0",
        "important"
    );

    box.style.setProperty(
        "overflow",
        "hidden",
        "important"
    );

    body.style.setProperty(
        "display",
        "flex",
        "important"
    );

    body.style.setProperty(
        "flex-direction",
        "column",
        "important"
    );

    body.style.setProperty(
        "flex",
        "1 1 auto",
        "important"
    );

    body.style.setProperty(
        "min-height",
        "0",
        "important"
    );

    body.style.setProperty(
        "overflow",
        "hidden",
        "important"
    );

    /* root 上方還有角色頭像與頁籤，不能把 body 的完整高度
       再分配給 root；只取 root 起點到 body 底部的剩餘空間。 */
    const bodyRect=body.getBoundingClientRect();
    const rootRect=root.getBoundingClientRect();
    const availableLogical=Math.max(
        180,
        Math.floor(bodyRect.bottom-rootRect.top-10)
    );

    root.style.setProperty(
        "height",
        availableLogical+"px",
        "important"
    );

    root.style.setProperty(
        "max-height",
        availableLogical+"px",
        "important"
    );

    root.style.setProperty(
        "min-height",
        "0",
        "important"
    );

    const inventoryOwnsScroll=
        !!(
            inventory &&
            inventory.parentElement===root
        );

    const activeCharacterTab=
        inventoryOwnsScroll
            ? "inventory"
            : statusPage && statusPage.parentElement===root
                ? "status"
                : expPool && expPool.parentElement===root
                    ? "expPool"
                    : skillPage && skillPage.parentElement===root
                        ? "skill"
                        : "";

    root.dataset.characterTab=
        activeCharacterTab;

    const fixedCharacterTab=
        activeCharacterTab==="status" ||
        activeCharacterTab==="expPool";

    root.style.setProperty(
        "overflow-y",
        inventoryOwnsScroll || fixedCharacterTab
            ? "hidden"
            : "auto",
        "important"
    );

    root.style.setProperty(
        "overflow-x",
        "hidden",
        "important"
    );

    root.style.setProperty(
        "-webkit-overflow-scrolling",
        "touch",
        "important"
    );

    root.style.setProperty(
        "overscroll-behavior-y",
        "contain",
        "important"
    );

    root.style.setProperty(
        "touch-action",
        "pan-y",
        "important"
    );

    if(inventoryOwnsScroll){
        inventory.style.setProperty(
            "overflow",
            "visible",
            "important"
        );

        inventory.style.setProperty(
            "transform",
            "none",
            "important"
        );

        /*
           V77 的 1/3 再縮小 1/3：
           1/3 × 2/3 = 2/9 可視高度。
        */
        const stageHeight=
            Math.max(
                180,
                Math.min(
                    300,
                    Math.round(
                        availableLogical*
                        2/9
                    )
                )
            );

        inventory.style.setProperty(
            "--inventory-stage-height",
            stageHeight+"px"
        );
    }
}

function schedule(){
    if(rafId){
        cancelAnimationFrame(
            rafId
        );
    }

    rafId=
        requestAnimationFrame(
            function(){
                rafId=0;
                applyNow();
            }
        );
}

if(
    document.readyState===
    "loading"
){
    document.addEventListener(
        "DOMContentLoaded",
        schedule,
        {once:true}
    );
}
else{
    schedule();
}

const observer=
    new MutationObserver(
        schedule
    );

observer.observe(
    document.body,
    {
        childList:true,
        subtree:true,
        attributes:true,
        attributeFilter:["class"]
    }
);

document.addEventListener(
    "click",
    schedule,
    {passive:true}
);

window.addEventListener(
    "resize",
    schedule,
    {passive:true}
);

window.v78ApplyCharacterInventoryLayout=
    schedule;
})();
