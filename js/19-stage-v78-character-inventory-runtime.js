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

function releaseCharacterLayoutOwnership(modal,body,root,inventory){
    if(!modal || modal.dataset.v78CharacterLayoutActive!=="1"){
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
        !root ||
        !modal.classList.contains("show")
    ){
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
    */
    if(!body.contains(root)){
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

function loadSkillProgressionRuntime(){
    const existing=document.getElementById("v17364-skill-progression-runtime");
    if(existing){
        if(existing.dataset.loaded==="1"||window.__v17364SkillProgressionInstalled===true){
            loadGameplayBossTowerRuntime();
        }else if(existing.dataset.gameplayChainArmed!=="1"){
            existing.dataset.gameplayChainArmed="1";
            existing.addEventListener("load",loadGameplayBossTowerRuntime,{once:true});
            existing.addEventListener("error",loadGameplayBossTowerRuntime,{once:true});
        }
        return;
    }

    const script=document.createElement("script");
    script.id="v17364-skill-progression-runtime";
    script.src="js/60-v173.64-skill-progression-rebalance.js?v=173.64";
    script.async=false;
    script.onload=function(){
        script.dataset.loaded="1";
        loadGameplayBossTowerRuntime();
    };
    script.onerror=function(){
        console.warn("V173.64 skill progression runtime failed to load");
        loadGameplayBossTowerRuntime();
    };
    document.body.appendChild(script);
}

function loadGameplayBossTowerStyle(){
    if(document.getElementById("gameplay-boss-tower-style")){ return; }
    const link=document.createElement("link");
    link.id="gameplay-boss-tower-style";
    link.rel="stylesheet";
    link.href="css/gameplay-boss-tower.css?v=173.64&patch=boss-card-ui-20260909";
    document.head.appendChild(link);
}

function loadGameplayBossTowerRuntime(){
    loadGameplayBossTowerStyle();
    const existing=document.getElementById("gameplay-boss-tower-runtime");
    if(existing){
        if(existing.dataset.loaded==="1"){
            loadTeamRelicRuntime();
        }else if(existing.dataset.teamRelicChainArmed!=="1"){
            existing.dataset.teamRelicChainArmed="1";
            existing.addEventListener("load",loadTeamRelicRuntime,{once:true});
            existing.addEventListener("error",loadTeamRelicRuntime,{once:true});
        }
        return;
    }
    const script=document.createElement("script");
    script.id="gameplay-boss-tower-runtime";
    script.src="js/gameplay-boss-tower-system.js?v=173.64";
    script.async=false;
    script.onload=function(){
        script.dataset.loaded="1";
        loadTeamRelicRuntime();
    };
    script.onerror=function(){
        console.warn("Gameplay / BOSS / Four-Symbol Tower runtime failed to load");
        loadTeamRelicRuntime();
    };
    document.body.appendChild(script);
}

function loadAbyssTwoTierStyle(){
    if(document.getElementById("v174-abyss-two-tier-style")){
        return;
    }

    const link=document.createElement("link");
    link.id="v174-abyss-two-tier-style";
    link.rel="stylesheet";
    link.href="css/54-v174-abyss-two-tier.css?v=173.64-abyss2";
    document.head.appendChild(link);
}

function loadTeamRelicStyle(){
    if(document.getElementById("team-relic-system-style")){
        return;
    }
    const link=document.createElement("link");
    link.id="team-relic-system-style";
    link.rel="stylesheet";
    link.href="css/55-team-relic-system.css?v=173.64-relic2";
    document.head.appendChild(link);
}

function loadTeamRelicRuntime(){
    loadTeamRelicStyle();
    if(document.getElementById("team-relic-system-runtime")){ return; }
    const script=document.createElement("script");
    script.id="team-relic-system-runtime";
    script.src="js/60-team-relic-system.js?v=173.64-relic2";
    script.async=false;
    script.onerror=function(){
        console.warn("Team Relic runtime failed to load");
    };
    document.body.appendChild(script);
}

function loadAbyssTwoTierRuntime(){
    loadAbyssTwoTierStyle();
    const existing=document.getElementById("v174-abyss-two-tier-runtime");
    if(existing){
        if(existing.dataset.loaded==="1"){
            loadSkillProgressionRuntime();
        }else if(existing.dataset.skillProgressionChainArmed!=="1"){
            existing.dataset.skillProgressionChainArmed="1";
            existing.addEventListener("load",loadSkillProgressionRuntime,{once:true});
            existing.addEventListener("error",loadSkillProgressionRuntime,{once:true});
        }
        return;
    }

    const script=document.createElement("script");
    script.id="v174-abyss-two-tier-runtime";
    script.src="js/59-abyss-two-tier-runtime.js?v=173.64-abyss3";
    script.async=false;
    script.onload=function(){
        script.dataset.loaded="1";
        loadSkillProgressionRuntime();
    };
    script.onerror=function(){
        console.warn("Two-tier Abyss runtime failed to load");
        loadSkillProgressionRuntime();
    };
    document.body.appendChild(script);
}

function loadV17363FunctionalFixes(){
    const existing=document.getElementById("v17363-functional-fixes-runtime");
    if(existing){
        if(existing.dataset.loaded==="1"){
            loadAbyssTwoTierRuntime();
        }else{
            existing.addEventListener("load",loadAbyssTwoTierRuntime,{once:true});
            existing.addEventListener("error",loadAbyssTwoTierRuntime,{once:true});
        }
        return;
    }

    const script=document.createElement("script");
    script.id="v17363-functional-fixes-runtime";
    script.src="js/58-v173.63-functional-fixes.js?v=173.64";
    script.async=false;
    script.onload=function(){
        script.dataset.loaded="1";
        loadAbyssTwoTierRuntime();
    };
    script.onerror=function(){
        console.warn("V173.63 functional fixes failed to load");
        loadAbyssTwoTierRuntime();
    };
    document.body.appendChild(script);
}

function armV17363FunctionalFixes(){
    /*
       The functional patch wraps late owners such as v141 synthesis and
       equipment-progression. Loading it at DOMContentLoaded is too early and
       leaves those wrappers detached. Wait for the shared runtime-ready event
       so V173.63 always attaches after the actual feature owners exist.
       The two-tier Abyss successor is chained after that late layer so the
       legacy V144/V155 five-emperor roster wrappers cannot retake ownership.
       V173.64 skill progression is chained after the current Abyss owner,
       so player learning gates never become prerequisites for monster skills.
       Gameplay / BOSS / Four-Symbol Tower attaches after skill progression and
       owns only its feature state plus mechanism-card integration. Team Relic
       remains chained last so its trigger hooks attach to the actual final
       battle / save / home owners instead of stale historical wrappers.
    */
    if(document.documentElement.dataset.runtimeReady){
        loadV17363FunctionalFixes();
        return;
    }

    document.addEventListener(
        "v173:runtime-ready",
        loadV17363FunctionalFixes,
        {once:true}
    );
}

if(
    document.readyState===
    "loading"
){
    document.addEventListener(
        "DOMContentLoaded",
        function(){
            schedule();
            armV17363FunctionalFixes();
        },
        {once:true}
    );
}
else{
    schedule();
    armV17363FunctionalFixes();
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
