import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT,findChrome,startServer,waitJson,Cdp} from './runtime-browser-qa-support.mjs';
const baseUrl=process.env.QA_BASE_URL||'';
const expected=process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||'local';
if(baseUrl){
    const manifest=await (await fetch(baseUrl+'/release-manifest.json',{cache:'no-store'})).json();
    assert.equal(manifest.commitSha,expected,'live QA must use exact deployed SHA');
}
// Read-only disposable account transport; all production bundles and target,
// attack, follow-up, damage, VFX and finish owners are real and unmodified.
const expression=`(async()=>{
    const wait=async(predicate,label)=>{const end=Date.now()+30000;while(!predicate()&&Date.now()<end)await new Promise(r=>setTimeout(r,30));if(!predicate())throw Error(label);};
    await wait(()=>window.FourSymbolsStartupPolicy?.getState?.()==='READY','startup');
    await FourSymbolsFeatures.ensure('gameplay-core','target-lifecycle-qa');
    await FourSymbolsFeatures.ensure('feature-boss-relic','target-lifecycle-qa');
    closeHomeFeature();
    player2=buildAdditionalCharacter('QA ally B','water','male');registerAdditionalCharacter(2,player2);
    player3=buildAdditionalCharacter('QA ally C','water','male');registerAdditionalCharacter(3,player3);
    for(const i of getExistingPartyIndexes()){
        const p=getPartyCharacterByIndex(i);p.level=50;p.bonusHP=100000;p.activeBuffs=[];p.statusEffects=[];
        characterSkillLoadouts[getPartyCharacterKey(i)].equippedSkills=[];
        characterSkillLoadouts[getPartyCharacterKey(i)].skillLevels={};
    }
    const rows=[];
    for(const mode of ['manual','auto'])for(const rank of ['regular','boss'])for(const scenario of ['living','lethal','revived','dragon-surviving','dragon-lethal','revived-lethal']){
        autoBattle=false;autoConfig.enabled=false;autoConfig2.enabled=false;autoConfig3.enabled=false;
        for(const i of getExistingPartyIndexes())getPartyCharacterByIndex(i).hp=getPartyBattleStats(i).maxHP;
        const enemy=MonsterBalance.build({monsterKey:'qa.target.'+rank,name:'QA fire enemy',level:50,element:'fire',archetype:'balanced',rank,
            mode:rank==='boss'?'personalBoss':'wild',context:'qa/target-lifecycle'});
        Object.assign(enemy,{hp:100000,maxHP:100000,sp:1000,maxSP:1000,skillIds:['fireCritical'],skillChance:1,v141SupportSkillIds:[],v141ForceSkillLevel:1,v132FixedSkillLoadout:true});
        monsters=[enemy];currentZone='forest';mapCooldown=false;
        let releasePause,releaseFinish,finished=0;const badges=[],hits=[];
        const badge=showMonsterSkillNameBadge,hit=showPlayerHit,random=Math.random;
        try{
            startBattle(0);
            await wait(()=>battleActive&&turn>=1,'battle begin');clearInterval(timerId);
            closeHomeFeature();
            releasePause=FourSymbolsBattleFlow.acquirePauseLock('target-lifecycle-qa');
            battlePhase='declare';resolutionPhaseStarted=false;
            if(scenario.startsWith('revived'))player.hp=0;
            if(scenario==='lethal'||scenario.startsWith('dragon'))player.hp=1;
            if(scenario==='dragon-lethal')player3.hp=1;
            if(scenario==='revived-lethal')player2.hp=1;
            if(scenario.startsWith('dragon'))enemy.skillIds=['dragonSlash'];
            queuedPlayerActions={};autoBattle=mode==='auto';
            Math.random=()=>0;
            startResolutionPhase(battleToken);
            const action=initiativeQueue.find(e=>e.type==='monster'&&e.monsterIndex===0);
            if(!action?.targetSnapshot)throw Error('natural queue missing snapshot');
            if(scenario.startsWith('revived'))player.hp=getMainCharacterStats().maxHP;
            const before=getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp);
            const beforeSp=enemy.sp;
            releaseFinish=FourSymbolsBattleFlow.interceptActionFinish(()=>{finished++;return true;});
            showMonsterSkillNameBadge=function(...args){badges.push({name:args[0],primary:args[3],targets:args[4]});return badge.apply(this,args);};
            showPlayerHit=function(...args){hits.push({index:args[2],critical:args[4]});return hit.apply(this,args);};
            processSingleMonsterAttack(0,battleToken,action.targetSnapshot);
            Math.random=()=>.9;
            await wait(()=>finished===1,'follow-up completion: '+JSON.stringify({mode,rank,scenario,badges,hits}));
            await wait(()=>!window.v142SkillAnimationDirector?.getActive?.()||window.v142SkillAnimationDirector.getActive().done,'VFX completion');
            rows.push({mode,rank,scenario,before,beforeSp,after:getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp),badges,hits,
                snapshot:action.targetSnapshot.targets.map(t=>t.index),primary:action.targetSnapshot.primary?.index,sp:enemy.sp,cost:skillDatabase[scenario.startsWith('dragon')?'dragonSlash':'fireCritical'].spCost,finished,
                visible:document.getElementById('battlePage')?.classList.contains('active')===true&&
                    !document.getElementById('homeFeatureModal')?.classList.contains('show')&&
                    !!document.getElementById('battlePlayerCard1')?.getBoundingClientRect().height});
        }finally{
            showMonsterSkillNameBadge=badge;showPlayerHit=hit;Math.random=random;
            battleActive=false;battleToken++;autoBattle=false;clearInterval(timerId);
            releaseFinish?.();releasePause?.();
            window.v142SkillAnimationDirector?.cancelAll?.();
        }
    }
    return rows;
})()`;
const server=await startServer({baseUrl});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'battle-target-qa-'));
const port=9800+Math.floor(Math.random()*100);
const proc=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let client;
const out=path.join(ROOT,'artifacts/browser-qa');fs.mkdirSync(out,{recursive:true});
const evidence=[];
try{
    const page=(await waitJson('http://127.0.0.1:'+port+'/json/list')).find(t=>t.type==='page');
    client=new Cdp(page.webSocketDebuggerUrl);await client.send('Page.enable');await client.send('Runtime.enable');
    await client.send('Page.navigate',{url:server.url});
    for(const [width,height] of [[390,844],[412,915]]){
        await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
        const rows=await client.eval(expression);
        evidence.push({width,height,rows});
        assert.equal(rows.length,24);
        for(const r of rows){
            assert.equal(r.finished,1);assert.equal(r.visible,true);assert.ok(r.hits.some(h=>h.critical===true));
            const target=r.scenario.startsWith('revived')?1:0;
            assert.equal(r.primary,target);assert.ok(r.badges.length>0);
            const primaries=r.badges.map(b=>b.primary);
            const expectedTargets=r.scenario==='lethal'?[0,2]:r.scenario==='dragon-lethal'?[0,2,1]:
                r.scenario==='dragon-surviving'?[0,2,2]:r.scenario==='revived-lethal'?[1,2]:[target,target];
            // .9 selects C from B/C; a surviving new primary remains locked.
            assert.deepEqual(primaries,expectedTargets);
            assert.deepEqual(r.hits.map(h=>h.index),expectedTargets);
            assert.ok(r.badges.every(b=>b.targets.length===1&&b.targets[0]===b.primary));
            const attacked=new Set(expectedTargets);
            r.after.forEach((hp,index)=>{if(!attacked.has(index))assert.equal(hp,r.before[index]);});
            if(r.scenario.startsWith('revived')){assert.deepEqual(r.snapshot,[1,2]);assert.equal(r.after[0],r.before[0]);}
            if(r.scenario==='lethal'||r.scenario.startsWith('dragon'))assert.equal(r.after[0],0);
            if(r.scenario==='revived-lethal')assert.equal(r.after[1],0);
            assert.ok(r.beforeSp>=r.cost,'formal initial SP is sufficient');
            assert.equal(r.sp,r.beforeSp-r.cost,'original cost once; follow-up free');
        }
        const png=await client.send('Page.captureScreenshot',{format:'png'});
        fs.writeFileSync(path.join(out,'battle-target-'+width+'.png'),Buffer.from(png.data,'base64'));
    }
    fs.writeFileSync(path.join(out,'battle-target-lifecycle.json'),JSON.stringify({passed:true,expected,baseUrl,evidence},null,2)+'\n');
    console.log('Battle target lifecycle: 48 full-production mobile browser scenarios PASS');
}catch(error){
    fs.writeFileSync(path.join(out,'battle-target-lifecycle.json'),JSON.stringify({passed:false,expected,baseUrl,evidence,error:String(error.stack||error),events:client?.events.slice(-15)},null,2)+'\n');throw error;
}finally{
    client?.close();proc.kill('SIGTERM');
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});
    await new Promise(resolve=>server.server.close(resolve));
}
