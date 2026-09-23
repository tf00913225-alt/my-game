import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawn,spawnSync} from "node:child_process";

const baseUrl=String(process.env.DEV_BASE_URL||"https://dev.four-symbols-dev.pages.dev").replace(/\/$/,"");
const expectedSha=String(process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||"");
const qaUrl=`${baseUrl}/?battle-layer-audio-live-qa=${encodeURIComponent(expectedSha||Date.now())}`;
const artifactDir=path.resolve("artifacts/browser-qa");
fs.mkdirSync(artifactDir,{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function chromeBinary(){
    const configured=String(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||"").trim();
    if(configured&&fs.existsSync(configured)){ return configured; }
    for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
        const probe=spawnSync("bash",["-lc",`command -v ${name}`],{encoding:"utf8"});
        if(probe.status===0&&probe.stdout.trim()){ return probe.stdout.trim(); }
    }
    throw new Error("Headless Chrome/Chromium is not installed on the deployment runner.");
}

async function waitForJson(url,timeoutMs=15000){
    const started=Date.now();
    let lastError=null;
    while(Date.now()-started<timeoutMs){
        try{
            const response=await fetch(url);
            if(response.ok){ return await response.json(); }
        }catch(error){ lastError=error; }
        await sleep(150);
    }
    throw new Error(`Timed out waiting for ${url}: ${lastError?.message||"no response"}`);
}

class CdpClient{
    constructor(url){
        this.url=url;
        this.nextId=1;
        this.pending=new Map();
        this.socket=null;
        this.events=[];
    }
    async connect(){
        this.socket=new WebSocket(this.url);
        await new Promise((resolve,reject)=>{
            const timeout=setTimeout(()=>reject(new Error("CDP WebSocket connection timed out")),10000);
            this.socket.onopen=()=>{ clearTimeout(timeout); resolve(); };
            this.socket.onerror=event=>{ clearTimeout(timeout); reject(new Error(`CDP WebSocket error: ${event?.message||"unknown"}`)); };
        });
        this.socket.onmessage=async event=>{
            let raw=event.data;
            if(raw&&typeof raw!=="string"&&typeof raw.text==="function"){ raw=await raw.text(); }
            const message=JSON.parse(String(raw));
            if(!message.id){
                if(message.method==="Runtime.exceptionThrown"){
                    const details=message.params&&message.params.exceptionDetails;
                    this.events.push({
                        method:message.method,
                        text:details&&(
                            details.exception&&details.exception.description||
                            details.text
                        )||"Runtime exception",
                        url:details&&details.url||null,
                        lineNumber:details&&details.lineNumber,
                        columnNumber:details&&details.columnNumber
                    });
                }else if(message.method==="Runtime.consoleAPICalled"){
                    const type=message.params&&message.params.type;
                    if(type==="error"||type==="warning"){
                        this.events.push({
                            method:message.method,
                            type,
                            args:(message.params.args||[]).map(arg=>arg.value!==undefined?arg.value:arg.description)
                        });
                    }
                }
                if(this.events.length>50){ this.events.splice(0,this.events.length-50); }
                return;
            }
            const request=this.pending.get(message.id);
            if(!request){ return; }
            this.pending.delete(message.id);
            if(message.error){ request.reject(new Error(`${request.method}: ${message.error.message}`)); }
            else{ request.resolve(message.result||{}); }
        };
        this.socket.onclose=()=>{
            for(const request of this.pending.values()) request.reject(new Error(`CDP socket closed while waiting for ${request.method}`));
            this.pending.clear();
        };
    }
    send(method,params={}){
        const id=this.nextId++;
        return new Promise((resolve,reject)=>{
            this.pending.set(id,{resolve,reject,method});
            this.socket.send(JSON.stringify({id,method,params}));
        });
    }
    async eval(expression,awaitPromise=true){
        const response=await this.send("Runtime.evaluate",{expression,awaitPromise,returnByValue:true,userGesture:true});
        if(response.exceptionDetails){
            const text=response.exceptionDetails.exception?.description||response.exceptionDetails.text||"Runtime evaluation failed";
            throw new Error(text);
        }
        return response.result?.value;
    }
    close(){ try{ this.socket?.close(); }catch{} }
}

async function waitFor(client,expression,label,timeoutMs=30000){
    const started=Date.now();
    let last=null;
    while(Date.now()-started<timeoutMs){
        try{
            last=await client.eval(`Boolean(${expression})`);
            if(last){ return; }
        }catch(error){ last=error.message; }
        await sleep(180);
    }
    throw new Error(`Timed out waiting for ${label}. Last result: ${String(last)}`);
}

async function prepareAccountFirstRuntime(client,features){
    await waitFor(client,"window.FourSymbolsStartupPolicy&&(FourSymbolsStartupPolicy.getState()==='ERROR'||['AUTH_REQUIRED','NEED_CHARACTER','READY','OFFLINE_READY'].includes(FourSymbolsStartupPolicy.getState())||(document.getElementById('privacyConsentGate')&&!document.getElementById('privacyConsentGate').hidden&&document.getElementById('startupProgress')?.getAttribute('aria-valuenow')==='100'))","First Play/privacy/account startup destination",120000);
    let state=await client.eval("FourSymbolsStartupPolicy.getState()");
    const privacyVisible=state!=="ERROR"&&await client.eval("Boolean(document.getElementById('privacyConsentGate')&&!document.getElementById('privacyConsentGate').hidden)");
    if(privacyVisible){
        await waitFor(client,"(()=>{const gate=document.getElementById('privacyConsentGate');const policy=gate?.contentWindow?.document?.getElementById('policyFrame');return !!(policy&&policy.contentDocument&&policy.contentDocument.readyState==='complete');})()","privacy policy document",15000);
        await client.eval("(()=>{const gate=document.getElementById('privacyConsentGate');const consent=gate.contentWindow.document;const policy=consent.getElementById('policyFrame');const root=policy.contentDocument.scrollingElement||policy.contentDocument.documentElement;policy.contentWindow.scrollTo(0,root.scrollHeight);policy.contentWindow.dispatchEvent(new Event('scroll'));return true;})()");
        await waitFor(client,"document.getElementById('privacyConsentGate').contentWindow.document.getElementById('agreeButton').disabled===false","privacy agree enabled",10000);
        await client.eval("document.getElementById('privacyConsentGate').contentWindow.document.getElementById('agreeButton').click();true");
        await waitFor(client,"window.FourSymbolsStartupPolicy&&['AUTH_REQUIRED','NEED_CHARACTER','READY','OFFLINE_READY','ERROR'].includes(FourSymbolsStartupPolicy.getState())","account-first startup destination after privacy consent",60000);
        state=await client.eval("FourSymbolsStartupPolicy.getState()");
    }
    if(state==="ERROR"){ throw new Error("Live Firebase startup failed before feature QA"); }
    if(state==="AUTH_REQUIRED"){
        await client.eval("document.getElementById('firebaseGuestButton').click();true");
        await waitFor(client,"['NEED_CHARACTER','READY','OFFLINE_READY','ERROR'].includes(FourSymbolsStartupPolicy.getState())","anonymous UID save resolution",60000);
        state=await client.eval("FourSymbolsStartupPolicy.getState()");
        if(state==="ERROR"){ throw new Error("Live anonymous UID/save resolution failed"); }
    }
    await client.eval(`Promise.all(${JSON.stringify(features)}.map(feature=>FourSymbolsFeatures.ensure(feature,"live-browser-qa")))`);
    if(state==="NEED_CHARACTER"){
        const creationAttempt=await client.eval(`(()=>{
            const input=document.getElementById('creationId');
            if(!input||typeof createCharacter!=='function'){return {created:false,errors:["creation input/function unavailable"]};}
            input.value='QA俠客';
            const errors=[];
            const originalError=console.error;
            console.error=function(){
                try{
                    errors.push(Array.from(arguments).map(value=>{
                        if(value instanceof Error){ return value.name+":"+value.message+(value.code?(" code="+value.code):""); }
                        if(value&&typeof value==="object"){
                            try{return JSON.stringify(value);}catch(_){return String(value);}
                        }
                        return String(value);
                    }).join(" | "));
                }catch(_){}
                return originalError.apply(this,arguments);
            };
            try{
                return {created:createCharacter()===true,errors};
            }finally{
                console.error=originalError;
            }
        })()`);
        if(!creationAttempt.created){
            const diagnostics=await client.eval(`(()=>{
                let targetSlot=null;
                try{ targetSlot=typeof creationTargetSlot!=="undefined"?creationTargetSlot:null; }catch(_){}
                let persisted=null;
                try{
                    const repo=window.FourSymbolsAccountSave;
                    const uid=repo&&repo.getActiveUid&&repo.getActiveUid();
                    const read=uid&&repo.readForUid?repo.readForUid(uid):null;
                    persisted={
                        uid:uid||null,
                        saveKey:uid&&repo.saveKey?repo.saveKey(uid):null,
                        readStatus:read&&read.status||null,
                        savedPlayerId:read&&read.save&&read.save.player&&read.save.player.id||null
                    };
                }catch(error){ persisted={error:String(error&&error.message||error)}; }
                return {
                    startupState:window.FourSymbolsStartupPolicy&&FourSymbolsStartupPolicy.getState(),
                    canCreate:Boolean(window.FourSymbolsStartupPolicy&&FourSymbolsStartupPolicy.canCreateCharacter()),
                    targetSlot,
                    inputValue:document.getElementById('creationId')?.value||null,
                    creationVisible:getComputedStyle(document.getElementById('creationPage')).display,
                    playerId:typeof player!=="undefined"?player.id:null,
                    saveOwner:persisted,
                    guarded:Boolean(window.createCharacter&&window.createCharacter.__v174PersistedPrimaryGuard),
                    creationErrors:${JSON.stringify(creationAttempt.errors)}
                };
            })()`);
            throw new Error(
                "Live anonymous account could not complete the formal character-creation flow: "+
                JSON.stringify(diagnostics)+
                " CDP="+JSON.stringify(client.events.slice(-20))
            );
        }
        await waitFor(client,"FourSymbolsStartupPolicy.getState()==='READY'&&getComputedStyle(document.getElementById('gameInterface')).display!=='none'","anonymous character creation completion",30000);
        state="READY";
    }
    return state;
}

const evidence={status:"RUNNING",expectedSha,devUrl:baseUrl,checks:{}};
const chrome=chromeBinary();
const debugPort=9223;
const profile=path.join("/tmp",`four-symbols-battle-layer-qa-${process.pid}`);
const child=spawn(chrome,[
    "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--hide-scrollbars",
    `--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,"--window-size=412,915","about:blank"
],{stdio:["ignore","pipe","pipe"]});
let chromeStderr="";
child.stderr.on("data",chunk=>{ chromeStderr+=String(chunk); });
let client=null;

try{
    const targets=await waitForJson(`http://127.0.0.1:${debugPort}/json/list`);
    const page=targets.find(target=>target.type==="page");
    assert.ok(page?.webSocketDebuggerUrl,"Chrome DevTools page target was not available");
    client=new CdpClient(page.webSocketDebuggerUrl);
    await client.connect();
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Network.enable");
    await client.send("Emulation.setDeviceMetricsOverride",{width:412,height:915,deviceScaleFactor:3,mobile:true,screenWidth:412,screenHeight:915});
    await client.send("Page.navigate",{url:qaUrl});
    await waitFor(client,"document.readyState==='complete'","page load");
    const accountState=await prepareAccountFirstRuntime(client,["abyss","boss-tower"]);
    evidence.checks.accountState=accountState;
    await waitFor(client,"window.__v174TwoTierAbyssInstalled===true&&typeof window.v174AbyssBuildRoster==='function'","two-tier Abyss runtime");
    try{
        await waitFor(client,"typeof window.v132LaunchDungeonBattle==='function'&&window.v141Audio&&typeof window.v141Audio.playSkill==='function'","battle/audio runtime");
    }catch(error){
        const diagnostics=await client.eval(`(()=>({
            gameplayCoreReady:window.FourSymbolsFeatures?.isReady?.("gameplay-core")??null,
            battleFeatureReady:window.FourSymbolsFeatures?.isReady?.("battle")??null,
            v132Type:typeof window.v132LaunchDungeonBattle,
            v141AudioType:typeof window.v141Audio,
            v141PlaySkillType:typeof window.v141Audio?.playSkill,
            scripts:[...document.querySelectorAll("script[data-feature-bundle]")].map(script=>({
                bundle:script.dataset.featureBundle||null,
                src:script.src
            }))
        }))()`);
        throw new Error(error.message+" diagnostics="+JSON.stringify(diagnostics)+" CDP="+JSON.stringify(client.events.slice(-25)));
    }

    await client.eval(`(()=>{
        if(typeof showPage==='function'){showPage('home');}
        if(typeof window.v54RenderHomeRoster==='function'){window.v54RenderHomeRoster();}
        return true;
    })()`);
    await waitFor(client,"document.querySelector('.v-fixed-formation-entry[data-feature=\"gameplay-core\"]')","home Formation entry");
    await client.eval("document.querySelector('.v-fixed-formation-entry[data-feature=\"gameplay-core\"]').click();true");
    await waitFor(client,"document.getElementById('homeFeatureModal')?.classList.contains('show')&&document.querySelectorAll('#homeFeatureModalBody .v-fixed-formation-slot').length===6","real Formation editor");
    const formationInteraction=await client.eval(`(()=>{
        const owner=window.FourSymbolsBattlefieldSlots;
        const slots=owner?.allySlots||[];
        const entry=document.querySelector('.v-fixed-formation-entry');
        const before=owner?.getSerializableAllyFormation?.();
        const source=slots.find(slot=>Number.isInteger(owner.getCharacterAtAllySlot(slot)));
        const destination=slots.find(slot=>!Number.isInteger(owner.getCharacterAtAllySlot(slot)));
        const characterIndex=source?owner.getCharacterAtAllySlot(source):null;
        const clickSlot=slot=>document.querySelector('#homeFeatureModalBody .v-fixed-formation-slot[data-slot="'+slot+'"]')?.click();
        clickSlot(source);
        clickSlot(destination);
        const moved=Number.isInteger(characterIndex)&&owner.getCharacterAtAllySlot(destination)===characterIndex;
        clickSlot(destination);
        clickSlot(source);
        const restored=Number.isInteger(characterIndex)&&owner.getCharacterAtAllySlot(source)===characterIndex;
        const panel=document.querySelector('#homeFeatureModalBody .v-fixed-formation-panel');
        const slotCount=document.querySelectorAll('#homeFeatureModalBody .v-fixed-formation-slot').length;
        const after=owner?.getSerializableAllyFormation?.();
        if(typeof closeHomeFeature==='function'){closeHomeFeature();}
        return {
            entryFeature:entry?.dataset.feature||null,panel:!!panel,slotCount,
            source,destination,characterIndex,moved,restored,
            before:before?.characterIndexToSlot||null,after:after?.characterIndexToSlot||null
        };
    })()`);
    evidence.checks.formationInteraction=formationInteraction;
    assert.equal(formationInteraction.entryFeature,"gameplay-core","Formation entry must load the canonical gameplay owner");
    assert.equal(formationInteraction.panel,true,"Formation must open the real editor instead of an empty shell");
    assert.equal(formationInteraction.slotCount,6,"Formation editor must expose all six fixed ally slots");
    assert.ok(formationInteraction.source&&formationInteraction.destination,"Formation QA needs one occupied and one empty slot");
    assert.equal(formationInteraction.moved,true,"Formation editor must move the selected character to the chosen slot");
    assert.equal(formationInteraction.restored,true,"Formation editor must support a second real move and restore the test position");

    const bootstrap=await client.eval(`(()=>{
        try{sessionStorage.setItem('sixiang_startup_session_ready_v1','1');}catch(_){}
        if(typeof player!=='undefined'&&player){
            player.id=player.id||'battle-layer-live-qa';
            player.name=player.name||'QA俠客';
            player.level=40;
            player.hp=Math.max(9999,Number(player.hp)||0);
            player.sp=Math.max(9999,Number(player.sp)||0);
            player.element='fire';
        }
        window.v133GetHighestCreatedCharacterLevel=()=>40;
        if(typeof showPage==='function'){showPage('dungeon');}
        const roster=v174AbyssBuildRoster(40,0,0);
        window.__battleLayerQaDungeonOutcome=null;
        const started=window.v132LaunchDungeonBattle(roster,outcome=>{
            window.__battleLayerQaDungeonOutcome=outcome;
            if(typeof showPage==='function'){showPage('dungeon');}
        });
        window.__battleLayerQaInitialBattleToken=Number(battleToken)||0;
        return {
            started:!!started,
            rosterCount:roster.length,
            skillVolumeScale:window.v141Audio?.skillVolumeScale||null,
            combatFeedbackVolumeScale:window.v141Audio?.combatFeedbackVolumeScale||null
        };
    })()`);
    evidence.checks.bootstrap=bootstrap;
    assert.equal(bootstrap.started,true,"Shared dungeon launcher did not start a real battle");
    assert.equal(bootstrap.rosterCount,8,"Abyss pre-stage QA roster must contain 5 regular plus 3 elite enemies");
    assert.equal(bootstrap.skillVolumeScale,2,"Deployed skill SFX multiplier must be exactly 2.0 (+100%)");
    assert.equal(bootstrap.combatFeedbackVolumeScale,2,"Deployed general battle feedback multiplier must be exactly 2.0 (+100%)");

    await waitFor(client,"(()=>{const page=document.getElementById('battlePage');const rect=page?.getBoundingClientRect();return page?.classList.contains('active')&&!page.classList.contains('v141-preparing-entry')&&!page.classList.contains('v141-entry-moving')&&rect?.width>0&&rect?.height>0&&document.getElementById('battlePlayerCard0')&&document.querySelector('#battlePlayerCard0 .hp-bar')&&document.querySelector('#battleMonster0 .monster-hp');})()","visible real battle after entry transition",15000);

    const layout=await client.eval(`(()=>{
        const rectFor=element=>{
            if(!element){return null;}
            const rect=element.getBoundingClientRect();
            return {left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height};
        };
        const inside=(inner,outer,tolerance=1)=>!!inner&&!!outer&&
            inner.left>=outer.left-tolerance&&inner.right<=outer.right+tolerance&&
            inner.top>=outer.top-tolerance&&inner.bottom<=outer.bottom+tolerance;
        const intersects=(a,b)=>!!a&&!!b&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5&&
            Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5;
        const sizeRange=rects=>({
            count:rects.length,
            minWidth:Math.min(...rects.map(rect=>rect.width)),
            maxWidth:Math.max(...rects.map(rect=>rect.width)),
            minHeight:Math.min(...rects.map(rect=>rect.height)),
            maxHeight:Math.max(...rects.map(rect=>rect.height))
        });
        const owner=window.FourSymbolsBattlefieldSlots;
        const wrap=rectFor(document.querySelector('.battle-wrap'));
        const enemy=rectFor(document.querySelector('.battle-enemy-region'));
        const center=rectFor(document.querySelector('.battle-center-region'));
        const ally=rectFor(document.querySelector('.battle-ally-region'));
        const infoRegion=rectFor(document.querySelector('.battle-info-region'));
        const infoToggle=rectFor(document.getElementById('battleInfoToggle'));
        const action=rectFor(document.getElementById('battleActionRegion'));
        const info=rectFor(document.getElementById('battleInfo'));
        const elementBoxNode=document.querySelector('.battle-element-box-button');
        const elementBox=rectFor(elementBoxNode);
        const elementBoxLogical=elementBoxNode?{
            width:elementBoxNode.offsetWidth,
            height:elementBoxNode.offsetHeight,
            computedWidth:getComputedStyle(elementBoxNode).width,
            computedHeight:getComputedStyle(elementBoxNode).height
        }:null;
        const enemyArea=rectFor(document.getElementById('battleMonsterArea'));
        const allyArea=rectFor(document.getElementById('battlePlayerRow'));
        const enemySlotRects=owner.enemySlots.map(slot=>owner.getSlotRect(slot)).filter(Boolean);
        const allySlotRects=owner.allySlots.map(slot=>owner.getSlotRect(slot)).filter(Boolean);
        const cards=Array.from(document.querySelectorAll('.v-fixed-enemy-slot > .battle-monster,.v-fixed-ally-slot > .battle-player'))
            .filter(card=>card.offsetParent!==null);
        const hud=cards.map(card=>{
            const name=card.querySelector('.battle-monster-name,.battle-player-id');
            const hp=card.querySelector('.monster-hp,.hp-bar');
            const sp=card.querySelector('.monster-sp,.sp-bar');
            const visible=element=>!!element&&getComputedStyle(element).visibility==='visible'&&
                getComputedStyle(element).display!=='none'&&element.getBoundingClientRect().width>0&&
                element.getBoundingClientRect().height>0;
            return {id:card.id,name:visible(name),hp:visible(hp),sp:visible(sp)};
        });
        const enemyCards=cards.filter(card=>card.classList.contains('battle-monster')).map(rectFor);
        const allyCards=cards.filter(card=>card.classList.contains('battle-player')).map(rectFor);
        return {
            viewport:{width:innerWidth,height:innerHeight},
            pageClass:document.getElementById('battlePage')?.className||'',
            regions:{wrap,enemy,center,ally,infoRegion,infoToggle,action,info,elementBox,elementBoxLogical,enemyArea,allyArea},
            centerBackground:getComputedStyle(document.querySelector('.battle-center-region')).backgroundImage,
            infoExpanded:document.querySelector('.battle-info-region')?.classList.contains('is-expanded')||false,
            infoAria:document.getElementById('battleInfoToggle')?.getAttribute('aria-expanded')||null,
            separation:{
                enemyBeforeCenter:enemy.bottom<=center.top+1,
                centerBeforeAlly:center.bottom<=ally.top+1,
                actionInsideCenter:inside(action,center),
                allyFillsBattleBottom:Math.abs(ally.bottom-wrap.bottom)<=1,
                collapsedHandleInside:inside(infoToggle,wrap),
                collapsedInfoBelowBattle:info.top>=wrap.bottom-1,
                enemyAreaInsideEnemy:inside(enemyArea,enemy),
                allyAreaInsideAlly:inside(allyArea,ally),
                enemyCardsClearCenter:enemyCards.every(card=>!intersects(card,center)),
                allyCardsClearCenter:allyCards.every(card=>!intersects(card,center))
            },
            enemySlots:sizeRange(enemySlotRects),
            allySlots:sizeRange(allySlotRects),
            hud
        };
    })()`);
    evidence.checks.battleLayout=layout;
    assert.equal(layout.viewport.width,412,"Live battle QA must use the portrait mobile viewport");
    assert.match(layout.pageClass,/v-fixed-slot-render-v2/,"Deployed battle must use the Fixed Slot V2 layout owner");
    assert.equal(layout.centerBackground,"none","The middle operation region must not keep a black translucent background");
    assert.equal(layout.infoExpanded,false,"Battle info must start collapsed");
    assert.equal(layout.infoAria,"false","The collapsed drawer handle must expose its state accessibly");
    Object.entries(layout.separation).forEach(([name,value])=>assert.equal(value,true,`Battle region separation failed: ${name}`));
    assert.equal(layout.enemySlots.count,10,"The deployed enemy region must expose all ten fixed geometry slots");
    assert.equal(layout.allySlots.count,6,"The deployed ally region must expose both three-column fixed geometry layers");
    assert.ok(layout.enemySlots.maxWidth-layout.enemySlots.minWidth<=1,"Enemy slot widths must be equal");
    assert.ok(layout.enemySlots.maxHeight-layout.enemySlots.minHeight<=1,"Enemy slot heights must be equal");
    assert.ok(layout.allySlots.maxWidth-layout.allySlots.minWidth<=1,"Ally slot widths must be equal");
    assert.ok(layout.allySlots.maxHeight-layout.allySlots.minHeight<=1,"Ally slot heights must be equal");
    assert.equal(layout.regions.elementBoxLogical.width,66,"Element Box button width must be the restored 66px layout size");
    assert.equal(layout.regions.elementBoxLogical.height,66,"Element Box button height must be the restored 66px layout size");
    assert.ok(layout.enemySlots.minHeight>92,"Enemy slots must remain visibly larger than the previous compact cards");
    assert.ok(layout.allySlots.minHeight>100,"Ally slots must retain the enlarged portrait layout");
    assert.ok(layout.hud.length>=9,"The real Abyss battle must expose one ally and eight enemy card HUDs");
    assert.ok(layout.hud.every(entry=>entry.name&&entry.hp&&entry.sp),"Every live combatant must keep its name, HP and SP visible");

    const normalAttackPerformance=await client.eval(`(async()=>{
        const metrics=window.FourSymbolsBattleRuntimeMetrics;
        const page=document.getElementById('battlePage');
        const normalButton=Array.from(document.querySelectorAll('#mainBattleMenu > .menu-button')).find(button=>
            String(button.getAttribute('onclick')||'').includes("prepareAction('normal')")
        );
        if(!metrics||!page||!normalButton){return {available:false};}

        const originalAuto=typeof autoBattle!=='undefined'?autoBattle:false;
        const originalIndex=typeof activeBattleCharacterIndex!=='undefined'?activeBattleCharacterIndex:0;
        const originalActionReady=typeof actionReady!=='undefined'?actionReady:false;
        const originalPending=typeof pendingAction!=='undefined'?pendingAction:null;
        if(typeof autoBattle!=='undefined'){autoBattle=false;}
        if(typeof activeBattleCharacterIndex!=='undefined'){activeBattleCharacterIndex=0;}
        if(typeof actionReady!=='undefined'){actionReady=false;}
        if(typeof pendingAction!=='undefined'){pendingAction=null;}
        if(typeof clearBattleTargetSelectionMode==='function'){clearBattleTargetSelectionMode();}

        const repairHooks=['v17351SyncInventoryQa','v17351PreviewQuestMilestones','v17363SyncFunctionalFixes','v78ApplyCharacterInventoryLayout'];
        const originals={};
        const repairCalls={};
        repairHooks.forEach(name=>{
            repairCalls[name]=0;
            if(typeof window[name]==='function'){
                originals[name]=window[name];
                window[name]=function(){repairCalls[name]++;return originals[name].apply(this,arguments);};
            }
        });

        let mutationCount=0;
        const mutationObserver=new MutationObserver(records=>{mutationCount+=records.length;});
        mutationObserver.observe(page,{subtree:true,childList:true,attributes:true,characterData:true});

        const longTasks=[];
        let longTaskObserver=null;
        if(typeof PerformanceObserver==='function'&&PerformanceObserver.supportedEntryTypes?.includes('longtask')){
            longTaskObserver=new PerformanceObserver(list=>{
                list.getEntries().forEach(entry=>longTasks.push({duration:entry.duration,startTime:entry.startTime}));
            });
            longTaskObserver.observe({type:'longtask',buffered:false});
        }

        metrics.enabled=true;
        metrics.reset();
        const started=performance.now();
        normalButton.click();
        const syncDuration=performance.now()-started;
        await new Promise(resolve=>setTimeout(resolve,120));
        const counters=metrics.snapshot();
        const targetSelecting=page.querySelector('#battleActionRegion')?.classList.contains('target-selecting')||false;
        mutationObserver.disconnect();
        if(longTaskObserver){longTaskObserver.disconnect();}
        metrics.enabled=false;

        repairHooks.forEach(name=>{if(originals[name]){window[name]=originals[name];}});
        if(typeof actionReady!=='undefined'){actionReady=originalActionReady;}
        if(typeof pendingAction!=='undefined'){pendingAction=originalPending;}
        if(typeof activeBattleCharacterIndex!=='undefined'){activeBattleCharacterIndex=originalIndex;}
        if(typeof autoBattle!=='undefined'){autoBattle=originalAuto;}
        if(typeof clearBattleTargetSelectionMode==='function'){clearBattleTargetSelectionMode();}
        if(typeof closeMenus==='function'){closeMenus();}
        if(typeof updateActionHudVisibility==='function'){updateActionHudVisibility();}

        return {
            available:true,syncDuration,mutationCount,targetSelecting,counters,repairCalls,
            longTaskCount:longTasks.length,
            maxLongTaskDuration:longTasks.reduce((max,item)=>Math.max(max,item.duration),0)
        };
    })()`);
    evidence.checks.normalAttackPerformance=normalAttackPerformance;
    assert.equal(normalAttackPerformance.available,true,"Normal-attack performance instrumentation must be available");
    assert.equal(normalAttackPerformance.targetSelecting,true,"Normal attack click must immediately enter target selection");
    assert.ok(normalAttackPerformance.syncDuration<100,`Normal attack synchronous click path is too slow: ${normalAttackPerformance.syncDuration}ms`);
    assert.ok(normalAttackPerformance.mutationCount<80,`Normal attack produced excessive DOM mutations: ${normalAttackPerformance.mutationCount}`);
    assert.equal(normalAttackPerformance.counters.syncMonsterPortraits,0,"Normal attack click must not rescan monster portraits");
    assert.equal(normalAttackPerformance.counters.quickBarRebuild,0,"Normal attack click must not rebuild the skill quick bar");
    assert.equal(normalAttackPerformance.counters.repairScheduler,0,"Normal attack click must not invoke a repair scheduler");
    Object.entries(normalAttackPerformance.repairCalls).forEach(([name,count])=>
        assert.equal(count,0,`Normal attack click unexpectedly invoked ${name}`)
    );
    assert.ok(normalAttackPerformance.maxLongTaskDuration<120,`Normal attack generated a long task of ${normalAttackPerformance.maxLongTaskDuration}ms`);

    const spQuickBar=await client.eval(`(()=>{
        const bar=document.getElementById('skillQuickBarGrid');
        if(!bar||typeof ensureSkillQuickBarButtons!=='function'||typeof syncSkillQuickBarButton!=='function'){return null;}
        const buttons=ensureSkillQuickBarButtons(bar);
        const button=buttons[0];
        const skill=typeof skillDatabase!=='undefined'&&(skillDatabase.waterBall||Object.values(skillDatabase).find(item=>item&&item.spCost!==undefined));
        if(!button||!skill){return null;}
        const skillId=skill.id||'waterBall';
        const cost=Number(skill.spCost!==undefined?skill.spCost:skill.cost)||0;
        syncSkillQuickBarButton(button,skillId,skill,1,cost,true);
        const block=button.querySelector('.sq-sp-block');
        const state={
            skillId,cost,
            disabled:button.disabled,
            insufficient:button.classList.contains('sp-insufficient'),
            blockHidden:block?block.hidden:null,
            blockDisplay:block?getComputedStyle(block).display:null
        };
        if(typeof populateSkillQuickBar==='function'){populateSkillQuickBar();}
        return state;
    })()`);
    evidence.checks.spQuickBar=spQuickBar;
    assert.ok(spQuickBar,"Canonical quick-bar sufficient-SP state must be testable");
    assert.equal(spQuickBar.disabled,false,`${spQuickBar.skillId} should be enabled when enoughSP is true`);
    assert.equal(spQuickBar.insufficient,false,`${spQuickBar.skillId} must not keep the insufficient-SP class when enoughSP is true`);
    assert.equal(spQuickBar.blockHidden,true,`${spQuickBar.skillId} insufficient-SP overlay should be semantically hidden`);
    assert.equal(spQuickBar.blockDisplay,"none",`${spQuickBar.skillId} insufficient-SP overlay must be visually hidden`);

    const infoDrawer=await client.eval(`(()=>{
        const region=document.querySelector('#battlePage .battle-info-region');
        const button=document.getElementById('battleInfoToggle');
        const info=document.getElementById('battleInfo');
        const turn=document.getElementById('battleTurnIndicator');
        if(!region||!button||!info||!turn||typeof toggleBattleInfoPanel!=='function'){return null;}
        region.style.transition='none';
        const rect=node=>{const value=node.getBoundingClientRect();return {top:value.top,bottom:value.bottom,height:value.height};};
        const snapshot=()=>({
            region:rect(region),
            info:rect(info),
            aria:button.getAttribute('aria-expanded'),
            className:region.className,
            label:button.textContent.trim(),
            regionBackground:getComputedStyle(region).backgroundColor,
            buttonBackground:getComputedStyle(button).backgroundColor,
            infoBackground:getComputedStyle(info).backgroundColor,
            turnOpacity:getComputedStyle(turn).opacity
        });
        toggleBattleInfoPanel();
        const expanded=snapshot();
        toggleBattleInfoPanel();
        const collapsed=snapshot();
        region.style.removeProperty('transition');
        return {expanded,collapsed};
    })()`);
    evidence.checks.battleInfoDrawer=infoDrawer;
    assert.ok(infoDrawer,"Live battle must expose the formal battle-info drawer owner");
    assert.equal(infoDrawer.expanded.aria,"true","Tapping the handle must expand battle info");
    assert.equal(infoDrawer.expanded.label,"返回","Expanded battle info handle must become 返回");
    assert.match(infoDrawer.expanded.className,/is-expanded/);
    assert.ok(infoDrawer.expanded.info.top<layout.regions.wrap.bottom,"Expanded battle info must slide into the battlefield viewport");
    assert.equal(infoDrawer.collapsed.aria,"false","Tapping again must collapse battle info");
    assert.equal(infoDrawer.collapsed.label,"戰鬥資訊","Collapsed battle info handle must restore 戰鬥資訊");
    assert.equal(infoDrawer.collapsed.regionBackground,"rgba(0, 0, 0, 0)","Collapsed battle-info drawer shell must stay transparent");
    assert.equal(infoDrawer.expanded.regionBackground,"rgba(0, 0, 0, 0)","Expanded battle-info drawer shell must stay transparent");
    assert.notEqual(infoDrawer.collapsed.buttonBackground,"rgba(0, 0, 0, 0)","Collapsed 戰鬥資訊 tab must retain its own backing");
    assert.notEqual(infoDrawer.expanded.buttonBackground,"rgba(0, 0, 0, 0)","Expanded 返回 tab must retain its own backing");
    assert.equal(infoDrawer.collapsed.infoBackground,"rgba(0, 0, 0, 0)","Collapsed battle log body must remain transparent/off-canvas");
    assert.notEqual(infoDrawer.expanded.infoBackground,"rgba(0, 0, 0, 0)","Expanded battle log body alone owns the black backing");
    assert.equal(infoDrawer.collapsed.turnOpacity,"1","Collapsed drawer keeps the current round visible");
    assert.equal(infoDrawer.expanded.turnOpacity,"1","Expanded drawer keeps the current round visible");
    assert.doesNotMatch(infoDrawer.collapsed.className,/is-expanded/);
    assert.ok(infoDrawer.collapsed.info.top>=layout.regions.wrap.bottom-1,"Collapsed battle info must return below the battlefield viewport");

    const resourceLayers=await client.eval(`(()=>{
        const playerCard=document.getElementById('battlePlayerCard0');
        const monsterCard=document.getElementById('battleMonster0');
        const playerHp=playerCard?.querySelector('.hp-bar');
        const playerSp=playerCard?.querySelector('.sp-bar');
        const monsterHp=monsterCard?.querySelector('.monster-hp');
        const monsterSp=monsterCard?.querySelector('.monster-sp');
        const playerName=playerCard?.querySelector('.battle-player-id');
        const monsterName=monsterCard?.querySelector('.battle-monster-name');
        const playerArt=playerCard?.querySelector('.v174-battle-art');
        const monsterArt=monsterCard?.querySelector('.v174-battle-art');
        const rect=node=>{const value=node?.getBoundingClientRect();return value?{top:value.top,bottom:value.bottom,height:value.height}:null;};
        const playerStatus=document.createElement('div');
        playerStatus.className='v143-status-visual v143-status-visual-rage v143-status-visual--pulse';
        const monsterStatus=document.createElement('div');
        monsterStatus.className='v143-status-visual v143-status-visual-rage v143-status-visual--pulse';
        playerCard.appendChild(playerStatus);
        monsterCard.appendChild(monsterStatus);
        const result={
            playerHpZ:Number(getComputedStyle(playerHp).zIndex||0),
            playerSpZ:Number(getComputedStyle(playerSp).zIndex||0),
            playerStatusZ:Number(getComputedStyle(playerStatus).zIndex||0),
            monsterHpZ:Number(getComputedStyle(monsterHp).zIndex||0),
            monsterSpZ:Number(getComputedStyle(monsterSp).zIndex||0),
            monsterStatusZ:Number(getComputedStyle(monsterStatus).zIndex||0),
            playerHpVisible:getComputedStyle(playerHp).visibility,
            monsterHpVisible:getComputedStyle(monsterHp).visibility,
            player:{art:rect(playerArt),hp:rect(playerHp),sp:rect(playerSp),name:rect(playerName)},
            monster:{art:rect(monsterArt),hp:rect(monsterHp),sp:rect(monsterSp),name:rect(monsterName)},
            logicalHeights:{playerHp:playerHp?.offsetHeight||0,monsterHp:monsterHp?.offsetHeight||0}
        };
        playerStatus.remove();
        monsterStatus.remove();
        return result;
    })()`);
    evidence.checks.resourceLayers=resourceLayers;
    assert.ok(resourceLayers.playerHpZ>resourceLayers.playerStatusZ,"Player HP bar must render above status VFX");
    assert.ok(resourceLayers.playerSpZ>resourceLayers.playerStatusZ,"Player SP bar must render above status VFX");
    assert.ok(resourceLayers.monsterHpZ>resourceLayers.monsterStatusZ,"Enemy HP bar must render above status VFX");
    assert.ok(resourceLayers.monsterSpZ>resourceLayers.monsterStatusZ,"Enemy SP bar must render above status VFX");
    assert.equal(resourceLayers.playerHpVisible,"visible","Player HP bar must remain visible");
    assert.equal(resourceLayers.monsterHpVisible,"visible","Enemy HP bar must remain visible");
    for(const [side,hud] of Object.entries({player:resourceLayers.player,monster:resourceLayers.monster})){
        assert.ok(hud.art.bottom<=hud.hp.top+1,`${side} artwork must end close to and above HP`);
        assert.ok(hud.hp.bottom<=hud.sp.top+1,`${side} HP must sit above SP`);
        assert.ok(hud.sp.bottom<=hud.name.top+1,`${side} name must sit below both resource bars`);
    }
    assert.equal(resourceLayers.logicalHeights.monsterHp,resourceLayers.logicalHeights.playerHp,"Enemy and player resource bars must use the same formal owner height");
    assert.equal(resourceLayers.logicalHeights.monsterHp,11,"Battle resource bars must use the shared 11px logical height");

    const iceArrowRain=await client.eval(`(()=>{
        const director=window.v142SkillAnimationDirector;
        const owner=window.FourSymbolsBattlefieldSlots;
        if(!director||typeof director.play!=='function'||typeof window.v142GetSkillAnimationConfig!=='function'||!owner){return null;}
        const config=Object.assign({},window.v142GetSkillAnimationConfig('iceArrowRain'),{duration:1100,resolveDuration:1100});
        const targetIds=(typeof currentBattleMonsters!=='undefined'?currentBattleMonsters:[]).filter(index=>
            typeof monsters!=='undefined'&&monsters[index]&&monsters[index].alive
        );
        const targetId=targetIds[0]??null;
        const gate=director.play(config,{
            side:'player',actorIndex:0,targetSide:'monster',targetId,targetIds,
            targetContract:{version:'battle-target-contract-v1',targetSide:'monster',targetId,targetIds},
            key:'battle-layout-ice-arrow-rain-'+Date.now()
        });
        window.__battleLayoutIceGate=gate;
        const stage=document.getElementById('v143-skill-stage');
        const sprites=stage?Array.from(stage.querySelectorAll('.v143-vfx-sprite')):[];
        const sprite=sprites[0]||null;
        const bounds=owner.getSideRect('monster');
        const css=stage?getComputedStyle(stage):null;
        return {
            config:{id:config.id,targetType:config.targetType,duration:config.duration},
            stageCount:document.querySelectorAll('#v143-skill-stage').length,
            stageSkill:stage?.dataset.skill||null,
            spriteCount:sprites.length,
            placement:sprite?.dataset.placement||null,
            frameFit:sprite?.dataset.frameFit||null,
            frameAspect:Number(sprite?.dataset.frameAspect||0),
            areaId:sprite?.dataset.areaId||null,
            targetIndexes:String(sprite?.dataset.targetIndexes||'').split(',').filter(Boolean),
            geometrySlots:String(sprite?.dataset.geometrySlots||'').split(',').filter(Boolean),
            spriteBox:sprite?{
                left:Number.parseFloat(sprite.style.left),top:Number.parseFloat(sprite.style.top),
                width:Number.parseFloat(sprite.style.width),height:Number.parseFloat(sprite.style.height)
            }:null,
            bounds,
            stageOverflow:css?.overflow||null,
            emitted:sprite?.dataset.emittedVisual||null,
            gateId:gate?.id||null
        };
    })()`);
    evidence.checks.iceArrowRainFullRange=iceArrowRain;
    assert.equal(iceArrowRain?.config?.targetType,"all","Ice Arrow Rain must use its final all-target rule in production");
    assert.equal(iceArrowRain?.stageCount,1,"Ice Arrow Rain must own exactly one V143 stage");
    assert.equal(iceArrowRain?.stageSkill,"iceArrowRain","The deployed V143 stage must render Ice Arrow Rain");
    assert.equal(iceArrowRain?.spriteCount,1,"A full-range cast must render one shared raster node");
    assert.equal(iceArrowRain?.placement,"battlefield","All-target VFX must use the complete battlefield placement");
    assert.equal(iceArrowRain?.frameFit,"cover","All-target VFX must preserve its source-frame aspect");
    assert.equal(iceArrowRain?.areaId,"fixed-enemy-zone","Ice Arrow Rain must bind to the complete enemy fixed zone");
    assert.equal(iceArrowRain?.geometrySlots.length,10,"Full-range VFX geometry must retain all ten slots regardless of occupancy");
    assert.equal(iceArrowRain?.targetIndexes.length,8,"The real eight-enemy battle must expose all living targets to Ice Arrow Rain");
    assert.ok(iceArrowRain.spriteBox.width>=iceArrowRain.bounds.width-1,"Ice Arrow Rain must cover the complete enemy width");
    assert.ok(iceArrowRain.spriteBox.height>=iceArrowRain.bounds.height-1,"Ice Arrow Rain must cover the complete enemy height");
    assert.ok(Math.abs(iceArrowRain.spriteBox.width/iceArrowRain.spriteBox.height-iceArrowRain.frameAspect)<=.02,"Ice Arrow Rain must not flatten its source frame");
    assert.ok(Math.abs(iceArrowRain.spriteBox.left-iceArrowRain.bounds.centerX)<=1,"Ice Arrow Rain must stay centered on the complete enemy region");
    assert.ok(Math.abs(iceArrowRain.spriteBox.top-iceArrowRain.bounds.centerY)<=1,"Ice Arrow Rain must stay centered on the complete enemy region");
    assert.equal(iceArrowRain.stageOverflow,"visible","The VFX owner must not clip full-range animation paint");
    assert.equal(iceArrowRain.emitted,"true","Ice Arrow Rain must emit a visible production sprite");

    const statusInspectionDuringVfx=await client.eval(`(()=>{
        if(typeof clearBattleTargetSelectionMode==='function'){clearBattleTargetSelectionMode();}
        const playerOpened=typeof openBattleStatusDetailModal==='function'&&openBattleStatusDetailModal('player',0)===true;
        const playerModal=document.getElementById('battleStatusDetailModal');
        const playerVisible=!!(playerModal&&!playerModal.hidden&&playerModal.getAttribute('aria-hidden')==='false');
        if(typeof closeBattleStatusDetailModal==='function'){closeBattleStatusDetailModal();}
        const monsterIndex=(typeof currentBattleMonsters!=='undefined'?currentBattleMonsters:[]).find(index=>monsters[index]?.alive);
        const monsterOpened=Number.isInteger(monsterIndex)&&typeof openBattleStatusDetailModal==='function'&&openBattleStatusDetailModal('monster',monsterIndex)===true;
        const monsterModal=document.getElementById('battleStatusDetailModal');
        const monsterVisible=!!(monsterModal&&!monsterModal.hidden&&monsterModal.getAttribute('aria-hidden')==='false');
        if(typeof closeBattleStatusDetailModal==='function'){closeBattleStatusDetailModal();}
        return {playerOpened,playerVisible,monsterIndex,monsterOpened,monsterVisible,stageStillMounted:!!document.getElementById('v143-skill-stage')};
    })()`);
    evidence.checks.statusInspectionDuringVfx=statusInspectionDuringVfx;
    assert.equal(statusInspectionDuringVfx.playerOpened,true,"Read-only player status must open during active VFX");
    assert.equal(statusInspectionDuringVfx.playerVisible,true,"Player status modal must become visible during active VFX");
    assert.equal(statusInspectionDuringVfx.monsterOpened,true,"Read-only enemy status must open during active VFX");
    assert.equal(statusInspectionDuringVfx.monsterVisible,true,"Enemy status modal must become visible during active VFX");
    assert.equal(statusInspectionDuringVfx.stageStillMounted,true,"Read-only status inspection must not destroy the active VFX lifecycle");
    await sleep(1350);
    const iceGate=await client.eval(`(()=>{
        const gate=window.__battleLayoutIceGate;
        return {done:!!gate?.done,reason:gate?.reason||null,completionCount:gate?.completionCount||0,stageExists:!!document.getElementById('v143-skill-stage')};
    })()`);
    evidence.checks.iceArrowRainCompletion=iceGate;
    assert.equal(iceGate.done,true,"Ice Arrow Rain must release its animation gate");
    assert.equal(iceGate.completionCount,1,"Ice Arrow Rain gate must complete exactly once");
    assert.ok(["v143-raster-complete","v142-v143-visual-complete","v142-render-safety-deadline"].includes(iceGate.reason),"Ice Arrow Rain must finish through its formal visual-complete deadline");
    assert.equal(iceGate.stageExists,false,"Completed full-range VFX must remove its stage");

    const windFlame=await client.eval(`(()=>{
        const director=window.v142SkillAnimationDirector;
        const owner=window.FourSymbolsBattlefieldSlots;
        const snapshot=owner?.getActiveEnemySnapshot?.();
        const candidates=(typeof currentBattleMonsters!=='undefined'?currentBattleMonsters:[]).filter(index=>
            typeof monsters!=='undefined'&&monsters[index]&&monsters[index].alive&&
            owner.slotMeta[owner.getEnemySlotForMonster(snapshot,index)]?.column===3
        );
        const targetId=candidates[0]??(typeof currentBattleMonsters!=='undefined'?currentBattleMonsters[0]:0);
        const primarySlot=owner.getEnemySlotForMonster(snapshot,targetId);
        const config=Object.assign({},window.v142GetSkillAnimationConfig('stormCircle'),{duration:1100,resolveDuration:1100});
        const targetIds=[targetId];
        const gate=director.play(config,{
            side:'player',actorIndex:0,targetSide:'monster',targetId,targetIds,
            targetContract:{version:'battle-target-contract-v1',targetSide:'monster',targetId,targetIds},
            key:'battle-layout-wind-flame-'+Date.now()
        });
        window.__battleLayoutWindGate=gate;
        const stage=document.getElementById('v143-skill-stage');
        const sprites=stage?Array.from(stage.querySelectorAll('.v143-vfx-sprite')):[];
        const sprite=sprites[0]||null;
        const bounds=owner.getGeometryRectFromShape('monster',primarySlot,'tri');
        return {
            config:{id:config.id,targetType:config.targetType,duration:config.duration},
            targetId,primarySlot,
            stageCount:document.querySelectorAll('#v143-skill-stage').length,
            stageSkill:stage?.dataset.skill||null,
            spriteCount:sprites.length,
            placement:sprite?.dataset.placement||null,
            frameFit:sprite?.dataset.frameFit||null,
            frameAspect:Number(sprite?.dataset.frameAspect||0),
            targetIndexes:String(sprite?.dataset.targetIndexes||'').split(',').filter(Boolean),
            geometrySlots:String(sprite?.dataset.geometrySlots||'').split(',').filter(Boolean),
            spriteBox:sprite?{
                left:Number.parseFloat(sprite.style.left),top:Number.parseFloat(sprite.style.top),
                width:Number.parseFloat(sprite.style.width),height:Number.parseFloat(sprite.style.height)
            }:null,
            bounds,
            emitted:sprite?.dataset.emittedVisual||null,
            globalSpriteCount:document.querySelectorAll('.v143-vfx-sprite').length,
            gateId:gate?.id||null
        };
    })()`);
    evidence.checks.windFlameTriRange=windFlame;
    assert.equal(windFlame?.config?.targetType,"tri","Wind Flame must use its final three-target rule in production");
    assert.equal(windFlame?.stageCount,1,"Wind Flame must own exactly one V143 stage");
    assert.equal(windFlame?.stageSkill,"stormCircle","The deployed V143 stage must render Wind Flame");
    assert.equal(windFlame?.spriteCount,1,"Wind Flame must not render two simultaneous videos");
    assert.equal(windFlame?.globalSpriteCount,1,"No stale V143 sprite may coexist with Wind Flame");
    assert.equal(windFlame?.placement,"group","Three-target VFX must use fixed group geometry");
    assert.equal(windFlame?.frameFit,"cover","Three-target VFX must preserve its source-frame aspect");
    assert.equal(windFlame?.targetIndexes.length,1,"This live check deliberately supplies only one surviving target");
    assert.equal(windFlame?.geometrySlots.length,3,"Wind Flame must retain a three-slot footprint for a single surviving target");
    assert.ok(windFlame.spriteBox.width>=windFlame.bounds.width-1,"Wind Flame must cover the fixed three-slot width");
    assert.ok(windFlame.spriteBox.height>=windFlame.bounds.height-1,"Wind Flame must cover the fixed three-slot height");
    assert.ok(Math.abs(windFlame.spriteBox.width/windFlame.spriteBox.height-windFlame.frameAspect)<=.02,"Wind Flame must not flatten its source frame");
    assert.equal(windFlame.emitted,"true","Wind Flame must emit a visible production sprite");

    const rangeScreenshot=await client.send("Page.captureScreenshot",{format:"png",fromSurface:true});
    if(rangeScreenshot.data){ fs.writeFileSync(path.join(artifactDir,"battle-layout-wind-flame-mobile.png"),Buffer.from(rangeScreenshot.data,"base64")); }

    await sleep(1350);
    const windGate=await client.eval(`(()=>{
        const gate=window.__battleLayoutWindGate;
        return {done:!!gate?.done,reason:gate?.reason||null,completionCount:gate?.completionCount||0,stageExists:!!document.getElementById('v143-skill-stage')};
    })()`);
    evidence.checks.windFlameCompletion=windGate;
    assert.equal(windGate.done,true,"Wind Flame must release its animation gate");
    assert.equal(windGate.completionCount,1,"Wind Flame gate must complete exactly once");
    assert.ok(["v143-raster-complete","v142-v143-visual-complete","v142-render-safety-deadline"].includes(windGate.reason),"Wind Flame must finish through its formal visual-complete deadline");
    assert.equal(windGate.stageExists,false,"Completed Wind Flame VFX must remove its stage");

    const waterOrb=await client.eval(`(()=>{
        const director=window.v142SkillAnimationDirector;
        const owner=window.FourSymbolsBattlefieldSlots;
        const snapshot=owner?.getActiveEnemySnapshot?.();
        const targetId=(typeof currentBattleMonsters!=='undefined'?currentBattleMonsters:[]).find(index=>
            typeof monsters!=='undefined'&&monsters[index]&&monsters[index].alive
        );
        const primarySlot=owner.getEnemySlotForMonster(snapshot,targetId);
        const config=Object.assign({},window.v142GetSkillAnimationConfig('waterBall'),{duration:1100,resolveDuration:1100});
        const gate=director.play(config,{
            side:'player',actorIndex:0,targetSide:'monster',targetId,targetIds:[targetId],
            targetContract:{version:'battle-target-contract-v1',targetSide:'monster',targetId,targetIds:[targetId]},
            key:'battle-layout-water-orb-'+Date.now()
        });
        window.__battleLayoutWaterGate=gate;
        const stage=document.getElementById('v143-skill-stage');
        const sprite=stage?.querySelector('.v143-vfx-sprite')||null;
        const bounds=owner.getGeometryRectFromShape('monster',primarySlot,'tri');
        return {
            targetId,primarySlot,bounds,
            frameFit:sprite?.dataset.frameFit||null,
            frameAspect:Number(sprite?.dataset.frameAspect||0),
            geometrySlots:String(sprite?.dataset.geometrySlots||'').split(',').filter(Boolean),
            targetIndexes:String(sprite?.dataset.targetIndexes||'').split(',').filter(Boolean),
            spriteBox:sprite?{width:Number.parseFloat(sprite.style.width),height:Number.parseFloat(sprite.style.height)}:null,
            emitted:sprite?.dataset.emittedVisual||null
        };
    })()`);
    evidence.checks.waterOrbTriRange=waterOrb;
    assert.equal(waterOrb?.frameFit,"cover","Water Orb must preserve its source-frame aspect");
    assert.equal(waterOrb?.geometrySlots.length,3,"Water Orb must keep a fixed three-slot footprint");
    assert.equal(waterOrb?.targetIndexes.length,1,"Water Orb geometry must not depend on surviving target count");
    assert.ok(waterOrb.spriteBox.width>=waterOrb.bounds.width-1&&waterOrb.spriteBox.height>=waterOrb.bounds.height-1,"Water Orb must cover its fixed three-slot geometry");
    assert.ok(Math.abs(waterOrb.spriteBox.width/waterOrb.spriteBox.height-waterOrb.frameAspect)<=.02,"Water Orb must not flatten its square source frame");
    assert.equal(waterOrb.emitted,"true","Water Orb must emit a visible production sprite");
    const waterScreenshot=await client.send("Page.captureScreenshot",{format:"png",fromSurface:true});
    if(waterScreenshot.data){ fs.writeFileSync(path.join(artifactDir,"battle-layout-water-orb-mobile.png"),Buffer.from(waterScreenshot.data,"base64")); }
    await sleep(1350);
    const waterGate=await client.eval(`(()=>{const gate=window.__battleLayoutWaterGate;return {done:!!gate?.done,reason:gate?.reason||null,completionCount:gate?.completionCount||0,stageExists:!!document.getElementById('v143-skill-stage')};})()`);
    evidence.checks.waterOrbCompletion=waterGate;
    assert.equal(waterGate.done,true,"Water Orb must release its animation gate");
    assert.equal(waterGate.completionCount,1,"Water Orb gate must complete exactly once");
    assert.equal(waterGate.stageExists,false,"Completed Water Orb VFX must remove its stage");

    /* Capture the production cast and the stage it creates in the same browser
       task. The battle remains live, so a later CDP poll may observe the next
       action after this 1.45s presentation has legitimately been superseded. */
    const productionDeclaration=await client.eval(`(()=>{
        if(typeof castDamageSkill!=='function'||typeof skillDatabase==='undefined'||!skillDatabase.explosiveFlurry){
            return {declared:false,phase:typeof battlePhase!=='undefined'?battlePhase:null};
        }
        if(typeof queuedPlayerActions!=='undefined'){queuedPlayerActions[0]={action:'explosiveFlurry',target:2,targetAlly:null};}
        if(typeof selectedMonster!=='undefined'){selectedMonster=2;}
        if(typeof activeBattleCharacterIndex!=='undefined'){activeBattleCharacterIndex=0;}
        if(typeof player!=='undefined'&&player){player.sp=Math.max(9999,Number(player.sp)||0);player.element='fire';}
        if(typeof getSkillLevel==='function'&&!window.__battleLayerQaGetSkillLevelOriginal){
            window.__battleLayerQaGetSkillLevelOriginal=getSkillLevel;
            const original=getSkillLevel;
            getSkillLevel=function(key,id){return id==='explosiveFlurry'?1:original.apply(this,arguments);};
        }
        const phase=typeof battlePhase!=='undefined'?battlePhase:null;
        if(phase!=='declare'||typeof startResolutionPhase!=='function'){return {declared:false,phase};}
        /* startResolutionPhase starts index zero synchronously. Re-sorting the
           queue after that call can move the already-running monster away from
           index zero and move the player into an index that will never run.
           Make the fixture's player legitimately win initiative before the
           production queue is built, then restore the persisted stat. */
        const originalAgility=Number(player.agility)||0;
        player.agility=Math.max(originalAgility,100000);
        try{ startResolutionPhase(battleToken); }
        finally{ player.agility=originalAgility; }
        return {
            declared:true,phase,phaseAfter:typeof battlePhase!=='undefined'?battlePhase:null,
            firstCombatant:Array.isArray(initiativeQueue)?initiativeQueue[0]?.type||null:null
        };
    })()`);
    evidence.checks.productionDeclaration=productionDeclaration;
    assert.equal(productionDeclaration.declared,true,"Real Fire Flurry must enter through the formal declaration phase");
    assert.equal(productionDeclaration.firstCombatant,"player","Live flow QA must put the declared player action first");
    await waitFor(client,"document.getElementById('v143-skill-stage')?.dataset.skill==='explosiveFlurry'","formal Fire Flurry resolution",8000);
    const productionCastSnapshot=await client.eval(`(()=>{
        const stage=document.getElementById('v143-skill-stage');
        const style=stage?getComputedStyle(stage):null;
        return {
            triggered:true,
            skill:stage?.dataset.skill||null,
            visibility:style?.visibility||null,
            opacity:style?.opacity||null
        };
    })()`);
    evidence.checks.skillLayerBeforeElementBox=productionCastSnapshot;
    assert.equal(productionCastSnapshot.triggered,true,"Production Fire Explosive Flurry action could not be invoked");
    assert.equal(productionCastSnapshot.skill,"explosiveFlurry","Expected real Fire Flurry V143 layer before Element Box opens");
    assert.equal(productionCastSnapshot.visibility,"visible","Skill layer must be visible during normal battle presentation");

    const combatProgressBefore=await client.eval(`({
        battleActive:!!battleActive,turn:Number(turn)||0,initiativeIndex:Number(initiativeIndex)||0,
        battleToken:Number(battleToken)||0,stageSkill:document.getElementById('v143-skill-stage')?.dataset.skill||null
    })`);
    await sleep(8500);
    const combatProgressAfter=await client.eval(`({
        battleActive:!!battleActive,turn:Number(turn)||0,initiativeIndex:Number(initiativeIndex)||0,
        battleToken:Number(battleToken)||0,stageCount:document.querySelectorAll('#v143-skill-stage').length,
        latestGateReason:window.v142SkillAnimationDirector?.getLatest?.()?.reason||null
    })`);
    const combatAdvanced=!combatProgressAfter.battleActive||
        combatProgressAfter.battleToken!==combatProgressBefore.battleToken||
        combatProgressAfter.turn!==combatProgressBefore.turn||
        combatProgressAfter.initiativeIndex!==combatProgressBefore.initiativeIndex;
    evidence.checks.combatProgress={before:combatProgressBefore,after:combatProgressAfter,advanced:combatAdvanced};
    assert.equal(combatAdvanced,true,"A real player cast must release initiative so player/enemy combat can continue");
    assert.ok(combatProgressAfter.stageCount<=1,"Combat progression must never leave duplicate V143 stages");

    /* The production cast above proves that a real battle action reaches V143.
       A live battle keeps advancing between CDP round trips, so another formal
       action may legitimately supersede any presentation started by the QA.
       Start the bounded presentation, open the real modal and snapshot the same
       DOM node in one browser task. This isolates the overlap contract without
       pausing combat or requiring an expired/superseded stage to stay mounted. */
    const modalOverlapSnapshot=await client.eval(`(()=>{
        const director=window.v142SkillAnimationDirector;
        const getConfig=window.v142GetSkillAnimationConfig;
        if(!director||typeof director.play!=='function'||typeof getConfig!=='function'){return null;}
        const config=Object.assign({},getConfig('explosiveFlurry'),{duration:4000,resolveDuration:4000});
        const targetId=2;
        const targetIds=[targetId];
        const gate=director.play(config,{
            side:'player',actorIndex:0,targetSide:'monster',targetId,targetIds,
            targetContract:{version:'battle-target-contract-v1',targetSide:'monster',targetId,targetIds},
            key:'battle-layer-modal-overlap-'+Date.now()
        });
        const stageBefore=document.getElementById('v143-skill-stage');
        let opened=null;
        if(typeof openHomeFeature==='function'){openHomeFeature('autoBattleSettings');opened='openHomeFeature';}
        else if(typeof openAutoBattleSettings==='function'){openAutoBattleSettings();opened='openAutoBattleSettings';}
        const stage=document.getElementById('v143-skill-stage');
        const gameStage=document.getElementById('game-stage');
        const modal=document.getElementById('homeFeatureModal');
        const panel=document.getElementById('autoBattleSettingsPanel');
        const modalBody=document.getElementById('homeFeatureModalBody');
        const stageStyle=stage?getComputedStyle(stage):null;
        const gameStageStyle=gameStage?getComputedStyle(gameStage):null;
        const modalStyle=modal?getComputedStyle(modal):null;
        const panelStyle=panel?getComputedStyle(panel):null;
        return {
            presentation:{skill:config.id,duration:config.duration,gateId:gate?.id||null},
            opened,
            layers:{
                bodyFocus:document.body.classList.contains('v162-element-box-settings-open'),
                stageWasMountedBeforeOpen:!!stageBefore,
                stageStillExists:!!stage,
                sameStage:stage===stageBefore,
                stageSkill:stage?.dataset.skill||null,
                stageVisibility:stageStyle?.visibility||null,
                stageOpacity:stageStyle?.opacity||null,
                stageZ:Number(stageStyle?.zIndex||0),
                gameStageZ:Number(gameStageStyle?.zIndex||0),
                modalShow:!!modal?.classList.contains('show'),
                modalConnected:!!modal?.isConnected,
                panelConnected:!!panel?.isConnected,
                panelParent:panel?.parentElement?.id||null,
                modalDisplay:modalStyle?.display||null,
                panelDisplay:panelStyle?.display||null,
                modalBodyConnected:!!modalBody?.isConnected,
                skillVolumeScale:window.v141Audio?.skillVolumeScale||null,
                combatFeedbackVolumeScale:window.v141Audio?.combatFeedbackVolumeScale||null
            }
        };
    })()`);
    const modalOverlapPresentation=modalOverlapSnapshot?.presentation||null;
    const opened=modalOverlapSnapshot?.opened||null;
    const elementBoxLayers=modalOverlapSnapshot?.layers||{};
    evidence.checks.modalOverlapPresentation=modalOverlapPresentation;
    evidence.checks.elementBoxOpenRoute=opened;
    evidence.checks.elementBoxLayers=elementBoxLayers;
    assert.equal(modalOverlapPresentation?.skill,"explosiveFlurry","Modal overlap QA must use the formal Fire Flurry V143 presentation");
    assert.equal(modalOverlapPresentation?.duration,4000,"Modal overlap QA must start a bounded production V143 presentation");
    assert.ok(opened,"No Element Box settings opener is available");
    assert.equal(elementBoxLayers.bodyFocus,true,"Element Box focus class must be active");
    assert.equal(elementBoxLayers.stageWasMountedBeforeOpen,true,"Modal overlap QA must start from a mounted V143 stage");
    assert.equal(elementBoxLayers.stageStillExists,true,"V143 lifecycle stage must remain mounted while its presentation is suppressed");
    assert.equal(elementBoxLayers.sameStage,true,"Opening Element Box must preserve the active V143 stage node");
    assert.equal(elementBoxLayers.stageSkill,"explosiveFlurry","Element Box overlap must inspect the intended V143 skill stage");
    assert.equal(elementBoxLayers.stageVisibility,"hidden","Skill presentation must be hidden while Element Box settings owns focus");
    assert.equal(Number(elementBoxLayers.stageOpacity),0,"Skill presentation opacity must be zero while Element Box settings owns focus");
    assert.ok(elementBoxLayers.gameStageZ>elementBoxLayers.stageZ,"Game/Element Box stacking context must be above the document-level V143 skill stage");
    assert.equal(elementBoxLayers.modalShow,true,"The shared Element Box modal must be in its real open state");
    assert.equal(elementBoxLayers.modalConnected,true,"The shared Element Box modal must remain connected to the document");
    assert.equal(elementBoxLayers.panelConnected,true,"The real Element Box settings panel must remain connected to the document");
    assert.equal(elementBoxLayers.panelParent,"homeFeatureModalBody","The real Element Box settings panel must be borrowed into the shared modal body");
    assert.notEqual(elementBoxLayers.modalDisplay,"none","The shared Element Box modal must not be display:none");
    assert.notEqual(elementBoxLayers.panelDisplay,"none","The real Element Box settings panel must not be display:none");
    assert.equal(elementBoxLayers.modalBodyConnected,true,"The shared modal body must remain connected");
    assert.equal(elementBoxLayers.skillVolumeScale,2,"Live audio engine must expose the 2.0 skill SFX scale");
    assert.equal(elementBoxLayers.combatFeedbackVolumeScale,2,"Live audio engine must expose the 2.0 general combat feedback scale");

    const screenshot=await client.send("Page.captureScreenshot",{format:"png",fromSurface:true});
    if(screenshot.data){ fs.writeFileSync(path.join(artifactDir,"battle-layer-element-box-mobile.png"),Buffer.from(screenshot.data,"base64")); }

    await client.eval(`(()=>{
        const director=window.v142SkillAnimationDirector;
        if(director&&typeof director.dispose==='function'){director.dispose();}
        return document.querySelectorAll('#v143-skill-stage').length;
    })()`);

    const endTransitionStart=await client.eval(`(()=>{
        if(typeof closeHomeFeature==='function'){closeHomeFeature();}
        const initialToken=Number(window.__battleLayerQaInitialBattleToken)||0;
        if(typeof battleActive!=='undefined'&&battleActive){
            (typeof currentBattleMonsters!=='undefined'?currentBattleMonsters:[]).forEach(index=>{
                if(typeof monsters!=='undefined'&&monsters[index]){monsters[index].hp=0;monsters[index].alive=false;}
            });
        }
        const ended=typeof battleActive!=='undefined'&&!battleActive
            ?true:(typeof checkBattleEnd==='function'?checkBattleEnd():false);
        return {initialToken,ended};
    })()`);
    await waitFor(client,"typeof battleActive!=='undefined'&&battleActive===false","battle victory flow release",5000);
    await waitFor(client,"['win','lose'].includes(window.__battleLayerQaDungeonOutcome?.result)","battle-end dungeon callback",6000);
    const endTransition=await client.eval(`({
        ended:${JSON.stringify(true)},battleActive:!!battleActive,
        tokenAdvanced:(Number(battleToken)||0)>${endTransitionStart.initialToken},
        outcome:window.__battleLayerQaDungeonOutcome?.result||null,
        activePage:document.querySelector('.page.active')?.id||null,
        battlePageActive:document.getElementById('battlePage')?.classList.contains('active')||false,
        stageCount:document.querySelectorAll('#v143-skill-stage').length
    })`);
    endTransition.ended=endTransitionStart.ended;
    evidence.checks.battleEndTransition=endTransition;
    assert.equal(endTransition.ended,true,"Defeating the final targets must enter the formal battle-end path");
    assert.equal(endTransition.battleActive,false,"Battle-end path must clear battleActive");
    assert.equal(endTransition.tokenAdvanced,true,"Battle-end path must invalidate the completed battle token");
    assert.ok(["win","lose"].includes(endTransition.outcome),"Dungeon battle-end path must deliver its completion callback");
    assert.equal(endTransition.battlePageActive,false,"Battle-end path must leave the battle page");
    assert.ok(endTransition.activePage,"Battle-end callback must hand control to a non-battle page");
    assert.equal(endTransition.stageCount,0,"Battle-end path must leave no V143 stage behind");

    const resultModalReadability=await client.eval(`(()=>{
        const api=window.FourSymbolsBattleStatistics;
        if(!api||typeof api.showResultDetails!=='function'){return null;}
        const shown=api.showResultDetails({title:'戰鬥詳細結算',subtitle:'Browser QA'});
        const modal=document.getElementById('battleStatisticsResultModal');
        const panel=modal?.querySelector('.battle-statistics-result-panel');
        const title=modal?.querySelector('[data-title]');
        const label=modal?.querySelector('.battle-stat-grid span');
        const value=modal?.querySelector('.battle-stat-grid b');
        const close=modal?.querySelector('[data-close]');
        const rect=node=>{const r=node?.getBoundingClientRect();return r?{width:r.width,height:r.height}:null;};
        const result={
            shown,parentId:modal?.parentElement?.id||null,hidden:modal?.hidden??true,
            panel:rect(panel),title:rect(title),label:rect(label),value:rect(value),close:rect(close),
            titleFont:getComputedStyle(title).fontSize,labelFont:getComputedStyle(label).fontSize,
            valueFont:getComputedStyle(value).fontSize,closeFont:getComputedStyle(close).fontSize
        };
        return result;
    })()`);
    evidence.checks.resultModalReadability=resultModalReadability;
    assert.ok(resultModalReadability?.shown,"Detailed battle result modal must open from the final snapshot");
    assert.equal(resultModalReadability.parentId,"game-content","Battle result modal must use the legacy game-content coordinate owner");
    assert.equal(resultModalReadability.hidden,false,"Detailed battle result modal must be visible while inspected");
    assert.equal(resultModalReadability.titleFont,"22px","Detailed result title should use normal mobile typography");
    assert.equal(resultModalReadability.valueFont,"19px","Detailed result values should not dominate the panel");
    assert.ok(resultModalReadability.title?.height>=24,`Battle result title is too small on mobile: ${resultModalReadability.title?.height}`);
    assert.ok(resultModalReadability.label?.height>=13,`Battle result label is too small on mobile: ${resultModalReadability.label?.height}`);
    assert.ok(resultModalReadability.value?.height>=18,`Battle result value is too small on mobile: ${resultModalReadability.value?.height}`);
    assert.ok(resultModalReadability.close?.height>=50,`Battle result close button is too small on mobile: ${resultModalReadability.close?.height}`);
    const resultScreenshot=await client.send("Page.captureScreenshot",{format:"png",fromSurface:true});
    if(resultScreenshot.data){ fs.writeFileSync(path.join(artifactDir,"battle-result-modal-mobile.png"),Buffer.from(resultScreenshot.data,"base64")); }
    await client.eval("window.FourSymbolsBattleStatistics?.hideResultDetails(false);true");
    const bossBootstrap=await client.eval(`(()=>{
        if(typeof player!=='undefined'&&player){
            player.level=100;
            player.hp=Math.max(99999,Number(player.hp)||0);
            player.sp=Math.max(99999,Number(player.sp)||0);
        }
        window.v133GetHighestCreatedCharacterLevel=()=>100;
        if(typeof showPage==='function'){showPage('boss');}
        return {
            started:typeof vGameplayStartBoss==='function'&&vGameplayStartBoss('personal','personal-70')===true,
            owner:window.FourSymbolsBossBattle?.version||null
        };
    })()`);
    evidence.checks.bossBootstrap=bossBootstrap;
    assert.equal(bossBootstrap.started,true,"The exact candidate must start a real Boss-mode battle");
    assert.equal(bossBootstrap.owner,"boss-target-entity-v1","Boss mode must expose the single target-entity owner");
    await waitFor(client,"battleActive===true&&FourSymbolsBossBattle.isActive()&&document.querySelector('.v-fixed-boss-footprint > .gameplay-boss-card')","real Boss target-entity battlefield",15000);
    await waitFor(client,"!document.getElementById('battlePage')?.classList.contains('v141-preparing-entry')&&!document.getElementById('battlePage')?.classList.contains('v141-entry-moving')","completed Boss entrance choreography",5000);

    const bossMode=await client.eval(`(()=>{
        const bossOwner=window.FourSymbolsBossBattle;
        const gameplay=window.GameplaySystem;
        const slotOwner=window.FourSymbolsBattlefieldSlots;
        const bossIndex=bossOwner.getBossIndex();
        const boss=monsters[bossIndex];
        const heal=gameplay.debugSpawnBossObject('heal','live-qa-heal');
        const flag=gameplay.debugSpawnBossObject('amplify','live-qa-flag');
        const healIndex=monsters.indexOf(heal);
        const flagIndex=monsters.indexOf(flag);
        boss.hp=Math.floor(boss.maxHP*.5);
        bossOwner.processRound();
        const reinforcements=currentBattleMonsters.filter(index=>monsters[index]?.unitKind==='boss-reinforcement');
        const snapshot=slotOwner.getActiveEnemySnapshot();
        const slotOf=index=>slotOwner.getEnemySlotForMonster(snapshot,index);
        const allTargets=getSkillTargets(bossIndex,'all').slice().sort((a,b)=>a-b);
        const singleBoss=getSkillTargets(bossIndex,'tri');
        const singleObject=getSkillTargets(healIndex,'row');
        bossOwner.applyShield(3000);
        const hpBefore=boss.hp;
        boss.hp=hpBefore-5000;
        const settlement=bossOwner.consumeDamageSettlement(bossIndex);
        selectBattleTarget(healIndex);
        showMonsterHit(healIndex,100,'hp');
        showMonsterHit(bossIndex,100,'heal');
        const healCard=document.getElementById('battleMonster'+healIndex);
        const bossCard=document.getElementById('battleMonster'+bossIndex);
        const footprint=document.querySelector('.v-fixed-boss-footprint');
        const rect=node=>{const value=node?.getBoundingClientRect();return value?{left:value.left,top:value.top,right:value.right,bottom:value.bottom,width:value.width,height:value.height,centerX:value.left+value.width/2}:null;};
        const bossHp=bossCard?.querySelector(':scope > .monster-hp');
        const bossSp=bossCard?.querySelector(':scope > .monster-sp');
        const bossName=bossCard?.querySelector(':scope > .battle-monster-name');
        const sideVisual=index=>{const card=document.getElementById('battleMonster'+index),art=card?.querySelector(':scope > .v174-battle-art');return {index,slot:slotOf(index),card:rect(card),art:rect(art)};};
        const healReticle=getComputedStyle(healCard,'::before');
        const director=window.v142SkillAnimationDirector;
        const config=Object.assign({},window.v142GetSkillAnimationConfig('stormCircle'),{duration:1100,resolveDuration:1100});
        const gate=director.play(config,{
            side:'player',actorIndex:0,targetSide:'monster',targetId:bossIndex,targetIds:[bossIndex],
            targetContract:{version:'battle-target-contract-v1',targetSide:'monster',targetId:bossIndex,targetIds:[bossIndex]},
            key:'boss-target-entity-live-'+Date.now()
        });
        window.__bossTargetEntityQaGate=gate;
        const stage=document.getElementById('v143-skill-stage');
        const sprite=stage?.querySelector('.v143-vfx-sprite');
        return {
            bossIndex,healIndex,flagIndex,
            targetRules:{singleBoss,singleObject,allTargets},
            slots:{boss:slotOf(bossIndex),reinforcements:reinforcements.map(slotOf),objects:[slotOf(healIndex),slotOf(flagIndex)]},
            units:currentBattleMonsters.map(index=>({index,kind:monsters[index]?.unitKind||null,canAct:monsters[index]?.canAct!==false,noRewards:!!monsters[index]?.noRewards,cardless:document.getElementById('battleMonster'+index)?.classList.contains('v174-cardless-unit')||false})),
            settlement,
            footprint:rect(footprint),bossCard:rect(bossCard),bossArt:rect(bossCard?.querySelector(':scope > .v174-battle-art')),bossCount:document.querySelectorAll('.v-fixed-boss-footprint > .gameplay-boss-card').length,
            bossHud:{hp:rect(bossHp),sp:rect(bossSp),name:rect(bossName),hpPosition:getComputedStyle(bossHp).position,spPosition:getComputedStyle(bossSp).position,hpDisplay:getComputedStyle(bossHp).display,spDisplay:getComputedStyle(bossSp).display},
            sideVisuals:reinforcements.concat([healIndex,flagIndex]).map(sideVisual),
            healFeedback:{className:healCard?.className||'',reticleBorder:healReticle.borderTopWidth,reticleAnimation:healReticle.animationName},
            bossFeedback:{className:bossCard?.className||''},
            vfx:{targetIndexes:String(sprite?.dataset.targetIndexes||'').split(',').filter(Boolean),geometrySlots:String(sprite?.dataset.geometrySlots||'').split(',').filter(Boolean),placement:sprite?.dataset.placement||null,emitted:sprite?.dataset.emittedVisual||null},
            livingCount:currentBattleMonsters.filter(index=>monsters[index]?.alive).length
        };
    })()`);
    evidence.checks.bossMode=bossMode;
    assert.equal(bossMode.bossCount,1,"The central six-Slot footprint must contain one Boss DOM target");
    assert.deepEqual(bossMode.targetRules.singleBoss,[bossMode.bossIndex],"Boss-mode tri must settle only the selected Boss");
    assert.deepEqual(bossMode.targetRules.singleObject,[bossMode.healIndex],"Boss-mode row must settle only the selected object");
    assert.equal(bossMode.targetRules.allTargets.length,bossMode.livingCount,"Boss-mode all must settle every living enemy entity once");
    assert.deepEqual(bossMode.slots.reinforcements,["ENEMY_B1","ENEMY_B5"],"Boss reinforcements must use B1/B5");
    assert.deepEqual(bossMode.slots.objects,["ENEMY_F1","ENEMY_F5"],"Boss objects must use F1/F5");
    assert.ok(bossMode.units.filter(unit=>unit.kind==='boss-object').every(unit=>unit.canAct===false&&unit.noRewards&&unit.cardless),"Boss objects must be non-acting, rewardless and immediately cardless");
    assert.ok(bossMode.units.every(unit=>unit.cardless),"Every dynamic Boss-side entity must be cardless immediately");
    assert.deepEqual(bossMode.settlement,{requested:5000,reduced:0,shieldAbsorbed:3000,hpDamage:2000},"Boss Shield must absorb before HP and preserve overflow");
    assert.equal(/(?:^|\\s)(?:red-hit|hit)(?:\\s|$)/.test(bossMode.healFeedback.className),false,"Damage must not add a root red-hit card state");
    assert.equal(/(?:^|\\s)(?:red-hit|hit)(?:\\s|$)/.test(bossMode.bossFeedback.className),false,"Heal must not add a red damage state");
    assert.equal(bossMode.healFeedback.reticleBorder,"3px","Destructible Boss objects must expose the formal target reticle");
    assert.match(bossMode.healFeedback.reticleAnimation,/v174TargetReticlePulse/);
    assert.ok(Math.abs(bossMode.footprint.left-bossMode.bossCard.left)<=1&&Math.abs(bossMode.footprint.right-bossMode.bossCard.right)<=1&&Math.abs(bossMode.footprint.top-bossMode.bossCard.top)<=1&&Math.abs(bossMode.footprint.bottom-bossMode.bossCard.bottom)<=1,"One Boss hit area must fill the central six-Slot visual footprint");
    assert.equal(bossMode.bossHud.hpPosition,"absolute","Boss HP must remain on its absolute HUD anchor");
    assert.equal(bossMode.bossHud.spPosition,"absolute","Boss SP must remain on its absolute HUD anchor");
    assert.equal(bossMode.bossHud.hpDisplay,"block");assert.equal(bossMode.bossHud.spDisplay,"block");
    assert.equal(Math.round(bossMode.bossHud.hp.height),11);assert.equal(Math.round(bossMode.bossHud.sp.height),11);
    assert.ok(bossMode.bossHud.hp.bottom<=bossMode.bossHud.sp.top+1,"Boss HP must sit above SP");
    assert.ok(bossMode.bossHud.sp.bottom<=bossMode.bossHud.name.top+1,"Boss SP must sit above the name");
    bossMode.sideVisuals.forEach(side=>{assert.ok(side.art.right<=bossMode.bossArt.left+1||side.art.left>=bossMode.bossArt.right-1,"Boss-side artwork must not overlap Boss artwork");if(/[15]$/.test(side.slot)){const left=/1$/.test(side.slot);assert.ok(left?side.art.centerX<=side.card.centerX-6:side.art.centerX>=side.card.centerX+6,"Boss-side artwork must visibly shift outward");}});
    assert.equal(bossMode.vfx.targetIndexes.length,1,"Boss tri VFX damage identity must remain one selected entity");
    assert.equal(bossMode.vfx.geometrySlots.length,3,"Boss tri VFX must retain its authored three-Slot visual width");
    assert.equal(bossMode.vfx.placement,"group");
    assert.equal(bossMode.vfx.emitted,"true");
    await sleep(1350);
    const bossGate=await client.eval(`(()=>{const gate=window.__bossTargetEntityQaGate;return {done:!!gate?.done,completionCount:gate?.completionCount||0,stageExists:!!document.getElementById('v143-skill-stage')};})()`);
    evidence.checks.bossModeVfxCompletion=bossGate;
    assert.equal(bossGate.done,true,"Boss-mode VFX gate must complete");
    assert.equal(bossGate.completionCount,1,"Boss-mode VFX gate must complete exactly once");
    assert.equal(bossGate.stageExists,false,"Boss-mode VFX stage must clean up");

    const bossScreenshot=await client.send("Page.captureScreenshot",{format:"png",fromSurface:true});
    if(bossScreenshot.data){ fs.writeFileSync(path.join(artifactDir,"boss-target-entity-live-412x915.png"),Buffer.from(bossScreenshot.data,"base64")); }

    evidence.status="PASS";
    evidence.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(artifactDir,"battle-layer-audio-live-qa.json"),JSON.stringify(evidence,null,2)+"\n");
    console.log("Battle layer/audio live mobile QA: PASS");
} catch(error){
    evidence.status="FAIL";
    evidence.error=error?.stack||String(error);
    evidence.chromeStderr=chromeStderr.slice(-5000);
    evidence.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(artifactDir,"battle-layer-audio-live-qa.json"),JSON.stringify(evidence,null,2)+"\n");
    console.error("Battle layer/audio live mobile QA: FAIL");
    console.error(error);
    process.exitCode=1;
} finally{
    client?.close();
    child.kill("SIGTERM");
}
