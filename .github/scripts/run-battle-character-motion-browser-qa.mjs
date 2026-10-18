import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {startServer,findChrome,waitJson,Cdp} from './runtime-browser-qa-support.mjs';

// Full production index, feature loader and owners. Only the existing
// disposable, read-only account transport and explicitly labelled QA roster
// fixtures differ from player state. No cloud writes or production bypass.
async function scene(plan){
    const check=(value,label)=>{if(!value)throw Error(label);};
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const wait=async(fn,label,ms=30000)=>{const end=performance.now()+ms;while(!fn()&&performance.now()<end)await sleep(30);check(fn(),label);};
    await wait(()=>window.FourSymbolsStartupPolicy?.getState?.()==='READY','startup READY');
    await FourSymbolsFeatures.ensure('gameplay-core','character-motion-qa');
    await FourSymbolsFeatures.ensure('feature-boss-relic','character-motion-qa');
    await v154RequestMonsterPortraitRegistry();
    closeHomeFeature();
    autoBattle=false;autoPatrolEnabled=false;
    // Formal Auto is gated by Element Box time. Use the same isolated-account
    // grant fixture as existing production Boss/Auto QA, never bypass the gate.
    if(plan.auto)v131GrantElementBoxHours(8,32);
    for(const cfg of [autoConfig,autoConfig2,autoConfig3]){cfg.enabled=!!plan.auto;cfg.hp=0;cfg.sp=0;cfg.skill='normal';}
    player2=plan.allies>1?buildAdditionalCharacter('Motion B','water','male'):null;
    player3=plan.allies>1?buildAdditionalCharacter('Motion C','earth','male'):null;
    if(player2)registerAdditionalCharacter(2,player2);
    if(player3)registerAdditionalCharacter(3,player3);
    for(const p of getCharacters()){p.level=50;p.bonusHP=100000;p.hp=100000;p.sp=10000;p.activeBuffs=[];p.statusEffects=[];}
    const system=FourSymbolsHeroSystem,formation=FourSymbolsTeamFormation;
    const ids=FourSymbolsHeroCore.listHeroDefinitions().map(d=>d.heroId),third='qa-motion-third';
    window.__heroQaOwned=ids;await FourSymbolsHeroAcquisition.sync();
    const domain=system.getDomain();
    // Same six-slot capacity fixture as the existing Hero runtime gate.
    if(plan.allies===6)window.FourSymbolsHeroSystem={getDomain:()=>({...domain,
        getHeroDefinition:id=>id===third?{heroId:third,name:'Motion Third',element:'earth'}:domain.getHeroDefinition(id),
        isHeroUnlocked:id=>id===third||domain.isHeroUnlocked(id),
        getHeroLevel:id=>domain.getHeroLevel(id===third?ids[0]:id),
        getHeroBaseStats:id=>domain.getHeroBaseStats(id===third?ids[0]:id),
        getHeroAllocatedStats:id=>domain.getHeroAllocatedStats(id===third?ids[0]:id),
        getHeroSkillProjection:id=>domain.getHeroSkillProjection(id===third?ids[0]:id)})};
    window.FourSymbolsTeamFormation={getConfirmed:()=>({version:2,
        characterIndexToSlot:plan.allies===1?{0:'ALLY_F1'}:{0:'ALLY_F1',1:'ALLY_F2',2:'ALLY_F3'},
        heroIdToSlot:plan.allies===6?Object.fromEntries([...ids,third].map((id,i)=>[id,'ALLY_B'+(i+1)])):{}})};
    const random=Math.random;
    let releasePause,releaseFinish;
    const evidence={plan,fixture:'controlled roster; formal presentation, hit, resource, queue and geometry owners',actions:[]};
    const P=()=>FourSymbolsBattlePresentation;
    const card=(side,index)=>document.getElementById((side==='monster'?'battleMonster':'battlePlayerCard')+index);
    const rect=node=>{const r=node.getBoundingClientRect();return [r.x,r.y,r.width,r.height];};
    const protectedBoxes=()=>getExistingPartyIndexes().map(i=>card('player',i)).concat(currentBattleMonsters.map(i=>card('monster',i))).filter(Boolean).map(c=>{
        const art=c.querySelector('.v174-battle-art'),hud=P().getUnitHud(c),isEnemy=c.id.startsWith('battleMonster');
        return {id:c.id,unit:rect(c),frame:rect(art),hud:rect(hud),hp:rect(hud.querySelector('.monster-hp,.hp-bar')),
            target:FourSymbolsBattlefieldRenderGeometry.getUnitGeometry(isEnemy?'monster':'player',Number(c.id.replace(/\D/g,''))).unitRect,
            shadow:[getComputedStyle(art,'::after').transform,getComputedStyle(art,'::after').width,getComputedStyle(art,'::after').height]};
    });
    const stable=(before,after)=>{
        check(before.length===after.length,'stable roster');
        before.forEach((b,i)=>{
            const a=after[i];check(b.id===a.id,'stable identity');
            for(const key of ['unit','frame','hud','hp'])b[key].forEach((v,n)=>check(Math.abs(v-a[key][n])<.3,b.id+' '+key+' stable'));
            for(const key of ['left','top','width','height'])check(Math.abs(b.target[key]-a.target[key])<.3,b.id+' target geometry');
            check(JSON.stringify(b.shadow)===JSON.stringify(a.shadow),b.id+' grounded shadow');
        });
    };
    const sample=async(ms)=>{
        const result=[],end=performance.now()+ms;
        while(performance.now()<end){
            const a=card('player',0).querySelector('.v174-battle-art'),t=card('monster',0).querySelector('.v174-battle-art');
            result.push({at:performance.now(),actor:a.dataset.motion,target:t.dataset.motion,
                attack:getComputedStyle(a.querySelector('.v174-action-motion')).transform,
                recoil:getComputedStyle(t.querySelector('.v174-action-motion')).translate,
                depth:getComputedStyle(t).scale,cast:!!a.v174Cast,recoilActive:!!t.v143ImpactRecoil});
            await sleep(16);
        }
        return result;
    };
    try{
        currentZone='forest';mapCooldown=false;Math.random=()=>.5;
        if(plan.boss){
            await FourSymbolsFeatures.ensure('boss-tower','character-motion-boss-qa');
            vGameplayOpenBoss();vGameplayOpenBossDetail('personal','personal-20');
            const button=document.querySelector('#bossTabContent .boss-detail .gameplay-primary-action');
            check(button&&!button.disabled,'formal Boss entry');button.click();
            await wait(()=>battleActive&&FourSymbolsBossBattle.isActive(),'Boss battle');
            evidence.bossFootprint=FourSymbolsBossBattle.getBossFootprintSlots();
            check(evidence.bossFootprint.length===6&&document.querySelectorAll('.v-fixed-boss-footprint').length===1,'one Boss six-slot footprint');
        }else{
            monsters=Array.from({length:plan.enemies},(_,i)=>Object.assign(MonsterBalance.build({monsterKey:'qa.motion.'+i,name:'Motion Enemy '+i,level:50,element:'water',archetype:'balanced',rank:'regular',mode:'wild',context:'qa/motion'}),{portraitKey:'wild.zone-01.water-01',hp:1000000,maxHP:1000000,skillIds:[],skillChance:0,v141SupportSkillIds:[],v132FixedSkillLoadout:true}));
            startBattle(0);
        }
        clearInterval(timerId);
        releasePause=FourSymbolsBattleFlow.acquirePauseLock('motion-fixture');
        // Exercise all requested capacities through the one formal Slot owner.
        if(!plan.boss){currentBattleMonsters=monsters.map((_,i)=>i);FourSymbolsBattlefieldSlots.clearActiveEnemySnapshot();}
        renderBattle();updateUI();
        await wait(()=>!document.getElementById('battlePage').matches('.v141-preparing-entry,.v141-entry-moving'),'entry complete');
        await sleep(600);P().sync();
        if(plan.allies===6){
            // Product currently has two Hero portraits. The test-only third
            // capacity identity reuses a real Hero image to exercise six
            // painted units; this is not a new production Hero/asset mapping.
            const sixth=card('player',5),reference=card('player',3).querySelector('.v174-battle-art');
            sixth.dataset.v174BattleArtwork=reference.style.backgroundImage;
            P().applyUnit(sixth,'player');
            evidence.sixthPortraitFixture='existing Hero artwork on test-only third capacity identity';
        }
        check(getExistingPartyIndexes().length===plan.allies,'formal ally roster '+getExistingPartyIndexes().length);
        check(document.querySelectorAll('#battlePage .battle-monster').length===plan.enemies,'formal enemy roster');
        if(!plan.boss)check(card('monster',0).querySelector('.v174-battle-art').classList.contains('v174-normalized-portrait'),'real registered monster paint');
        const allyArts=getExistingPartyIndexes().map(i=>card('player',i).querySelector('.v174-battle-art'));
        for(const art of allyArts){
            const match=art.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
            check(match,'all requested allies have actual image paint');
            const image=new Image();image.src=match[1];await image.decode();check(image.naturalWidth>0,'ally artwork decode');
        }
        const phases=allyArts.map(a=>getComputedStyle(a).getPropertyValue('--battle-idle-phase'));
        check(new Set(phases).size===phases.length,'deterministic phase separation');
        const paint=allyArts[0].querySelector('.v174-portrait-paint');
        evidence.phases=phases;evidence.idle=getComputedStyle(paint).animationName;
        check(evidence.idle===(plan.reduced?'none':'v174BattleIdle'),'idle/reduced motion');
        const before=protectedBoxes(),idleStart=getComputedStyle(paint).transform;
        await sleep(370);stable(before,protectedBoxes());
        evidence.idleChanged=getComputedStyle(paint).transform!==idleStart;
        check(plan.reduced||evidence.idleChanged,'idle visibly changes inner paint');
        if(plan.auto){
            const rounds=turn,events=[];
            const off=FourSymbolsCombatEvents.subscribe('action_finished',event=>events.push({at:performance.now(),round:turn,type:event.action?.type}));
            try{
                releasePause();releasePause=null;
                check(autoBattle,'formal Auto preference at battle entry');
                try{await wait(()=>turn>=rounds+2,'three automatic rounds',90000);}
                catch(error){throw Error(error.message+' '+JSON.stringify({turn,battleActive,battlePhase,autoBattle,activeBattleCharacterIndex,initiativeIndex,queue:initiativeQueue,queuedPlayerActions,paused:FourSymbolsBattleFlow.isPaused(),events}));}
                releasePause=FourSymbolsBattleFlow.acquirePauseLock('motion-auto-finish');
                await sleep(4500);
                stable(before,protectedBoxes());
                check(events.length>=12,'full automatic action sequence');
                check(!document.querySelector('#battlePage .attacker-lunge-up,#battlePage .attacker-lunge-down,#battlePage .dodge-back'),'auto leaves no action class');
                check([...document.querySelectorAll('#battlePage .v174-battle-art')].every(a=>!a.v174Cast&&!a.v143ImpactRecoil),'auto leaves no transform handle');
                evidence.auto={initialRound:rounds,finalRound:turn,events};
            }finally{off();autoBattle=false;}
        }
        if(plan.actions){
            releaseFinish=FourSymbolsBattleFlow.interceptActionFinish(()=>true);
            battlePhase='resolve';activeBattleCharacterIndex=0;selectedMonster=0;
            const attack=async(label,draw)=>{
                Math.random=()=>draw;const hp=monsters[0].hp,baseline=protectedBoxes();
                normalAttack();const rows=await sample(680);stable(baseline,protectedBoxes());
                const hit=rows.some(r=>r.recoilActive),dodge=rows.some(r=>r.target==='dodging');
                check(label==='miss'?monsters[0].hp===hp&&dodge&&!hit:monsters[0].hp<hp&&hit,label+' feedback');
                check(plan.reduced||rows.some(r=>r.attack!=='none'),label+' action transform');
                check(rows.every(r=>r.depth===getComputedStyle(card('monster',0).querySelector('.v174-battle-art')).scale),'depth preserved through recoil');
                check(card('player',0).querySelector('.v174-battle-art').dataset.motion==='idle','return idle');
                evidence.actions.push({label,hpBefore:hp,hpAfter:monsters[0].hp,hit,dodge,rows});
                await sleep(100);
            };
            if(!plan.reduced){await attack('normal',.5);await attack('critical',0);await attack('miss',.99999);}
            Math.random=()=>0;
            const baseline=protectedBoxes();
            characterSkillLoadouts[getPartyCharacterKey(0)].skillLevels.fireRocket=1;
            castDamageSkill('fireRocket');
            const gate=v142SkillAnimationDirector.getActive(),duration=gate.config.duration;
            const castRows=await sample(400);stable(baseline,protectedBoxes());
            check(duration===900,'authored cast duration unchanged');
            check(plan.reduced?!castRows.some(r=>r.cast):castRows.some(r=>r.cast),'cast/reduced');
            await sleep(650);check(!card('player',0).querySelector('.v174-battle-art').v174Cast,'cast cleaned');
            evidence.cast={duration,rows:castRows};
            // Official feedback path excludes heal/SP/shield/status from recoil.
            for(const kind of ['heal','sp','shield','status']){
                window.v143ResolveBattleFeedbackTiming('monster',0,kind);await sleep(30);
                check(!card('monster',0).querySelector('.v174-battle-art').v143ImpactRecoil,kind+' not recoil');
            }
            const target=card('monster',0),stateBefore=monsters[0].hp;
            monsters[0].hp=0;monsters[0].alive=false;updateUI();await sleep(180);
            const action=target.querySelector('.v174-action-motion');
            check(target.querySelector('.v174-battle-art').dataset.motion==='dying','death state');
            check(getComputedStyle(action).animationName===(plan.reduced?'none':'v174BattleDeath'),'death presentation');
            check(monsters[0].hp===0,'death does not delay gameplay HP');
            monsters[0].hp=stateBefore;monsters[0].alive=true;updateUI();await sleep(50);
            check(target.querySelector('.v174-battle-art').dataset.motion==='idle','revive clears death presentation');
            evidence.death=true;
            v142SkillAnimationDirector.dispose();
            check(allyArts.every(a=>a.dataset.motion==='stopped'),'dispose stops motion');
            P().sync();
        }
        // Real RAF pacing, paired with the same scene with paint animation
        // paused. Record distribution; no portable absolute GPU FPS guarantee.
        const frames=async()=>{const times=[],end=performance.now()+650;await new Promise(resolve=>{function tick(t){times.push(t);if(t>=end)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);});return times.slice(1).map((t,i)=>t-times[i]);};
        evidence.frameTimes=await frames();
        const paints=[...document.querySelectorAll('#battlePage .v174-portrait-paint')];
        paints.forEach(p=>p.style.animationPlayState='paused');evidence.pausedFrameTimes=await frames();paints.forEach(p=>p.style.removeProperty('animation-play-state'));
        evidence.finalBoxes=protectedBoxes();
        window.__motionEvidence=evidence;
        return evidence;
    }finally{
        Math.random=random;releaseFinish?.();releasePause?.();
        if(plan.boss&&battleActive)v132AbortDungeonBattle('motion-qa-stop');
        battleActive=false;autoBattle=false;clearInterval(timerId);clearBattleActionWatchdog();
        clearTransientBattlePresentation();v142SkillAnimationDirector.dispose();
        window.FourSymbolsHeroSystem=system;window.FourSymbolsTeamFormation=formation;
    }
}

