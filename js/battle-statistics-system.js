/* =====================================================
   Battle Statistics / Battle Insight UI
   - One per-battle statistics owner keyed by combatant id.
   - UI reads the same live/final snapshot; no duplicate result calculation.
   - Drawers are non-blocking observers; combat continues while they are open.
===================================================== */
(function installBattleStatisticsSystem(){
    "use strict";

    if(typeof window==="undefined"||window.__battleStatisticsSystemInstalled){ return; }
    window.__battleStatisticsSystemInstalled=true;

    const VALID_KINDS=new Set(["playerCharacter","heroNpc","reinforcement"]);
    let session=null;
    let finalSnapshot=null;
    let bossMechanisms=[];
    let openDrawer=null;

    function number(value){
        const result=Number(value);
        return Number.isFinite(result)?result:0;
    }
    function amount(value){ return Math.max(0,number(value)); }
    function escapeHtml(value){
        return String(value==null?"":value)
            .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
    }
    function copy(value){ return JSON.parse(JSON.stringify(value)); }
    function normalizeCombatant(input){
        if(!input||!input.id){ return null; }
        const kind=VALID_KINDS.has(input.kind)?input.kind:"playerCharacter";
        const battleIndex=Number.isInteger(Number(input.battleIndex))?Number(input.battleIndex):null;
        return {
            id:String(input.id),
            kind:kind,
            side:input.side==="enemy"?"enemy":"ally",
            battleIndex:battleIndex,
            name:String(input.name||"未命名單位"),
            portrait:String(input.portrait||""),
            damageDealt:Math.max(0,number(input.damageDealt)),
            healingDone:Math.max(0,number(input.healingDone)),
            damageTaken:Math.max(0,number(input.damageTaken)),
            criticalHits:Math.max(0,Math.floor(number(input.criticalHits)))
        };
    }
    function snapshotFrom(source){
        if(!source){ return null; }
        return {
            battleToken:source.battleToken,
            active:!!source.active,
            result:source.result||null,
            combatants:Array.from(source.combatants.values())
                .filter(item=>item.side==="ally")
                .map(item=>copy(item))
        };
    }
    function currentSnapshot(){
        return session&&session.active?snapshotFrom(session):finalSnapshot&&copy(finalSnapshot);
    }
    function findCombatant(id){
        if(!session||!session.active||!id){ return null; }
        return session.combatants.get(String(id))||null;
    }
    function battleRoot(){
        return document.getElementById("battlePage");
    }
    function ensureBattleUi(){
        if(typeof document==="undefined"){ return null; }
        const root=battleRoot();
        if(!root){ return null; }

        let alertButton=document.getElementById("battleMechanismAlert");
        if(!alertButton){
            alertButton=document.createElement("button");
            alertButton.type="button";
            alertButton.id="battleMechanismAlert";
            alertButton.className="battle-mechanism-alert";
            alertButton.setAttribute("aria-label","查看 Boss 功能卡");
            alertButton.textContent="!";
            alertButton.addEventListener("click",()=>openBattleDrawer("boss"));
            root.appendChild(alertButton);
        }

        const staleScrim=document.getElementById("battleInsightScrim");
        if(staleScrim&&typeof staleScrim.remove==="function"){ staleScrim.remove(); }

        let bossDrawer=document.getElementById("battleBossMechanismDrawer");
        if(!bossDrawer){
            bossDrawer=document.createElement("aside");
            bossDrawer.id="battleBossMechanismDrawer";
            bossDrawer.className="battle-insight-drawer battle-boss-mechanism-drawer";
            bossDrawer.setAttribute("aria-label","Boss 功能卡");
            bossDrawer.innerHTML='<header><b>Boss 功能卡</b><button type="button" data-close>×</button></header><div class="battle-insight-drawer-body"></div>';
            bossDrawer.querySelector("[data-close]").addEventListener("click",closeBattleDrawer);
            root.appendChild(bossDrawer);
        }
        return {alertButton,bossDrawer};
    }
    function syncBattleEntryVisibility(){
        const ui=ensureBattleUi();
        if(!ui){ return; }
        const active=!!(session&&session.active);
        ui.alertButton.hidden=!active||bossMechanisms.length===0;
        if(!active){ closeBattleDrawer(); }
    }
    function mechanismMarkup(item){
        const remaining=item.remaining===null||item.remaining===undefined||item.remaining===""
            ?""
            :'<div><span>剩餘</span><b>'+escapeHtml(item.remaining)+'</b></div>';
        return '<article class="battle-mechanism-card">'+
            '<div class="battle-mechanism-title">'+
                (item.icon?'<img src="'+escapeHtml(item.icon)+'" alt="">':'<span aria-hidden="true">!</span>')+
                '<b>'+escapeHtml(item.name||"Boss 機制")+'</b>'+
            '</div>'+
            '<p>'+escapeHtml(item.effect||"")+'</p>'+
            '<div><span>觸發條件</span><b>'+escapeHtml(item.trigger||"戰鬥機制觸發")+'</b></div>'+
            '<div><span>目前狀態</span><b>'+escapeHtml(item.status||"生效中")+'</b></div>'+
            remaining+
        '</article>';
    }
    function renderBossDrawer(){
        const drawer=document.getElementById("battleBossMechanismDrawer");
        const body=drawer&&drawer.querySelector(".battle-insight-drawer-body");
        if(!body){ return; }
        body.innerHTML=bossMechanisms.length
            ?bossMechanisms.map(mechanismMarkup).join("")
            :'<p class="battle-insight-empty">目前場上沒有生效中的 Boss 功能卡。</p>';
    }
    function openBattleDrawer(kind){
        if(!session||!session.active){ return false; }
        if(kind!=="boss"||bossMechanisms.length===0){ return false; }
        const next="boss";
        const ui=ensureBattleUi();
        if(!ui){ return false; }

        if(openDrawer===next){ return true; }
        closeBattleDrawer();
        openDrawer=next;

        const drawer=ui.bossDrawer;
        drawer.classList.add("open");
        renderBossDrawer();
        if(typeof window.syncBattleUiPriorityLayer==="function"){ window.syncBattleUiPriorityLayer(); }
        return true;
    }
    function closeBattleDrawer(){
        if(typeof document!=="undefined"){
            const boss=document.getElementById("battleBossMechanismDrawer");
            if(boss){ boss.classList.remove("open"); }
        }
        openDrawer=null;
        if(typeof window.syncBattleUiPriorityLayer==="function"){ window.syncBattleUiPriorityLayer(); }
    }
    function syncOpenDrawer(){
        if(openDrawer==="boss"){ renderBossDrawer(); }
    }

    function begin(config){
        closeBattleDrawer();
        bossMechanisms=[];
        const input=config&&typeof config==="object"?config:{};
        session={
            battleToken:input.battleToken==null?null:input.battleToken,
            active:true,
            result:null,
            combatants:new Map()
        };
        (Array.isArray(input.combatants)?input.combatants:[]).forEach(registerCombatant);
        finalSnapshot=null;
        syncBattleEntryVisibility();
        syncOpenDrawer();
        return currentSnapshot();
    }
    function registerCombatant(input){
        if(!session||!session.active){ return false; }
        const next=normalizeCombatant(input);
        if(!next){ return false; }
        const current=session.combatants.get(next.id);
        if(current){
            next.damageDealt=current.damageDealt;
            next.healingDone=current.healingDone;
            next.damageTaken=current.damageTaken;
            next.criticalHits=current.criticalHits;
        }
        session.combatants.set(next.id,next);
        syncOpenDrawer();
        return true;
    }
    function recordDamage(input){
        if(!session||!session.active){ return false; }
        const event=input&&typeof input==="object"?input:{};
        const value=amount(event.amount);
        const source=findCombatant(event.sourceId);
        const target=findCombatant(event.targetId);
        if(source&&value>0){ source.damageDealt+=value; }
        if(target&&value>0){ target.damageTaken+=value; }
        syncOpenDrawer();
        return !!(source||target);
    }
    function recordHealing(input){
        if(!session||!session.active){ return false; }
        const event=input&&typeof input==="object"?input:{};
        const value=amount(event.amount);
        const source=findCombatant(event.sourceId);
        if(source&&value>0){ source.healingDone+=value;syncOpenDrawer();return true; }
        return false;
    }
    function recordCritical(input){
        if(!session||!session.active){ return false; }
        const event=input&&typeof input==="object"?input:{id:input};
        const source=findCombatant(event&&event.id);
        if(!source){ return false; }
        source.criticalHits+=1;
        syncOpenDrawer();
        return true;
    }
    function finish(input){
        if(!session){ return finalSnapshot&&copy(finalSnapshot); }
        if(session.active){
            session.active=false;
            session.result=input&&input.result?String(input.result):null;
            finalSnapshot=snapshotFrom(session);
        }
        bossMechanisms=[];
        closeBattleDrawer();
        syncBattleEntryVisibility();
        return finalSnapshot&&copy(finalSnapshot);
    }
    function getCombatantIdByBattleIndex(index){
        const source=session&&session.active?session:null;
        if(!source){ return null; }
        for(const item of source.combatants.values()){
            if(item.side==="ally"&&item.battleIndex===Number(index)){ return item.id; }
        }
        return null;
    }
    function setBossMechanisms(cards){
        bossMechanisms=(Array.isArray(cards)?cards:[]).map((item,index)=>({
            id:String(item&&item.id||("mechanism-"+index)),
            name:String(item&&item.name||"Boss 機制"),
            icon:String(item&&item.icon||""),
            effect:String(item&&item.effect||""),
            trigger:String(item&&item.trigger||"戰鬥機制觸發"),
            status:String(item&&item.status||"生效中"),
            remaining:item&&item.remaining!==undefined?item.remaining:null
        }));
        if(openDrawer==="boss"&&bossMechanisms.length===0){ closeBattleDrawer(); }
        syncBattleEntryVisibility();
        syncOpenDrawer();
        return copy(bossMechanisms);
    }
    function clearBossMechanisms(){ return setBossMechanisms([]); }

    window.FourSymbolsBattleStatistics=Object.freeze({
        version:"battle-statistics-v1",
        begin:begin,
        registerCombatant:registerCombatant,
        recordDamage:recordDamage,
        recordHealing:recordHealing,
        recordCritical:recordCritical,
        finish:finish,
        getSnapshot:function(){ const value=currentSnapshot();return value&&copy(value); },
        getFinalSnapshot:function(){ return finalSnapshot&&copy(finalSnapshot); },
        getCombatantIdByBattleIndex:getCombatantIdByBattleIndex,
        setBossMechanisms:setBossMechanisms,
        clearBossMechanisms:clearBossMechanisms,
        openBossMechanisms:function(){ return openBattleDrawer("boss"); },
        closeDrawer:closeBattleDrawer
    });
})();