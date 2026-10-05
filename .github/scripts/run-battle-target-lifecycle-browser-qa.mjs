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
    player2=buildAdditionalCharacter('QA ally B','water','male');registerAdditionalCharacter(2,player2);
    player3=buildAdditionalCharacter('QA ally C','water','male');registerAdditionalCharacter(3,player3);
    for(const i of getExistingPartyIndexes()){
        const p=getPartyCharacterByIndex(i);p.level=50;p.bonusHP=100000;p.activeBuffs=[];p.statusEffects=[];
        characterSkillLoadouts[getPartyCharacterKey(i)].equippedSkills=[];
        characterSkillLoadouts[getPartyCharacterKey(i)].skillLevels={};
    }
    const rows=[];
    for(const mode of ['manual','auto'])for(const rank of ['regular','boss'])for(const scenario of ['living','lethal','revived']){
        autoBattle=false;autoConfig.enabled=false;autoConfig2.enabled=false;autoConfig3.enabled=false;
        for(const i of getExistingPartyIndexes())getPartyCharacterByIndex(i).hp=getPartyBattleStats(i).maxHP;
        const enemy=MonsterBalance.build({monsterKey:'qa.target.'+rank,name:'QA fire enemy',level:50,element:'fire',archetype:'balanced',rank,
            mode:rank==='boss'?'personalBoss':'wild',context:'qa/target-lifecycle'});
        Object.assign(enemy,{hp:100000,maxHP:100000,sp:1000,maxSP:1000,skillIds:['fireCritical'],skillChance:1,v141SupportSkillIds:[],v141ForceSkillLevel:1,v132FixedSkillLoadout:true});
        monsters=[enemy];currentZone='forest';mapCooldown=false;
        const releasePause=FourSymbolsBattleFlow.acquirePauseLock('target-lifecycle-qa');
        let releaseFinish,finished=0;const badges=[],hits=[];
        const badge=showMonsterSkillNameBadge,hit=showPlayerHit,random=Math.random;
        try{
            startBattle(0);
            await wait(()=>battleActive&&turn>=1,'battle begin');clearInterval(timerId);
            battlePhase='declare';resolutionPhaseStarted=false;
            if(scenario==='revived')player.hp=0;
            if(scenario==='lethal')player.hp=1;
            queuedPlayerActions={};autoBattle=mode==='auto';
            Math.random=()=>0;
            startResolutionPhase(battleToken);
            const action=initiativeQueue.find(e=>e.type==='monster'&&e.monsterIndex===0);
            if(!action?.targetSnapshot)throw Error('natural queue missing snapshot');
            if(scenario==='revived')player.hp=getMainCharacterStats().maxHP;
            const before=getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp);
            releaseFinish=FourSymbolsBattleFlow.interceptActionFinish(()=>{finished++;return true;});
            showMonsterSkillNameBadge=function(...args){badges.push({name:args[0],primary:args[3],targets:args[4]});return badge.apply(this,args);};
            showPlayerHit=function(...args){hits.push({index:args[2],critical:args[4]});return hit.apply(this,args);};
            processSingleMonsterAttack(0,battleToken,action.targetSnapshot);
            Math.random=()=>.9;
            await wait(()=>finished===1,'follow-up completion: '+JSON.stringify({mode,rank,scenario,badges,hits}));
            await wait(()=>!window.v142SkillAnimationDirector?.getActive?.()||window.v142SkillAnimationDirector.getActive().done,'VFX completion');
            rows.push({mode,rank,scenario,before,after:getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp),badges,hits,
                snapshot:action.targetSnapshot.targets.map(t=>t.index),primary:action.targetSnapshot.primary?.index,sp:enemy.sp,cost:skillDatabase.fireCritical.spCost,finished,
                visible:!!document.getElementById('battlePlayerCard1')?.getBoundingClientRect().height});
        }finally{
            showMonsterSkillNameBadge=badge;showPlayerHit=hit;Math.random=random;
            battleActive=false;battleToken++;autoBattle=false;clearInterval(timerId);
            releaseFinish?.();releasePause();
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
try{
    const page=(await waitJson('http://127.0.0.1:'+port+'/json/list')).find(t=>t.type==='page');
    client=new Cdp(page.webSocketDebuggerUrl);await client.send('Page.enable');await client.send('Runtime.enable');
    const evidence=[];
    for(const [width,height] of [[390,844],[412,915]]){
        await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
        await client.send('Page.navigate',{url:server.url});const rows=await client.eval(expression);
        assert.equal(rows.length,12);
        for(const r of rows){
            assert.equal(r.finished,1);assert.equal(r.visible,true);assert.ok(r.hits.some(h=>h.critical===true));
            const target=r.scenario==='revived'?1:0;
            assert.equal(r.primary,target);assert.ok(r.badges.length>0);
            assert.ok(r.badges.every(b=>b.primary===target&&b.targets.length===1&&b.targets[0]===target));
            assert.ok(r.hits.every(h=>h.index===target));
            if(r.scenario==='lethal'){assert.equal(r.hits.length,1);assert.equal(r.after[0],0);}
            else{assert.equal(r.badges.length,2);assert.ok(r.after[target]<r.before[target]);}
            r.after.forEach((hp,index)=>{if(index!==target)assert.equal(hp,r.before[index]);});
            if(r.scenario==='revived')assert.deepEqual(r.snapshot,[1,2]);
            assert.equal(r.sp,1000-r.cost,'original cost once; follow-up free');
        }
        evidence.push({width,height,rows});
        const png=await client.send('Page.captureScreenshot',{format:'png'});
        fs.writeFileSync(path.join(out,'battle-target-'+width+'.png'),Buffer.from(png.data,'base64'));
    }
    fs.writeFileSync(path.join(out,'battle-target-lifecycle.json'),JSON.stringify({passed:true,expected,baseUrl,evidence},null,2)+'\n');
    console.log('Battle target lifecycle: 24 full-production mobile browser scenarios PASS');
}catch(error){
    fs.writeFileSync(path.join(out,'battle-target-lifecycle.json'),JSON.stringify({passed:false,expected,baseUrl,error:String(error.stack||error),events:client?.events.slice(-15)},null,2)+'\n');throw error;
}finally{
    client?.close();proc.kill('SIGTERM');
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});
    await new Promise(resolve=>server.server.close(resolve));
}
