/* =====================================================
   V174 — dynamic UI regression guards
   Owner for cross-cutting UI invariants created by multiple late runtimes:
   1) skill learn/upgrade action cards must stay compact;
   2) dark text on bright gold/yellow buttons must not have a text shadow;
   3) system save/delete subflows must always offer an explicit return path.

   No gameplay, save, battle, skill-cost or equipment business rules live here.
===================================================== */
(function installV174UiRegressionGuards(){
    "use strict";

    if(typeof window==="undefined"||typeof document==="undefined"||window.__v174UiRegressionGuardsInstalled){
        return;
    }
    window.__v174UiRegressionGuardsInstalled=true;

    let rafId=0;

    function compactSkillActionLabel(source){
        const text=String(source||"").replace(/\s+/g," ").trim();
        if(!text){ return text; }

        let match=text.match(/^角色\s*Lv\s*(\d+)\s*可升至技能\s*Lv\s*(\d+)/i);
        if(match){ return "Lv"+match[1]+" 解鎖"; }

        match=text.match(/^升至\s*Lv\s*(\d+)\s*需要\s*(\d+)\s*技能點/i);
        if(match){ return "需 "+match[2]+" 點"; }

        match=text.match(/^升至\s*Lv\s*(\d+)\s*[・·]\s*(\d+)\s*點/i);
        if(match){ return "升 Lv"+match[1]+"・"+match[2]+"點"; }

        match=text.match(/^學習\s*[・·]\s*(\d+)\s*點/i);
        if(match){ return "學習・"+match[1]+"點"; }

        match=text.match(/Lv\s*(\d+)\s*解鎖/i);
        if(match){ return "Lv"+match[1]+" 解鎖"; }

        match=text.match(/需要\s*(\d+)\s*技能點/i);
        if(match){ return "需 "+match[1]+" 點"; }

        if(/前置[:：]/.test(text)){ return "需前置"; }
        return text;
    }

    function normalizeSkillActionCards(){
        const labels=document.querySelectorAll("#allSkillsList .skill-action-card .skill-action-card-label");
        labels.forEach(label=>{
            const card=label.closest(".skill-action-card");
            if(!card){ return; }

            const current=String(label.textContent||"").replace(/\s+/g," ").trim();
            const previousCompact=label.dataset.v174CompactLabel||"";
            if(current!==previousCompact){
                const full=current;
                const compact=compactSkillActionLabel(full);
                label.dataset.v174FullLabel=full;
                label.dataset.v174CompactLabel=compact;
                if(compact!==full){ label.textContent=compact; }
                card.title=full;
                card.setAttribute("aria-label",full);
            }

            if(card.style.getPropertyValue("width")!=="104px"||card.style.getPropertyPriority("width")!=="important"){
                card.style.setProperty("width","104px","important");
                card.style.setProperty("max-width","104px","important");
                card.style.setProperty("min-width","84px","important");
                card.style.setProperty("flex-basis","104px","important");
            }
        });
    }

    function colorTriples(value){
        const triples=[];
        String(value||"").replace(/rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d*(?:\.\d+)?))?\s*\)/gi,
            function(_,r,g,b,a){
                const alpha=a===""||a===undefined?1:Number(a);
                triples.push({r:Number(r),g:Number(g),b:Number(b),a:Number.isFinite(alpha)?alpha:1});
                return _;
            }
        );
        return triples;
    }

    function luminance(color){
        return color.r*.2126+color.g*.7152+color.b*.0722;
    }

    function isBrightGold(color){
        return color.a>.05&&
            color.r>=145&&
            color.g>=90&&
            color.g<=225&&
            color.b<=145&&
            color.r>=color.g&&
            luminance(color)>=115;
    }

    function isDarkText(color){
        return color&&color.a>.05&&luminance(color)<=115;
    }

    function normalizeGoldButtonTextShadows(){
        document.querySelectorAll("#game-stage button, #creationPage button").forEach(button=>{
            const style=window.getComputedStyle(button);
            const textColor=colorTriples(style.color)[0];
            const backgroundColors=colorTriples(style.backgroundColor+" "+style.backgroundImage);
            const qualifies=isDarkText(textColor)&&backgroundColors.some(isBrightGold);

            if(qualifies){
                if(button.dataset.v174DarkGoldShadow!=="1"||style.textShadow!=="none"){
                    button.style.setProperty("text-shadow","none","important");
                    button.dataset.v174DarkGoldShadow="1";
                }
            }else if(button.dataset.v174DarkGoldShadow==="1"){
                button.style.removeProperty("text-shadow");
                delete button.dataset.v174DarkGoldShadow;
            }
        });
    }

    function ensureStylesheetLast(){
        const link=document.getElementById("v174-critical-ui-regression-style");
        if(link&&link.parentElement===document.head&&link!==document.head.lastElementChild){
            document.head.appendChild(link);
        }
    }

    function systemRowTitle(button){
        const row=button&&button.closest&&button.closest(".system-panel-row");
        const title=row&&row.querySelector("strong");
        return String(title&&title.textContent||"").trim();
    }

    async function ensureRpgDialogOwner(reason){
        if(typeof window.rpgAlert==="function"&&typeof window.rpgConfirm==="function"){ return true; }
        if(window.FourSymbolsFeatures&&typeof window.FourSymbolsFeatures.ensure==="function"){
            try{ await window.FourSymbolsFeatures.ensure("gameplay-core",reason||"system-dialog"); }
            catch(error){ console.error("System dialog owner failed to load:",error); }
        }
        return typeof window.rpgAlert==="function"&&typeof window.rpgConfirm==="function";
    }

    async function runSystemSaveAction(button){
        if(button.dataset.v174SystemBusy==="1"){ return; }
        button.dataset.v174SystemBusy="1";
        button.disabled=true;
        try{
            const saved=typeof window.saveGame==="function"?window.saveGame():false;
            const ready=await ensureRpgDialogOwner("system-save-feedback");
            const success=saved!==false;
            if(ready){
                await window.rpgAlert(
                    success?"已完成手動存檔。":"目前無法完成手動存檔。",
                    {title:"遊戲存檔",confirmText:"返回系統",tone:success?"success":"normal"}
                );
            }else if(typeof window.alert==="function"){
                window.alert(success?"已完成手動存檔。":"目前無法完成手動存檔。");
            }
        }finally{
            delete button.dataset.v174SystemBusy;
            button.disabled=false;
        }
    }

    async function runSystemDeleteAction(button){
        if(button.dataset.v174SystemBusy==="1"){ return; }
        button.dataset.v174SystemBusy="1";
        button.disabled=true;
        try{
            const ready=await ensureRpgDialogOwner("system-delete-confirm");
            if(ready&&typeof window.resetGame==="function"){
                await window.resetGame();
            }
        }finally{
            delete button.dataset.v174SystemBusy;
            button.disabled=false;
        }
    }

    function interceptSystemAction(event){
        const button=event.target&&event.target.closest&&event.target.closest(".system-panel-row .home-feature-buy-btn");
        if(!button){ return; }
        const title=systemRowTitle(button);
        if(title!=="遊戲存檔"&&title!=="刪除角色"){ return; }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if(title==="遊戲存檔"){ void runSystemSaveAction(button); }
        else{ void runSystemDeleteAction(button); }
    }

    function normalizeSystemDialogNavigation(){
        const layer=document.getElementById("v169RpgDialogLayer");
        if(!layer||!layer.classList.contains("show")){ return; }
        const title=layer.querySelector("#v169RpgDialogTitle");
        if(String(title&&title.textContent||"").trim()!=="刪除角色"){ return; }
        const cancel=layer.querySelector(".v169-rpg-dialog-actions .v169-rpg-dialog-button.secondary");
        if(cancel&&!cancel.hidden&&cancel.textContent!=="返回系統"){
            cancel.textContent="返回系統";
            cancel.setAttribute("aria-label","返回系統，不刪除角色");
        }
    }

    function apply(){
        normalizeSkillActionCards();
        normalizeGoldButtonTextShadows();
        normalizeSystemDialogNavigation();
        ensureStylesheetLast();
    }

    function schedule(){
        if(rafId){ return; }
        rafId=requestAnimationFrame(()=>{
            rafId=0;
            apply();
        });
    }

    const observer=new MutationObserver(schedule);
    observer.observe(document.body,{
        childList:true,
        subtree:true,
        characterData:true,
        attributes:true,
        attributeFilter:["class","style","disabled"]
    });

    document.addEventListener("click",interceptSystemAction,true);
    document.addEventListener("click",schedule,{passive:true});
    document.addEventListener("v173:runtime-ready",schedule,{passive:true});
    window.addEventListener("resize",schedule,{passive:true});

    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded",schedule,{once:true});
    }else{
        schedule();
    }

    window.v174ApplyUiRegressionGuards=schedule;
})();
