import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawn,spawnSync} from "node:child_process";
import {battleSkillTouchFloodQa} from './battle-skill-touch-flood-qa.mjs';
import os from 'node:os';
import {startServer,waitJson,Cdp,findChrome} from './runtime-browser-qa-support.mjs';

async function runBossBalanceProductionQa(){
    const baseUrl=process.env.BOSS_BALANCE_BASE_URL;
    if(baseUrl){const manifest=await fetch(new URL('release-manifest.json',baseUrl+'/')).then(r=>r.json());assert.equal(manifest.commitSha,process.env.EXPECTED_COMMIT_SHA);}
    const reference=fs.readFileSync('tests/fixtures/wild-balance-reference-party.js','utf8');
    const expression=`(async()=>{
      const check=(v,m)=>{if(!v)throw Error(m);};
      const wait=async(fn,ms=30000)=>{const end=performance.now()+ms;while(!fn()&&performance.now()<end)await new Promise(r=>setTimeout(r,40));check(fn(),'Boss wait '+fn);};
      await wait(()=>window.FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden===true&&!document.getElementById('firebaseAuthOverlay')?.classList.contains('show'));
      await FourSymbolsFeatures.ensure('boss-relic','boss-balance-qa');
      await wait(()=>window.GameplaySystem&&window.FourSymbolsBossBattle);closeHomeFeature();
      const evidence=window.bossBalanceQaEvidence={scenes:[],controls:[],skills:[]};
      const stats=m=>[m.maxHP,m.maxSP,m.attack,m.magicAttack,m.defense,m.agility];
      const verify=m=>{const p=MonsterBalance.debug(m);check(m.balanceOwner==='MonsterBalance'&&['personalBoss','worldBoss'].includes(m.mode),'owner');check(JSON.stringify(stats(m))===JSON.stringify(Object.values(p.final)),'projection');check(!m.v132Dungeon&&!m.v141ExtraHP,'legacy marker');check(p.base.abilityPointBudget===(m.level-1)*5,'budget');check(getEnemyPressureMultiplier(m,player)===p.finalDamagePressure,'pressure');};
      const plans=[{type:'personal',id:'personal-20'},{type:'personal',id:'personal-30'},{type:'personal',id:'personal-70'},...[1,2,3,4].map(stage=>({type:'world',id:'world-40',stage})),{type:'world',id:'world-40',stage:4,repeat:true},{type:'personal',id:'personal-20',repeat:true}];
      const oldRandom=Math.random,badge=showMonsterSkillNameBadge,status=rollStatusEffectHit;
      showMonsterSkillNameBadge=function(name,...args){evidence.skills.push({name,round:turn});return badge(name,...args);};
      rollStatusEffectHit=function(...args){const hit=status(...args);if(args[5]){const chance=calculateStatusEffectChance(...args);check(chance<=60,'hard control cap');evidence.controls.push({chance,hit,rank:args[6]});}return hit;};
      try{
       for(const [caseIndex,plan] of plans.entries()){
        const definition=(plan.type==='world'?GameplaySystem.worldBosses:GameplaySystem.personalBosses).find(d=>d.id===plan.id);
        const ref=prepareWildBalanceReferenceParty(definition.level,definition.level<60?2:3);v131GrantElementBoxHours(8,32);
        let seed=definition.level*100+(plan.stage||1);Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
        autoBattle=false;autoPatrolEnabled=false;for(const cfg of [autoConfig,autoConfig2,autoConfig3]){cfg.enabled=true;cfg.skill=ref.skill;cfg.hp=0;cfg.sp=0;}
        vGameplayOpenBoss();vGameplayOpenBossDetail(plan.type,plan.id);
        const beforeState=GameplaySystem.getSerializableState(),beforeGold=gold;
        const button=document.querySelector('#bossTabContent .boss-detail .gameplay-primary-action');check(button&&!button.disabled,'formal Boss entry');button.click();
        await wait(()=>battleActive&&FourSymbolsBossBattle.isActive());await wait(()=>!document.getElementById('battlePage')?.matches('.v141-preparing-entry,.v141-entry-moving'));
        const boss=monsters[FourSymbolsBossBattle.getBossIndex()],initial=stats(boss),snapshot=FourSymbolsBattlefieldSlots.getActiveEnemySnapshot();verify(boss);
        check(boss.rank==='boss'&&boss.level===definition.level&&boss.element===definition.element,'identity');
        check(FourSymbolsBossBattle.getBossFootprintSlots().length===6&&document.querySelector('.v-fixed-boss-footprint'),'six-grid footprint');
        check(FourSymbolsBossBattle.ownsEnemyFormationSnapshot(snapshot),'snapshot');
        const art=document.querySelector('.gameplay-boss-card .v174-battle-art');check(art&&getComputedStyle(art).backgroundImage!=='none','portrait');
        check(document.querySelector('.gameplay-boss-card .monster-hp-inner')&&document.querySelector('.gameplay-boss-card .monster-sp-inner'),'HP/SP');
        window.bossBalanceQaCapture=plan.type+'-'+plan.id+'-'+caseIndex;
        let rounds=1,shields=0,objects=0,reinforcements=0;const off=FourSymbolsBattleFlow.subscribeBeforeCombatant(()=>{
          rounds=Math.max(rounds,turn);verify(boss);check(FourSymbolsBattlefieldSlots.getActiveEnemySnapshot()===snapshot,'stable snapshot');
          const shield=FourSymbolsBossBattle.getShieldState();if(shield){shields++;check(shield.max===Math.round(boss.maxHP*.24),'shield ratio once');}
          for(const i of currentBattleMonsters){const m=monsters[i];if(m.unitKind==='boss-object'){objects++;check(m.canAct===false&&m.noRewards&&!m.balanceOwner,'object Owner');check(['ENEMY_F1','ENEMY_F5'].includes(m.vGameplayBattlefieldSlot)||!m.alive,'object slots');}if(m.vGameplayBossSupport){reinforcements++;verify(m);check(m.rank==='elite'&&['ENEMY_B1','ENEMY_B5'].includes(m.vGameplayBattlefieldSlot),'elite slots');}}
        });
        try{toggleAutoBattle();check(autoBattle,'formal auto toggle');await wait(()=>!battleActive,480000);}finally{off();}
        autoBattle=false;check(JSON.stringify(stats(boss))===JSON.stringify(initial),'no late base stat mutation');
        const survivors=getExistingPartyIndexes().filter(i=>getPartyCharacterByIndex(i).hp>0).length;check(survivors>0,'natural survivors');
        const after=GameplaySystem.getSerializableState(),progress=after[plan.type][plan.id];
        check(progress.firstClear===true||(plan.type==='world'&&plan.stage<4),'clear progression');
        if(plan.type==='world')check(progress.completedStages===(plan.stage||4),'stage transition');
        const final=plan.type==='personal'||plan.stage===4,expectedGold=final?(plan.repeat?definition.repeatGold:definition.firstGold):0;
        check(gold-beforeGold===expectedGold,'unchanged gold reward');check(!FourSymbolsBossBattle.isActive(),'release Boss context');
        if(document.getElementById('battleStatisticsResultModal')?.hidden===false)FourSymbolsBattleStatistics.hideResultDetails(true);
        evidence.scenes.push({...plan,rounds,survivors,shields,objects,reinforcements,initial,finalHP:getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp),gold:gold-beforeGold,progress});
       }
       return evidence;
      }finally{Math.random=oldRandom;showMonsterSkillNameBadge=badge;rollStatusEffectHit=status;}
    })()`;
    const server=await startServer({baseUrl}),results=[];
    const file=path.resolve('artifacts/browser-qa/boss-balance-production.json');fs.mkdirSync(path.dirname(file),{recursive:true});
    let proc,client,profile;
    const close=()=>{client?.close();proc?.kill('SIGTERM');client=null;proc=null;if(profile)fs.rmSync(profile,{recursive:true,force:true});};
    try{
      for(const [width,height] of [[390,844],[412,915]]){
        profile=fs.mkdtempSync(path.join(os.tmpdir(),'boss-balance-'));const port=23000+process.pid%10000;
        proc=spawn(findChrome(),['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
        const tabs=await waitJson('http://127.0.0.1:'+port+'/json');client=new Cdp(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
        await client.send('Page.enable');await client.send('Runtime.enable');await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await client.send('Page.navigate',{url:server.url});
        const active=client.eval(reference+'\n'+expression);let done=false;active.finally(()=>{done=true;}).catch(()=>{});const captured=new Set();
        while(!done){await new Promise(r=>setTimeout(r,300));const marker=await client.eval('window.bossBalanceQaCapture||null').catch(()=>null);if(marker&&!captured.has(marker)){captured.add(marker);const shot=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(file.replace('.json','-'+width+'x'+height+'-'+marker+'.png'),Buffer.from(shot.data,'base64'));}}
        const result=await active;assert.equal(result.scenes.length,9);assert.ok(result.scenes.some(s=>s.shields));assert.ok(result.scenes.some(s=>s.objects));assert.ok(result.scenes.some(s=>s.reinforcements));results.push({width,height,...result});close();
      }
      fs.writeFileSync(file,JSON.stringify({passed:true,commitSha:process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||'local',results},null,2)+'\n');
    }catch(error){const partial=await client?.eval('({evidence:window.bossBalanceQaEvidence,phase:battlePhase,turn,battleActive})').catch(()=>null);fs.writeFileSync(file,JSON.stringify({passed:false,error:String(error.stack||error),results,partial},null,2)+'\n');throw error;}
    finally{close();await new Promise(r=>server.server.close(r));}
}

// Phase2F extends the existing Boss QA entry; default historical coverage remains intact.
if(process.env.BOSS_MONSTER_BALANCE_QA==='1'){
    await runBossBalanceProductionQa();
    process.exit(0);
}

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
    if(label==="App Shell character/save owners"){
        throw new Error(
            `Timed out waiting for ${label}. Last result: ${String(last)}. `+
            `Recent runtime events: ${JSON.stringify(client.events.slice(-12))}`
        );
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
        // Presentation QA needs a local battle fixture. It cannot create a
        // canonical character against an independently deployed Functions
        // revision, and must never issue a production cloud write here.
        const creationAttempt=await client.eval(`(()=>{
            const input=document.getElementById('creationId');
            const repo=window.FourSymbolsAccountSave;
            const uid=repo?.getActiveUid?.();
            if(!input||!uid||!window.FourSymbolsStartupPolicy?.canCreateCharacter?.()){
                return {created:false,errors:["creation input/account unavailable"]};
            }
            input.value='QA俠客';
            const errors=[];
            try{
                const local=repo.readForUid(uid);
                if(local.status!=="empty"){
                    errors.push("UID already contains a local save");
                    return {created:false,errors};
                }
                if(repo.inspectLegacy().status!=="none"){
                    errors.push("legacy candidate exists");
                    return {created:false,errors};
                }
                player.id=input.value;
                player.element=selectedCreationElement;
                player.attack=10;
                player.attributePoints=0;
                const saved=saveGame({source:"browser-presentation-qa-fixture"});
                if(saved!==true){ errors.push("fixture save failed"); return {created:false,errors}; }
                FourSymbolsStartupPolicy.notifyCharacterCreated();
                document.getElementById('creationPage').style.display='none';
                document.getElementById('gameInterface').style.display='block';
                window.syncCreationTouchMode?.();
                return {created:true,errors,fixture:"local-battle-only"};
            }catch(error){
                errors.push(String(error?.stack||error));
                return {created:false,errors};
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
                "Live anonymous account could not install the local battle QA fixture: "+
                JSON.stringify(diagnostics)+
                " CDP="+JSON.stringify(client.events.slice(-20))
            );
        }
        await waitFor(client,"FourSymbolsStartupPolicy.getState()==='READY'&&getComputedStyle(document.getElementById('gameInterface')).display!=='none'","local battle QA fixture completion",30000);
        state="READY";
    }
    return state;
}


async function cleanupPresentationQaBattle(client){
    await client.eval("(()=>{"+
        "try{window.__relicQaFinishRelease?.();delete window.__relicQaFinishRelease;}catch(_){}"+
        "try{if(window.v174RelicPresentationState&&window.v174RelicPresentationState().active){return false;}}catch(_){}"+
        "try{window.FourSymbolsBattleFloatingFeedback?.clear?.();}catch(_){}"+
        "try{window.FourSymbolsBattlePresentation?.cleanupEscape?.();}catch(_){}"+
        "try{window.v142SkillAnimationDirector?.dispose?.();}catch(_){}"+
        "try{if(window.v132ActiveDungeonRun&&typeof window.v132AbortDungeonBattle==='function'){window.v132AbortDungeonBattle('qa-presentation');}}catch(_){}"+
        "try{if(typeof battleActive!=='undefined'&&battleActive){battleActive=false;autoBattle=false;actionReady=false;pendingAction=null;clearInterval(timerId);timerId=null;if(typeof battleAdvanceTimeoutId!=='undefined'&&battleAdvanceTimeoutId){clearTimeout(battleAdvanceTimeoutId);battleAdvanceTimeoutId=null;}if(typeof battleAdvanceScheduled!=='undefined'){battleAdvanceScheduled=false;}battleToken++;}}catch(_){}"+
        "try{if(window.__battlePresentationQaNormalBackup){monsters=window.__battlePresentationQaNormalBackup.monsters;currentZone=window.__battlePresentationQaNormalBackup.currentZone;mapCooldown=window.__battlePresentationQaNormalBackup.mapCooldown;delete window.__battlePresentationQaNormalBackup;}}catch(_){}"+
        "try{window.FourSymbolsBattleStatistics?.hideResultDetails?.(false);}catch(_){}"+
        "try{document.querySelectorAll('.team-relic-battle-presentation,.battle-floating-feedback').forEach(node=>node.remove());document.body.classList.remove('team-relic-cinematic-active');}catch(_){}"+
        "try{if(typeof showPage==='function'){showPage('home');}}catch(_){}"+
        "return true;})()");
    await sleep(220);
}

async function launchPresentationQaMode(client,mode,relicId){
    await cleanupPresentationQaBattle(client);
    if(relicId){
        assert.equal(await client.eval(`(()=>{const owner=window.v174RelicSystem;const owned=owner?.getOwnedState?.()[${JSON.stringify(relicId)}];if(!owned)return false;owned.unlocked=true;owned.level=10;return window.v174EquipRelic(${JSON.stringify(relicId)})===true;})()`),true,"Local QA relic equip failed: "+relicId);
    }
    await client.eval("(()=>{"+
        "[typeof player!=='undefined'?player:null,typeof player2!=='undefined'?player2:null,typeof player3!=='undefined'?player3:null].forEach(p=>{if(!p)return;p.level=Math.max(100,Number(p.level)||1);p.agility=Math.max(9999,Number(p.agility)||0);p.hp=Math.max(99999,Number(p.hp)||0);p.sp=Math.max(99999,Number(p.sp)||0);});"+
        "window.v133GetHighestCreatedCharacterLevel=()=>100;"+
        "try{if(typeof autoConfig!=='undefined'&&autoConfig){autoConfig.enabled=false;}if(typeof autoBattle!=='undefined'){autoBattle=false;}}catch(_){}"+
        "return true;})()");
    let started=false;
    if(mode==="normal"){
        started=await client.eval("(()=>{if(typeof startBattle!=='function'||typeof MonsterBalance?.build!=='function')return false;window.__battlePresentationQaNormalBackup={monsters:monsters,currentZone:currentZone,mapCooldown:mapCooldown};monsters=['fire','water','wind'].map((element,i)=>configureBuiltMonster(MonsterBalance.build({monsterKey:'qa.'+i,name:'QA巡怪'+i,level:40,element,archetype:'balanced',rank:i===0?'elite':'regular',mode:'wild',context:'wild/qa'})));currentZone='forest';mapCooldown=false;startBattle(0);return !!battleActive;})()");
    }else if(mode==="daily"){
        started=await client.eval("(()=>{if(typeof v132LaunchDungeonBattle!=='function'||typeof v148BuildDailyDungeonWaves!=='function')return false;const built=v148BuildDailyDungeonWaves('exp');const roster=built&&built.waves&&built.waves[0];if(!Array.isArray(roster)||roster.length!==6)return false;const ok=v132LaunchDungeonBattle(roster,()=>{}, {mode:'daily',dailyDungeonType:'exp'})===true;if(ok&&window.v132ActiveDungeonRun){window.v132ActiveDungeonRun.partySize=built.partySize;window.v132ActiveDungeonRun.highestPartyLevel=built.highestPartyLevel;window.v132ActiveDungeonRun.dailyDungeonType='exp';}return ok;})()");
    }else if(mode==="abyss"){
        started=await client.eval("(()=>{if(typeof v174AbyssReset!=='function'||typeof v174AbyssStartEncounter!=='function')return false;v174AbyssReset(40);return v174AbyssStartEncounter()===true;})()");
    }else if(mode==="tower"){
        started=await client.eval("(()=>{if(typeof vGameplayContinueTower!=='function')return false;return vGameplayContinueTower()===true;})()");
    }else if(mode==="personal"){
        started=await client.eval("(()=>{if(typeof vGameplayStartBoss!=='function')return false;return vGameplayStartBoss('personal','personal-70')===true;})()");
    }else if(mode==="world"){
        started=await client.eval("(()=>{if(typeof vGameplayStartBoss!=='function')return false;return vGameplayStartBoss('world','world-40')===true;})()");
    }
    assert.equal(started,true,"Could not start formal battle presentation QA mode: "+mode);
    await client.eval("(()=>{try{autoBattle=false;if(typeof updateAutoButton==='function')updateAutoButton();}catch(_){}return true;})()");
    await waitFor(
        client,
        "(()=>{const p=document.getElementById('battlePage');return typeof battleActive!=='undefined'&&battleActive&&p?.classList.contains('active')&&document.querySelector('#battlePlayerRow .battle-player')&&document.querySelector('#battleMonsterArea .battle-monster');})()",
        mode+" formal battle DOM",
        15000
    );
    await waitFor(
        client,
        "(()=>{const p=document.getElementById('battlePage');return !p?.classList.contains('v141-preparing-entry')&&!p?.classList.contains('v141-entry-moving');})()",
        mode+" battle entrance completion",
        7000
    );
    const context=await client.eval("(()=>{const run=window.v132ActiveDungeonRun;const ids=[...document.querySelectorAll('#battleMonsterArea .battle-monster')].map(node=>Number(String(node.id||'').replace('battleMonster',''))).filter(Number.isInteger);const slotOwner=window.FourSymbolsBattlefieldSlots;const snapshot=slotOwner?.getActiveEnemySnapshot?.();return {mode:run?.mode||'normal',gameplayMode:run?.gameplayMode||null,dailyDungeonType:run?.dailyDungeonType||null,enemyCount:(typeof currentBattleMonsters!=='undefined'?currentBattleMonsters:[]).length,renderedEnemyCount:ids.length,renderedEnemyIds:ids,enemySnapshot:snapshot?{formationType:snapshot.originalFormationType,map:Object.assign({},snapshot.monsterIndexToSlot||{})}:null,formationMeta:(typeof currentBattleMonsters!=='undefined'?currentBattleMonsters:[]).map(index=>({index,row:monsters[index]?.v141FormationRow??null,position:monsters[index]?.v141FormationPosition??null,alive:monsters[index]?.alive!==false,hp:Number(monsters[index]?.hp)||0})),playerCount:document.querySelectorAll('#battlePlayerRow .battle-player').length};})()");
    if(mode==="normal"){ assert.equal(context.mode,"normal"); }
    if(mode==="daily"){ assert.equal(context.mode,"daily");assert.equal(context.dailyDungeonType,"exp");assert.equal(context.enemyCount,6,"formal Daily Dungeon first wave must contain six enemies");assert.equal(context.renderedEnemyCount,6,"formal Daily Dungeon must render all six enemies: "+JSON.stringify(context)); }
    if(mode==="abyss"){ assert.equal(context.mode,"abyss"); }
    if(mode==="tower"){ assert.equal(context.mode,"tower"); }
    if(mode==="personal"){ assert.equal(context.mode,"boss");assert.equal(context.gameplayMode,"personal"); }
    if(mode==="world"){ assert.equal(context.mode,"boss");assert.equal(context.gameplayMode,"world"); }
    assert.ok(context.enemyCount>=1,mode+" must render at least one enemy");
    assert.ok(context.playerCount>=1,mode+" must render at least one player");
    return context;
}

async function captureRelicPresentationQa(client,relicId,targetKind,mode){
    const id=JSON.stringify(relicId);
    // Use production event owners in the disposable local battle fixture.
    // DEV preview is deliberately unavailable on the production host.
    await waitFor(client,`window.v174RelicDebugState?.()?.relicId===${id}`,relicId+" initialized battle owner",7000);
    await client.eval("(()=>{currentBattleMonsters.forEach(index=>{monsters[index].hp=Math.max(100000,monsters[index].hp);monsters[index].maxHP=Math.max(100000,monsters[index].maxHP||0);});return true;})()");
    await client.eval("(()=>{window.__relicQaFinishRelease=FourSymbolsBattleFlow.interceptActionFinish(()=>true);return true;})()");
    const before=await client.eval("window.v174RelicDebugState().totalTriggers");
    if(relicId==="relic_cold_spring_jade"){
        await client.eval("(()=>{const max=getPartyBattleStats(0).maxHP;player.hp=Math.max(1,Math.floor(max*.1));showPlayerHit(Math.ceil(max*.4),'hp',0,false);return true;})()");
    }else if(relicId==="relic_qiankun_flask"){
        await client.eval("(()=>{turn=1;notifyBattleRoundBoundary('round_end',battleToken);return true;})()");
    }else if(relicId==="relic_sun_orb"){
        await client.eval("(()=>{turn=2;notifyBattleRoundBoundary('round_start',battleToken);return true;})()");
    }else if(relicId==="relic_nine_dragon_fire"){
        for(let action=0;action<7;action++){
            await client.eval("(()=>{getExistingPartyIndexes().forEach(i=>{getPartyCharacterByIndex(i).hp=9999999;});const index=currentBattleMonsters.find(i=>monsters[i]?.alive&&monsters[i].hp>0);processSingleMonsterAttack(index,battleToken);clearTimeout(battleAdvanceTimeoutId);battleAdvanceTimeoutId=null;battleAdvanceScheduled=false;return true;})()");
            if(action<6){
                await waitFor(client,"(()=>{clearTimeout(battleAdvanceTimeoutId);battleAdvanceTimeoutId=null;battleAdvanceScheduled=false;return !window.v142GetRemainingAnimationMs?.();})()", "relic counter action animation",10000);
                assert.equal(await client.eval("window.v174RelicDebugState().enemyActionCount"),action+1,"exactly one effective enemy action must be counted");
            }
        }
    }else{ throw new Error("No production relic fixture trigger: "+relicId); }
    const after=await client.eval("window.v174RelicDebugState().totalTriggers");
    assert.equal(after,before+1,"Relic production event must trigger exactly once: "+relicId);
    await waitFor(
        client,
        "(()=>{const n=document.getElementById('teamRelicBattlePresentation');const img=n?.querySelector('.team-relic-battle-cutin-icon img');return n?.classList.contains('identity-visible')&&img?.complete&&img.naturalWidth>0;})()",
        relicId+" identity/icon",
        8000
    );
    const readingOpened=await client.eval("Boolean(window.FourSymbolsBattleStatistics?.openStatistics?.())");
    assert.equal(readingOpened,true,relicId+" reading drawer did not open during cinematic");
    const identity=await client.eval("(()=>{const n=document.getElementById('teamRelicBattlePresentation');const r=n.getBoundingClientRect();const overlay=window.FourSymbolsBattlefieldRenderGeometry?.getBattlefieldOverlayGeometry?.();const img=n.querySelector('.team-relic-battle-cutin-icon img');return {parentIsBody:n.parentElement===document.body,name:n.querySelector('.team-relic-battle-cutin-copy strong')?.textContent||'',icon:img?.getAttribute('src')||'',visibility:getComputedStyle(n).visibility,opacity:getComputedStyle(n).opacity,readingState:document.body.classList.contains('v174-battle-reading-open'),rect:{left:r.left,top:r.top,width:r.width,height:r.height},overlay:overlay&&overlay.rect?{left:overlay.rect.left,top:overlay.rect.top,width:overlay.rect.width,height:overlay.rect.height}:null};})()");
    assert.equal(identity.parentIsBody,true,relicId+" presentation must be document-level");
    assert.ok(identity.name,relicId+" identity name missing");
    assert.ok(identity.icon,relicId+" identity icon missing");
    assert.equal(identity.readingState,true,relicId+" reading state must be active during cinematic");
    assert.equal(identity.visibility,"hidden",relicId+" cinematic paint must be suppressed while reading");
    assert.equal(identity.opacity,"0",relicId+" cinematic opacity must be suppressed while reading");
    assert.ok(identity.overlay,relicId+" canonical overlay geometry missing");
    assert.ok(Math.abs(identity.rect.left-identity.overlay.left)<=1&&Math.abs(identity.rect.top-identity.overlay.top)<=1&&Math.abs(identity.rect.width-identity.overlay.width)<=1&&Math.abs(identity.rect.height-identity.overlay.height)<=1,relicId+" mask host must match canonical battlefield overlay bounds");

    await waitFor(
        client,
        "(()=>{const n=document.getElementById('teamRelicBattlePresentation');return n?.classList.contains('targets-visible')&&n?.classList.contains('vfx-running')&&document.querySelector('#v143-skill-stage .v143-vfx-sprite[data-skill="+id+"]');})()",
        relicId+" target focus and VFX",
        9000
    );
    const focus=await client.eval("(()=>{const n=document.getElementById('teamRelicBattlePresentation');const owner=window.FourSymbolsBattlefieldRenderGeometry;const state=window.v143SkillAnimationState?.current;const side=state?.targetSide||null;const indexes=Array.isArray(state?.targetIndexes)?state.targetIndexes.slice():[];const overlay=owner?.getBattlefieldOverlayGeometry?.()?.rect||null;const clip=rect=>{if(!rect||!overlay){return rect||null;}const left=Math.max(overlay.left,rect.left),top=Math.max(overlay.top,rect.top),right=Math.min(overlay.left+overlay.width,rect.left+rect.width),bottom=Math.min(overlay.top+overlay.height,rect.top+rect.height);return right>left&&bottom>top?{left,top,width:right-left,height:bottom-top}:null;};const rectOf=node=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};};const artProjections=[...n.querySelectorAll('.team-relic-target-projection-art')].map(rectOf);const hpProjections=[...n.querySelectorAll('.team-relic-target-projection-hp')].map(rectOf);const diagnostics=indexes.map(index=>{const card=document.getElementById((side==='monster'?'battleMonster':'battlePlayerCard')+index);const g=owner?.getUnitGeometry?.(side,index);return {index,dom:!!card,slot:g?.slot||card?.dataset?.slot||null,artworkProjection:clip(g?.artworkProjection?.rect),hpProjection:clip(g?.hpProjection?.rect)};});const matches=(expected,actual)=>{const approx=(a,b)=>Math.abs(a-b)<=1.5;const unmatched=actual.slice();return expected.length===actual.length&&expected.every(e=>{const index=unmatched.findIndex(a=>approx(e.left,a.left)&&approx(e.top,a.top)&&approx(e.width,a.width)&&approx(e.height,a.height));if(index<0){return false;}unmatched.splice(index,1);return true;});};const expectedArt=diagnostics.map(item=>item.artworkProjection).filter(Boolean);const expectedHp=diagnostics.map(item=>item.hpProjection).filter(Boolean);const stage=document.getElementById('v143-skill-stage');const sprite=stage?.querySelector('.v143-vfx-sprite[data-skill="+id+"]');return {side,indexes,artProjections,hpProjections,targetDiagnostics:diagnostics,outlineCount:n.querySelectorAll('.team-relic-battle-target-outline').length,artGeometryMatches:matches(expectedArt,artProjections),hpGeometryMatches:matches(expectedHp,hpProjections),stageOwner:stage?.dataset.geometryOwner||null,spriteOwner:sprite?.dataset.geometryOwner||null,spriteTargetSide:sprite?.dataset.targetSide||null,spriteTargetIndexes:sprite?.dataset.targetIndexes||'',presentationLock:window.FourSymbolsBattleFlow?.isPresentationActive?.()||false};})()");
    assert.ok(focus.indexes.length>=1,relicId+" resolved no battle targets");
    if(targetKind==="singleAlly"){ assert.equal(focus.side,"player");assert.equal(focus.indexes.length,1); }
    if(targetKind==="allyAll"){ assert.equal(focus.side,"player"); }
    if(targetKind==="enemyAll"||targetKind==="damageStatus"){ assert.equal(focus.side,"monster"); }
    const expectedArtCount=focus.targetDiagnostics.filter(item=>item.artworkProjection).length;
    const expectedHpCount=focus.targetDiagnostics.filter(item=>item.hpProjection).length;
    assert.equal(focus.artProjections.length,expectedArtCount,relicId+" artwork projections must equal canonical target artwork geometry: "+JSON.stringify({mode,side:focus.side,indexes:focus.indexes,artProjections:focus.artProjections,targetDiagnostics:focus.targetDiagnostics}));
    assert.equal(focus.hpProjections.length,expectedHpCount,relicId+" HP projections must equal canonical target HP geometry");
    assert.equal(focus.outlineCount,0,relicId+" must not restore the retired full-Unit outline owner");
    assert.equal(focus.artGeometryMatches,true,relicId+" foreground artwork projections must match canonical artwork geometry: "+JSON.stringify({artProjections:focus.artProjections,targetDiagnostics:focus.targetDiagnostics}));
    assert.equal(focus.hpGeometryMatches,true,relicId+" foreground HP projections must match canonical HP geometry: "+JSON.stringify({hpProjections:focus.hpProjections,targetDiagnostics:focus.targetDiagnostics}));
    assert.equal(focus.stageOwner,"fixed-slot",relicId+" VFX stage must use Fixed Slot geometry");
    assert.equal(focus.spriteOwner,"fixed-slot",relicId+" VFX sprite must use Fixed Slot geometry");
    assert.equal(focus.spriteTargetSide,focus.side,relicId+" VFX target side drifted from focus side");
    assert.equal(focus.presentationLock,true,relicId+" presentation lock must stay held during VFX");

    await waitFor(
        client,
        "(()=>{const p=window.v174RelicPresentationState?.();return !p?.active&&!document.getElementById('teamRelicBattlePresentation')&&!document.getElementById('v143-skill-stage')&&!document.body.classList.contains('team-relic-cinematic-active')&&!window.FourSymbolsBattleFlow?.isPresentationActive?.()&&!document.querySelector('.battle-floating-feedback');})()",
        relicId+" complete presentation cleanup",
        12000
    );
    const cleanup=await client.eval("(()=>({mask:!!document.getElementById('teamRelicBattlePresentation'),vfx:!!document.getElementById('v143-skill-stage'),focus:document.querySelectorAll('.team-relic-battle-target-outline').length,feedback:document.querySelectorAll('.battle-floating-feedback').length,bodyClass:document.body.classList.contains('team-relic-cinematic-active'),readingState:document.body.classList.contains('v174-battle-reading-open'),lock:window.FourSymbolsBattleFlow?.isPresentationActive?.()||false}))()");
    assert.deepEqual(cleanup,{mask:false,vfx:false,focus:0,feedback:0,bodyClass:false,readingState:true,lock:false},relicId+" presentation must expire normally while the reading drawer stays open");
    const readingClosed=await client.eval("(()=>{window.FourSymbolsBattleStatistics?.closeDrawer?.();return {readingState:document.body.classList.contains('v174-battle-reading-open'),vfx:!!document.getElementById('v143-skill-stage'),mask:!!document.getElementById('teamRelicBattlePresentation')};})()");
    assert.deepEqual(readingClosed,{readingState:false,vfx:false,mask:false},relicId+" closing the drawer must not replay expired relic presentation");
    await client.eval("(()=>{window.__relicQaFinishRelease?.();delete window.__relicQaFinishRelease;return true;})()");
    return {relicId,targetKind,identity,focus,cleanup};
}

async function runBossReadingLayerQa(client,bossIndex){
    const opened=await client.eval(`(()=>{
        const owner=window.FourSymbolsBattleStatistics;
        owner?.setBossMechanisms?.([{id:'reading-qa',name:'閱讀層驗證',effect:'只驗證繪製抑制',status:'生效中'}]);
        if(!owner?.openBossMechanisms?.()){return {opened:false};}
        const add=(className,kind)=>{const node=document.createElement('div');node.className=className;if(kind){node.dataset.feedbackKind=kind;}node.textContent=kind||className;document.body.appendChild(node);return node;};
        add('v-fixed-slot-popup','legacy');
        add('damage-popup v152-top-damage','damage');
        ['damage','heal','sp','miss','resist','status'].forEach(kind=>add('battle-floating-feedback',kind));
        add('skill-name-badge','skill');
        let banner=document.getElementById('teamRelicBattleBanner');
        if(!banner){banner=document.createElement('div');banner.id='teamRelicBattleBanner';banner.className='team-relic-battle-banner';document.getElementById('battlePage')?.appendChild(banner);}
        banner.classList.add('show');
        const selectors=['.v143-skill-stage','.v-fixed-slot-popup','.damage-popup.v152-top-damage','.battle-floating-feedback[data-feedback-kind="damage"]','.battle-floating-feedback[data-feedback-kind="heal"]','.battle-floating-feedback[data-feedback-kind="sp"]','.battle-floating-feedback[data-feedback-kind="miss"]','.battle-floating-feedback[data-feedback-kind="resist"]','.battle-floating-feedback[data-feedback-kind="status"]','.skill-name-badge','#teamRelicBattleBanner'];
        return {opened:true,readingState:document.body.classList.contains('v174-battle-reading-open'),drawerOpen:document.getElementById('battleBossMechanismDrawer')?.classList.contains('open')||false,flowLock:window.FourSymbolsBattleFlow?.isPresentationActive?.()||false,layers:selectors.map(selector=>{const node=document.querySelector(selector);const style=node&&getComputedStyle(node);return {selector,exists:!!node,visibility:style?.visibility||null,opacity:style?.opacity||null};})};
    })()`);
    assert.equal(opened.opened,true,"Boss mechanism reading drawer must open");
    assert.equal(opened.readingState,true,"Boss drawer must activate the sole reading state");
    assert.equal(opened.drawerOpen,true,"Boss mechanism drawer must remain visible");
    opened.layers.forEach(layer=>{assert.equal(layer.exists,true,layer.selector+" missing during reading QA");assert.equal(layer.visibility,"hidden",layer.selector+" must suppress paint");assert.equal(layer.opacity,"0",layer.selector+" must suppress opacity");});
    await waitFor(client,"!document.getElementById('v143-skill-stage')","hidden Boss skill VFX lifecycle completion",6000);
    const completed=await client.eval(`(()=>{
        document.querySelectorAll('body > .v-fixed-slot-popup,body > .damage-popup.v152-top-damage,body > .battle-floating-feedback,body > .skill-name-badge').forEach(node=>node.remove());
        const banner=document.getElementById('teamRelicBattleBanner');if(banner){banner.classList.remove('show');}
        window.FourSymbolsBattleStatistics?.closeDrawer?.();
        return {readingState:document.body.classList.contains('v174-battle-reading-open'),stage:!!document.getElementById('v143-skill-stage'),battleActive:window.FourSymbolsBattleFlow?.isBattleActive?.()||false,bossIndex:${Number(bossIndex)||0}};
    })()`);
    assert.equal(completed.readingState,false,"last reading drawer close must clear state");
    assert.equal(completed.stage,false,"expired skill VFX must not replay after drawer close");
    assert.equal(completed.battleActive,true,"reading state must not stop the battle simulation");
    return {opened,completed};
}

async function runRelicPresentationModeMatrix(client){
    const modes=["normal","daily","abyss","tower","personal","world"];
    const relics=[
        ["relic_cold_spring_jade","singleAlly"],
        ["relic_qiankun_flask","allyAll"],
        ["relic_sun_orb","enemyAll"],
        ["relic_nine_dragon_fire","damageStatus"]
    ];
    const matrix=[];
    const identityBaseline=new Map();
    for(const mode of modes){
        let context;
        const presentations=[];
        for(const [relicId,targetKind] of relics){
            context=await launchPresentationQaMode(client,mode,relicId);
            const snapshot=await captureRelicPresentationQa(client,relicId,targetKind,mode);
            presentations.push(snapshot);
            const baseline=identityBaseline.get(relicId);
            if(!baseline){ identityBaseline.set(relicId,{name:snapshot.identity.name,icon:snapshot.identity.icon}); }
            else{
                assert.equal(snapshot.identity.name,baseline.name,relicId+" name must be identical across battle modes");
                assert.equal(snapshot.identity.icon,baseline.icon,relicId+" icon must be identical across battle modes");
            }
        }
        matrix.push({mode,context,presentations});
        await cleanupPresentationQaBattle(client);
    }
    return {passed:true,modes:matrix.map(entry=>entry.mode),relics:relics.map(entry=>entry[0]),matrix};
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

    try{
        await waitFor(client,"(()=>{const page=document.getElementById('battlePage');const rect=page?.getBoundingClientRect();return page?.classList.contains('active')&&!page.classList.contains('v141-preparing-entry')&&!page.classList.contains('v141-entry-moving')&&rect?.width>0&&rect?.height>0&&document.getElementById('battlePlayerCard0')&&document.querySelector('#battlePlayerCard0 .hp-bar')&&document.querySelector('#battleMonster0 .monster-hp');})()","visible real battle after entry transition",15000);
    }catch(error){
        const diagnostic=await client.eval(`(()=>{const page=document.getElementById('battlePage');const rect=page?.getBoundingClientRect();return {startup:FourSymbolsStartupPolicy.getState(),pageClass:page?.className||null,pageRect:rect&&{width:rect.width,height:rect.height},battleActive:typeof battleActive==='undefined'?null:battleActive,battleToken:typeof battleToken==='undefined'?null:battleToken,playerCard:!!document.getElementById('battlePlayerCard0'),playerBar:!!document.querySelector('#battlePlayerCard0 .hp-bar'),monsterBar:!!document.querySelector('#battleMonster0 .monster-hp'),outcome:window.__battleLayerQaDungeonOutcome,playerHp:player.hp,playerId:player.id,events:performance.getEntriesByType('mark').slice(-12).map(item=>item.name)};})()`);
        error.message+=" Diagnostic="+JSON.stringify(diagnostic)+" CDP="+JSON.stringify(client.events.slice(-10));
        throw error;
    }

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

    evidence.checks.skillTouchFlood=await battleSkillTouchFloodQa(client,artifactDir);

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
    evidence.checks.battleReadingLayer=await runBossReadingLayerQa(client,bossMode.bossIndex);
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
    assert.equal(bossMode.healFeedback.reticleAnimation,"none","Formal shared target reticle stays static");
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

    evidence.checks.bossFloodDirection=await battleSkillTouchFloodQa(client,artifactDir,{animationOnly:true});
    assert.equal(evidence.checks.bossFloodDirection.actorKind,'boss',"Downward Flood Beast acceptance must use the real Boss entity");

    const bossScreenshot=await client.send("Page.captureScreenshot",{format:"png",fromSurface:true});
    if(bossScreenshot.data){ fs.writeFileSync(path.join(artifactDir,"boss-target-entity-live-412x915.png"),Buffer.from(bossScreenshot.data,"base64")); }

    evidence.checks.relicPresentationModeMatrix=await runRelicPresentationModeMatrix(client);

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
