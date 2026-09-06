
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

    /*
       V173.63 visible-layout authority:
       character/status/skill/inventory share the maximum mobile canvas.
       The former 396 × 620 inline Large Panel values overrode the V173.62
       stylesheet, so the screen never actually expanded on phones.  Keep one
       fixed outer frame here and let only the inner tab content scroll.
    */
    box.style.setProperty(
        "width",
        "calc(100% - 8px)",
        "important"
    );

    box.style.setProperty(
        "max-width",
        "none",
        "important"
    );

    box.style.setProperty(
        "height",
        "calc(100% - 8px)",
        "important"
    );

    box.style.setProperty(
        "max-height",
        "calc(100% - 8px)",
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
        "height",
        "auto",
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

    root.style.setProperty(
        "flex",
        "1 1 auto",
        "important"
    );

    root.style.setProperty(
        "height",
        "auto",
        "important"
    );

    root.style.setProperty(
        "max-height",
        "none",
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

    root.style.setProperty(
        "overflow-y",
        inventoryOwnsScroll
            ? "hidden"
            : "scroll",
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

    root.style.setProperty(
        "scrollbar-gutter",
        "stable",
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
                        Math.max(
                            180,
                            root.clientHeight
                        )*
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

function loadV17363VisibleUiRepairs(){
    if(document.getElementById("v17363-visible-ui-repairs-runtime")){
        return;
    }
    const script=document.createElement("script");
    script.id="v17363-visible-ui-repairs-runtime";
    script.src="js/58-v173.63-visible-ui-repairs.js?v=173.62";
    script.async=false;
    document.body.appendChild(script);
}

if(
    document.readyState===
    "loading"
){
    document.addEventListener(
        "DOMContentLoaded",
        function(){
            schedule();
            loadV17363VisibleUiRepairs();
        },
        {once:true}
    );
}
else{
    schedule();
    loadV17363VisibleUiRepairs();
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
