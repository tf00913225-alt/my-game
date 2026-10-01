(function(){
    "use strict";

    // One native shell; gameplay may replace items but cannot position another nav.
    let mainButtons=null;
    let shell=null;
    function ensureShell(){
        const nav=document.getElementById("bottomNav");
        const overlay=document.getElementById("game-overlay-layer");
        if(!nav||!overlay){ return null; }
        if(!mainButtons){ mainButtons=Array.from(nav.children); }
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
                button.append(img,assistive);
                return button;
            }));
            nav.dataset.navContext=key;
        }
        shell.hidden=false;
    }
    function hide(){ if(ensureShell()){ shell.hidden=true; } }
    window.FourSymbolsBottomNav=Object.freeze({renderMain,renderContext,hide,ensureShell});
    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",()=>renderMain("home"),{once:true});
    }else{ renderMain("home"); }
})();
