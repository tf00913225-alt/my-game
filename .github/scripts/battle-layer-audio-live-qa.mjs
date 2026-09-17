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
    constructor(url){ this.url=url; this.nextId=1; this.pending=new Map(); this.socket=null; }
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
            if(!message.id){ return; }
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
        const created=await client.eval(`(()=>{
            const input=document.getElementById('creationId');
            if(!input||typeof createCharacter!=='function'){return false;}
            input.value='QA俠客';
            return createCharacter()===true;
        })()`);
        if(!created){ throw new Error("Live anonymous account could not complete the formal character-creation flow"); }
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
    const accountState=await prepareAccountFirstRuntime(client,["abyss"]);
    evidence.checks.accountState=accountState;
    await waitFor(client,"window.__v174TwoTierAbyssInstalled===true&&typeof window.v174AbyssBuildRoster==='function'","two-tier Abyss runtime");
    await waitFor(client,"typeof window.v132LaunchDungeonBattle==='function'&&window.v141Audio&&typeof window.v141Audio.playSkill==='function'","battle/audio runtime");

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
        const enemy=rectFor(document.querySelector('.battle-enemy-region'));
        const center=rectFor(document.querySelector('.battle-center-region'));
        const ally=rectFor(document.querySelector('.battle-ally-region'));
        const infoRegion=rectFor(document.querySelector('.battle-info-region'));
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
            regions:{enemy,center,ally,infoRegion,action,info,elementBox,elementBoxLogical,enemyArea,allyArea},
            separation:{
                enemyBeforeCenter:enemy.bottom<=center.top+1,
                centerBeforeAlly:center.bottom<=ally.top+1,
                allyBeforeInfo:ally.bottom<=infoRegion.top+1,
                actionInsideCenter:inside(action,center),
                infoInsideBottom:inside(info,infoRegion),
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

    const resourceLayers=await client.eval(`(()=>{
        const playerCard=document.getElementById('battlePlayerCard0');
        const monsterCard=document.getElementById('battleMonster0');
        const playerHp=playerCard?.querySelector('.hp-bar');
        const playerSp=playerCard?.querySelector('.sp-bar');
        const monsterHp=monsterCard?.querySelector('.monster-hp');
        const monsterSp=monsterCard?.querySelector('.monster-sp');
        const playerStatus=document.createElement('div');
        playerStatus.className='v153-status-vfx v153-status-vfx-rage';
        const monsterStatus=document.createElement('div');
        monsterStatus.className='v153-status-vfx v153-status-vfx-rage';
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
            monsterHpVisible:getComputedStyle(monsterHp).visibility
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
    assert.equal(iceArrowRain?.frameFit,"stretch","All-target VFX must fill its semantic Fixed Slot region");
    assert.equal(iceArrowRain?.areaId,"fixed-enemy-zone","Ice Arrow Rain must bind to the complete enemy fixed zone");
    assert.equal(iceArrowRain?.geometrySlots.length,10,"Full-range VFX geometry must retain all ten slots regardless of occupancy");
    assert.equal(iceArrowRain?.targetIndexes.length,8,"The real eight-enemy battle must expose all living targets to Ice Arrow Rain");
    assert.ok(Math.abs(iceArrowRain.spriteBox.width-Math.round(iceArrowRain.bounds.width))<=1,"Ice Arrow Rain width must equal the complete enemy region");
    assert.ok(Math.abs(iceArrowRain.spriteBox.height-Math.round(iceArrowRain.bounds.height))<=1,"Ice Arrow Rain height must equal the complete enemy region");
    assert.ok(Math.abs(iceArrowRain.spriteBox.left-iceArrowRain.bounds.centerX)<=1,"Ice Arrow Rain must stay centered on the complete enemy region");
    assert.ok(Math.abs(iceArrowRain.spriteBox.top-iceArrowRain.bounds.centerY)<=1,"Ice Arrow Rain must stay centered on the complete enemy region");
    assert.equal(iceArrowRain.stageOverflow,"visible","The VFX owner must not clip full-range animation paint");
    assert.equal(iceArrowRain.emitted,"true","Ice Arrow Rain must emit a visible production sprite");

    await sleep(1350);
    const iceGate=await client.eval(`(()=>{
        const gate=window.__battleLayoutIceGate;
        return {done:!!gate?.done,reason:gate?.reason||null,completionCount:gate?.completionCount||0,stageExists:!!document.getElementById('v143-skill-stage')};
    })()`);
    evidence.checks.iceArrowRainCompletion=iceGate;
    assert.equal(iceGate.done,true,"Ice Arrow Rain must release its animation gate");
    assert.equal(iceGate.completionCount,1,"Ice Arrow Rain gate must complete exactly once");
    assert.ok(["v143-raster-complete","v142-render-safety-deadline"].includes(iceGate.reason),"Ice Arrow Rain must finish through a bounded production deadline");
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
    assert.equal(windFlame?.frameFit,"stretch","Three-target VFX must fill its semantic three-slot region");
    assert.equal(windFlame?.targetIndexes.length,1,"This live check deliberately supplies only one surviving target");
    assert.equal(windFlame?.geometrySlots.length,3,"Wind Flame must retain a three-slot footprint for a single surviving target");
    assert.ok(Math.abs(windFlame.spriteBox.width-Math.round(windFlame.bounds.width))<=1,"Wind Flame width must equal the fixed three-slot geometry");
    assert.ok(Math.abs(windFlame.spriteBox.height-Math.round(windFlame.bounds.height))<=1,"Wind Flame height must equal the fixed three-slot geometry");
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
    assert.ok(["v143-raster-complete","v142-render-safety-deadline"].includes(windGate.reason),"Wind Flame must finish through a bounded production deadline");
    assert.equal(windGate.stageExists,false,"Completed Wind Flame VFX must remove its stage");

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
        startResolutionPhase(battleToken);
        if(Array.isArray(initiativeQueue)){
            initiativeQueue.sort((left,right)=>left?.type==='player'?-1:right?.type==='player'?1:0);
        }
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
    await waitFor(client,"window.__battleLayerQaDungeonOutcome?.result==='win'&&document.getElementById('dungeonPage')?.classList.contains('active')","battle-end dungeon transition",6000);
    const endTransition=await client.eval(`({
        ended:${JSON.stringify(true)},battleActive:!!battleActive,
        tokenAdvanced:(Number(battleToken)||0)>${endTransitionStart.initialToken},
        outcome:window.__battleLayerQaDungeonOutcome?.result||null,
        dungeonActive:document.getElementById('dungeonPage')?.classList.contains('active')||false,
        stageCount:document.querySelectorAll('#v143-skill-stage').length
    })`);
    endTransition.ended=endTransitionStart.ended;
    evidence.checks.battleEndTransition=endTransition;
    assert.equal(endTransition.ended,true,"Defeating the final targets must enter the formal battle-end path");
    assert.equal(endTransition.battleActive,false,"Battle-end path must clear battleActive");
    assert.equal(endTransition.tokenAdvanced,true,"Battle-end path must invalidate the completed battle token");
    assert.equal(endTransition.outcome,"win","Dungeon battle-end path must deliver its win callback");
    assert.equal(endTransition.dungeonActive,true,"Dungeon battle-end path must return to the dungeon page");
    assert.equal(endTransition.stageCount,0,"Battle-end path must leave no V143 stage behind");

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
