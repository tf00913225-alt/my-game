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

function releaseCharacterLayoutOwnership(modal,body,root,inventory,force){
    if(
        !modal ||
        (!force && modal.dataset.v78CharacterLayoutActive!=="1")
    ){
        return;
    }

    const box=modal.querySelector(".home-feature-modal-box.wide");
    if(box){
        [
            "display","flex-direction","width","max-width","height",
            "max-height","min-height","overflow"
        ].forEach(property=>box.style.removeProperty(property));
    }

    if(body){
        [
            "display","flex-direction","flex","height","min-height","overflow"
        ].forEach(property=>body.style.removeProperty(property));
    }

    if(root){
        [
            "flex","height","max-height","min-height","overflow-y","overflow-x",
            "-webkit-overflow-scrolling","overscroll-behavior-y","touch-action",
            "scrollbar-gutter"
        ].forEach(property=>root.style.removeProperty(property));
    }

    if(inventory){
        ["overflow","transform"].forEach(property=>inventory.style.removeProperty(property));
    }

    delete modal.dataset.v78CharacterLayoutActive;
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
        !modal.classList.contains("show")
    ){
        return;
    }

    /*
       Team Relic owns the shared modal body as its vertical scroll container.
       Its class can be applied before #characterTabContent is physically
       replaced, so containment alone is not a sufficient ownership test.
       Relinquish the character layout synchronously as soon as the relic modal
       class appears; force also clears any stale inline !important styles left
       by an older character view even if the dataset marker was lost.
    */
    const relicOwnsSharedModal=
        modal.classList.contains("team-relic-modal") ||
        modal.classList.contains("team-relic-mode");

    if(relicOwnsSharedModal){
        releaseCharacterLayoutOwnership(
            modal,
            body,
            root,
            inventory,
            true
        );
        return;
    }

    /*
       This owner is only valid while the character/status/skill/inventory
       shell is actually mounted inside the shared modal body. The same modal
       is reused by shop, quests, synthesis and Team Relic. Previously this
       function kept writing inline !important overflow:hidden to the shared
       body even after another feature took ownership, which could override
       Team Relic's legitimate overflow-y:auto and produce intermittent mobile
       scrolling depending on MutationObserver timing.

       The root can be completely removed when another feature replaces the
       modal body, so release must also run when #characterTabContent no longer
       exists at all; returning early on !root would leave the stale inline
       styles behind indefinitely. DOM test doubles used by the repository do
       not all implement Element.contains(), so the real containment check is
       used when available and otherwise falls back to the historical mounted
       assumption for those isolated fixtures.
    */
    const characterRootMounted=!!root&&(
        typeof body.contains==="function"
            ?body.contains(root)
            :true
    );
    if(!characterRootMounted){
        releaseCharacterLayoutOwnership(modal,body,root,inventory);
        return;
    }

    const box=
        modal.querySelector(
            ".home-feature-modal-box.wide"
        );

    if(!box){
        return;
    }

    modal.dataset.v78CharacterLayoutActive="1";

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
       stylesheet, so the screen never actually expanded on phones. Keep one
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

/* Late feature runtimes are production bundles owned by FourSymbolsFeatures. */

if(
    document.readyState===
    "loading"
){
    document.addEventListener(
        "DOMContentLoaded",
        function(){
            schedule();
        },
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

