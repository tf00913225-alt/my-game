(function(){
    "use strict";

    // One native shell; gameplay may replace items but cannot position another nav.
    const CONTEXT_NAV_ITEMS=Object.freeze([
        Object.freeze(["角色","assets/ui/nav-character.png","openHomeFeature('character')"]),
        Object.freeze(["背包","assets/ui/nav-backpack.png","v148OpenContextInventory()"]),
        Object.freeze(["秘寶","assets/ui/nav-relic-v175.webp","v148OpenContextRelic()"]),
        Object.freeze(["元素匣","assets/ui/nav-element-box.png","openHomeFeature('autoBattleSettings')"])
    ]);
    let mainButtons=null;
    let shell=null;
    function ensureShell(){
        const nav=document.getElementById("bottomNav");
        const overlay=document.getElementById("game-overlay-layer");
        if(!nav||!overlay){ return null; }
        if(!mainButtons){
            mainButtons=Array.from(nav.children);
            mainButtons.forEach(button=>{
                const image=button.querySelector(".nav-art-button");
                if(image&&!image.parentElement.classList.contains("nav-icon-frame")){
                    const frame=document.createElement("span");
                    frame.className="nav-icon-frame";
                    image.replaceWith(frame);
                    frame.appendChild(image);
                }
            });
        }
        if(!shell){
            shell=document.createElement("div");
            shell.className="native-bottom-nav-layer";
            shell.appendChild(nav);
            overlay.appendChild(shell);
        }
        return nav;
    }
    function renderMain(page){
        const nav=ensureShell();
        if(!nav){ return; }
        if(nav.dataset.navContext!=="main"){
            nav.replaceChildren(...mainButtons);
            nav.dataset.navContext="main";
        }
        const selected={home:"homeNav",training:"trainingNav",inventory:"inventoryNav",
            dungeon:"dungeonNav",gameplay:"bossNav",boss:"bossNav",tower:"bossNav"}[page]||"homeNav";
        mainButtons.forEach(button=>button.classList.toggle("active",button.id===selected));
        shell.hidden=false;
    }
    function renderContext(buttons,context){
        const nav=ensureShell();
        if(!nav){ return; }
        const key=context+":"+buttons.map(button=>button.join("|")).join(";");
        if(nav.dataset.navContext!==key){
            nav.replaceChildren(...buttons.map(([label,src,action])=>{
                const button=document.createElement("button");
                button.type="button";
                button.className="nav-button nav-art-button-wrap";
                button.setAttribute("aria-label",label);
                button.setAttribute("onclick",action);
                const img=document.createElement("img");
                img.className="nav-art-button";
                img.src=src;
                img.alt="";
                const assistive=document.createElement("span");
                assistive.className="nav-sr-only";
                assistive.textContent=label;
                const frame=document.createElement("span");
                frame.className="nav-icon-frame";
                frame.appendChild(img);
                button.append(frame,assistive);
                return button;
            }));
            nav.dataset.navContext=key;
        }
        shell.hidden=false;
    }
    function activeGameplayPageId(){
        for(const id of ["gameplayPage","bossPage","towerPage"]){
            const page=document.getElementById(id);
            if(page?.classList?.contains("active")){ return id; }
        }
        return "";
    }
    function renderGameplayContext(returnAction,context){
        const buttons=CONTEXT_NAV_ITEMS.map(item=>item.slice());
        buttons.push(["返回","assets/ui/map-return.png",returnAction]);
        renderContext(buttons,context);
    }
    /* Context selection is deliberately app-shell responsibility.  It must be
       correct before lazy gameplay bundles exist, so a cold training entry can
       never expose the main navigation first and replace it later. */
    function syncContext(){
        const app=document.getElementById("app");
        const dungeonPage=document.getElementById("dungeonPage");
        const trainingPage=document.getElementById("trainingPage");
        const gameplayPageId=activeGameplayPageId();
        const dungeonActive=!!dungeonPage?.classList?.contains("active");
        const trainingActive=!!trainingPage?.classList?.contains("active");
        const gameplayActive=!!gameplayPageId;
        const mapActive=!!document.getElementById("mapPage")?.classList?.contains("active");
        const contextActive=mapActive||dungeonActive||gameplayActive||trainingActive;
        app?.classList?.toggle("v148-context-nav-active",contextActive);

        if(app?.classList?.contains("inventory-overlay-open")||
           app?.classList?.contains("on-inventory-page")||
           document.getElementById("itemModal")?.dataset.presentationMode){
            hide();
            return "hidden-inventory";
        }
        if(!contextActive){
            if(app?.classList?.contains("in-battle")){
                hide();
                return "hidden-battle";
            }
            const mainPage=document.querySelector("#game-content .page.active");
            renderMain(mainPage?.id.replace(/Page$/,"")||"home");
            return "main";
        }

        const abyssMapActive=!!(dungeonActive&&dungeonPage.querySelector(".v141-abyss-shell"));
        const abyssSelectionActive=!!(dungeonActive&&dungeonPage.querySelector(
            ".v174-abyss-selection,.v174-abyss-complete,.v141-abyss-intro"
        ));
        const returnAction=mapActive
            ?"leaveMap()"
            :trainingActive
            ?"showPage('home')"
            :(gameplayActive&&!dungeonActive
            ?"v148ReturnFromGameplay()"
            :(abyssMapActive
            ?(typeof window.v174AbyssBackToSelection==="function"?"v174AbyssBackToSelection()":"v146ExitAbyssMap()")
            :(abyssSelectionActive?"v174AbyssLeaveToGameplay()":"showPage('home')")));
        const context=trainingActive
            ?"training"
            :(mapActive?"patrol":(gameplayActive&&!dungeonActive
            ?"gameplay:"+gameplayPageId
            :(abyssMapActive?"abyss-map":(abyssSelectionActive?"abyss-selection":"daily"))));
        renderGameplayContext(returnAction,context);
        return context;
    }
    function hide(){ if(ensureShell()){ shell.hidden=true; } }
    window.FourSymbolsBottomNav=Object.freeze({renderMain,renderContext,syncContext,hide,ensureShell});
    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",()=>renderMain("home"),{once:true});
    }else{ renderMain("home"); }
})();
