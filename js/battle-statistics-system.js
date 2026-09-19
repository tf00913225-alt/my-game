/* =====================================================
   Battle Statistics / Battle Insight UI
   - One per-battle statistics owner keyed by combatant id.
   - UI reads the same live/final snapshot; no duplicate result calculation.
   - Drawers reuse FourSymbolsBattleFlow presentation locks.
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
    let releaseDrawerLock=null;
    let resultCloseCallback=null;

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
    function formatValue(value){
        return Math.max(0,Math.floor(number(value))).toLocaleString("zh-TW");
    }

    function battleRoot(){
        return document.getElementById("battlePage");
    }
    function appRoot(){
        return document.getElementById("app")||document.getElementById("game-content")||document.body;
    }
    function ensureBattleUi(){
        if(typeof document==="undefined"){ return null; }
        const root=battleRoot();
        if(!root){ return null; }

        let edge=document.getElementById("battleStatsEdgeButton");
        if(!edge){
            edge=document.createElement("button");
            edge.type="button";
            edge.id="battleStatsEdgeButton";
            edge.className="battle-stats-edge-button";
            edge.setAttribute("aria-label","詳細戰況");
            edge.innerHTML="<span>詳</span><span>細</span><span>戰</span><span>況</span>";
            edge.addEventListener("click",()=>openBattleDrawer("stats"));
            root.appendChild(edge);
        }

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

        let scrim=document.getElementById("battleInsightScrim");
        if(!scrim){
            scrim=document.createElement("button");
            scrim.type="button";
            scrim.id="battleInsightScrim";
            scrim.className="battle-insight-scrim";
            scrim.setAttribute("aria-label","關閉戰鬥資訊");
            scrim.addEventListener("click",closeBattleDrawer);
            root.appendChild(scrim);
        }

        let statsDrawer=document.getElementById("battleStatsDrawer");
        if(!statsDrawer){
            statsDrawer=document.createElement("aside");
            statsDrawer.id="battleStatsDrawer";
            statsDrawer.className="battle-insight-drawer battle-stats-drawer";
            statsDrawer.setAttribute("aria-label","詳細戰況");
            statsDrawer.innerHTML='<header><b>詳細戰況</b><button type="button" data-close>×</button></header><div class="battle-insight-drawer-body"></div>';
            statsDrawer.querySelector("[data-close]").addEventListener("click",closeBattleDrawer);
            root.appendChild(statsDrawer);
        }

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
        return {edge,alertButton,scrim,statsDrawer,bossDrawer};
    }
    function syncBattleEntryVisibility(){
        const ui=ensureBattleUi();
        if(!ui){ return; }
        const active=!!(session&&session.active);
        ui.edge.hidden=!active;
        ui.alertButton.hidden=!active||bossMechanisms.length===0;
        if(!active){ closeBattleDrawer(); }
    }
    function statRow(label,value){
        return '<div><span>'+escapeHtml(label)+'</span><b>'+formatValue(value)+'</b></div>';
    }
    function renderStatsDrawer(){
        const drawer=document.getElementById("battleStatsDrawer");
        const body=drawer&&drawer.querySelector(".battle-insight-drawer-body");
        if(!body){ return; }
        const snapshot=currentSnapshot();
        const combatants=snapshot&&Array.isArray(snapshot.combatants)?snapshot.combatants:[];
        body.innerHTML=combatants.length?combatants.map(item=>
            '<article class="battle-stat-card">'+
                '<div class="battle-stat-identity">'+
                    (item.portrait?'<img src="'+escapeHtml(item.portrait)+'" alt="">':'<span class="battle-stat-avatar-fallback" aria-hidden="true">◆</span>')+
                    '<div><b>'+escapeHtml(item.name)+'</b><small>'+escapeHtml(item.kind==="heroNpc"?"英雄 NPC":item.kind==="reinforcement"?"援軍":"玩家角色")+'</small></div>'+
                '</div>'+
                '<div class="battle-stat-grid">'+
                    statRow("總傷害",item.damageDealt)+
                    statRow("造成治療量",item.healingDone)+
                    statRow("承受傷害",item.damageTaken)+
                    statRow("暴擊次數",item.criticalHits)+
                '</div>'+
            '</article>'
        ).join(""):'<p class="battle-insight-empty">目前沒有可統計的我方戰鬥單位。</p>';
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
    function acquireDrawerPause(){
        const flow=window.FourSymbolsBattleFlow;
        if(!flow||typeof flow.isAutoBattle!=="function"||!flow.isAutoBattle()){ return null; }
        if(typeof flow.acquirePauseLock==="function"){
            return flow.acquirePauseLock("battle-insight-drawer");
        }
        return typeof flow.acquirePresentationLock==="function"
            ?flow.acquirePresentationLock("battle-insight-drawer")
            :null;
    }
    function openBattleDrawer(kind){
        if(!session||!session.active){ return false; }
        const next=kind==="boss"?"boss":"stats";
        if(next==="boss"&&bossMechanisms.length===0){ return false; }
        const ui=ensureBattleUi();
        if(!ui){ return false; }

        if(openDrawer===next){ return true; }
        closeBattleDrawer();
        openDrawer=next;
        releaseDrawerLock=acquireDrawerPause();

        ui.scrim.classList.add("open");
        const drawer=next==="boss"?ui.bossDrawer:ui.statsDrawer;
        drawer.classList.add("open");
        if(next==="boss"){ renderBossDrawer(); }else{ renderStatsDrawer(); }
        return true;
    }
    function closeBattleDrawer(){
        if(typeof document!=="undefined"){
            const scrim=document.getElementById("battleInsightScrim");
            const stats=document.getElementById("battleStatsDrawer");
            const boss=document.getElementById("battleBossMechanismDrawer");
            if(scrim){ scrim.classList.remove("open"); }
            if(stats){ stats.classList.remove("open"); }
            if(boss){ boss.classList.remove("open"); }
        }
        openDrawer=null;
        if(releaseDrawerLock){
            const release=releaseDrawerLock;
            releaseDrawerLock=null;
            release();
        }
    }
    function syncOpenDrawer(){
        if(openDrawer==="stats"){ renderStatsDrawer(); }
        else if(openDrawer==="boss"){ renderBossDrawer(); }
    }

    function ensureResultModal(){
        if(typeof document==="undefined"){ return null; }
        let modal=document.getElementById("battleStatisticsResultModal");
        if(modal){ return modal; }
        modal=document.createElement("section");
        modal.id="battleStatisticsResultModal";
        modal.className="battle-statistics-result-modal";
        modal.hidden=true;
        modal.innerHTML='<div class="battle-statistics-result-panel"><header><div><small>Battle Result Details（戰鬥詳細結算）</small><h2 data-title>戰鬥詳細結算</h2><p data-subtitle></p></div></header><div class="battle-statistics-result-body"></div><footer><button type="button" data-close>關閉</button></footer></div>';
        modal.querySelector("[data-close]").addEventListener("click",()=>hideResultDetails(true));
        appRoot().appendChild(modal);
        return modal;
    }
    function showResultDetails(options){
        if(!finalSnapshot||!Array.isArray(finalSnapshot.combatants)){ return false; }
        const modal=ensureResultModal();
        if(!modal){ return false; }
        const config=options&&typeof options==="object"?options:{};
        resultCloseCallback=typeof config.onClose==="function"?config.onClose:null;
        modal.querySelector("[data-title]").textContent=String(config.title||"戰鬥詳細結算");
        modal.querySelector("[data-subtitle]").textContent=String(config.subtitle||"");
        const body=modal.querySelector(".battle-statistics-result-body");
        body.innerHTML=finalSnapshot.combatants.map(item=>
            '<article class="battle-result-stat-card">'+
                '<div class="battle-stat-identity">'+
                    (item.portrait?'<img src="'+escapeHtml(item.portrait)+'" alt="">':'<span class="battle-stat-avatar-fallback" aria-hidden="true">◆</span>')+
                    '<div><b>'+escapeHtml(item.name)+'</b><small>'+escapeHtml(item.kind==="heroNpc"?"英雄 NPC":item.kind==="reinforcement"?"援軍":"玩家角色")+'</small></div>'+
                '</div>'+
                '<div class="battle-stat-grid">'+
                    statRow("總傷害",item.damageDealt)+
                    statRow("造成治療量",item.healingDone)+
                    statRow("承受傷害",item.damageTaken)+
                    statRow("暴擊次數",item.criticalHits)+
                '</div>'+
            '</article>'
        ).join("");
        modal.hidden=false;
        return true;
    }
    function hideResultDetails(invokeCallback){
        const modal=typeof document!=="undefined"?document.getElementById("battleStatisticsResultModal"):null;
        if(modal){ modal.hidden=true; }
        const callback=resultCloseCallback;
        resultCloseCallback=null;
        if(invokeCallback!==false&&typeof callback==="function"){
            try{ callback(); }catch(error){ console.error("戰鬥詳細結算關閉回呼失敗：",error); }
        }
    }

    function begin(config){
        closeBattleDrawer();
        hideResultDetails(false);
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
        return getSnapshot();
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
        openStatistics:function(){ return openBattleDrawer("stats"); },
        openBossMechanisms:function(){ return openBattleDrawer("boss"); },
        closeDrawer:closeBattleDrawer,
        showResultDetails:showResultDetails,
        hideResultDetails:hideResultDetails
    });
})();