const baseUrl=process.env.QA_BASE_URL||'',expected=process.env.EXPECTED_COMMIT_SHA||'local';
if(baseUrl){const m=await(await fetch(baseUrl+'/release-manifest.json',{cache:'no-store'})).json();assert.equal(m.commitSha,expected);}
const server=await startServer({baseUrl});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'character-motion-'));
const port=Number(process.env.MOTION_QA_PORT||9881);
const proc=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
const out=path.resolve('artifacts/character-motion');fs.mkdirSync(out,{recursive:true});
const evidence=[];let client;
try{
    const page=(await waitJson('http://127.0.0.1:'+port+'/json/list')).find(p=>p.type==='page');
    client=new Cdp(page.webSocketDebuggerUrl);await client.send('Page.enable');await client.send('Runtime.enable');
    await client.send('Page.navigate',{url:server.url});
    for(const [width,height] of [[412,915],[390,844],[1280,720]]){
        await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
        const extended=process.env.MOTION_QA_EXTENDED;
        const plans=extended?[{allies:3,enemies:1,boss:true},{allies:3,enemies:3,auto:true}].filter(p=>extended==='1'||(extended==='auto'?p.auto:p.boss)):[{allies:1,enemies:1},{allies:3,enemies:3},{allies:6,enemies:6,actions:true},{allies:6,enemies:10}];
        for(const plan of plans.filter(p=>!process.env.MOTION_QA_CAPACITY_ONLY||p.allies===6)){
            const data=await client.eval('('+scene.toString()+')('+JSON.stringify(plan)+')');
            evidence.push({width,height,...data});
            const png=await client.send('Page.captureScreenshot',{format:'png'});
            fs.writeFileSync(path.join(out,`${width}-${plan.allies}v${plan.enemies}.png`),Buffer.from(png.data,'base64'));
            console.log('Character motion scene PASS',width,height,plan.allies,plan.enemies);
        }
    }
    if(!process.env.MOTION_QA_EXTENDED){
        await client.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
        evidence.push(await client.eval('('+scene.toString()+')('+JSON.stringify({allies:6,enemies:6,actions:true,reduced:true})+')'));
    }
    const errors=client.events.filter(e=>e.method==='Runtime.exceptionThrown');
    assert.equal(errors.length,0,JSON.stringify(errors));
    fs.writeFileSync(path.join(out,process.env.MOTION_QA_EXTENDED?'extended-'+process.env.MOTION_QA_EXTENDED+'.json':'evidence.json'),JSON.stringify({passed:true,expected,baseUrl,evidence},null,2));
    console.log('Character Motion controlled production runtime matrix PASS');
}catch(error){fs.writeFileSync(path.join(out,process.env.MOTION_QA_EXTENDED?'extended-'+process.env.MOTION_QA_EXTENDED+'.json':'evidence.json'),JSON.stringify({passed:false,expected,baseUrl,evidence,error:String(error.stack||error),events:client?.events.slice(-12)},null,2));throw error;}
finally{
    client?.close();proc.kill();
    await new Promise(resolve=>{if(proc.exitCode!==null)resolve();else{proc.once('exit',resolve);setTimeout(resolve,5000);}});
    await new Promise(resolve=>server.server.close(resolve));
    try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
    catch(error){console.error('Temporary Chrome profile cleanup pending:',profile,error.code);}
}
