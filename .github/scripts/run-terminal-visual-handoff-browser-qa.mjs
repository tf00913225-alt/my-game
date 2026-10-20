import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT,findChrome,startServer,waitJson,Cdp,collectStartupFailure,observeChromeStartup} from './runtime-browser-qa-support.mjs';
const baseUrl=process.env.QA_BASE_URL||'';
const expected=process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||'local';
const endFixture=fs.readFileSync('.github/scripts/battle-layer-audio-live-qa.mjs','utf8').match(/^function finishBattleLayerQaEndFixture\([\s\S]*?^\}/m)?.[0];
assert.ok(endFixture,'use the actual formal QA end fixture');
const handoffFixture=fs.readFileSync('.github/scripts/battle-layer-audio-live-qa.mjs','utf8').match(/^function battleLayerQaTerminalHandoffReady\([\s\S]*?^\}/m)?.[0];
assert.ok(handoffFixture,'use the actual formal QA phase predicate');
if(baseUrl){assert.equal((await (await fetch(baseUrl+'/release-manifest.json',{cache:'no-store'})).json()).commitSha,expected);}
const expression=`(async()=>{
    ${endFixture}
    ${handoffFixture}
    const wait=async(fn,label,ms=30000)=>{const end=Date.now()+ms;while(!fn()&&Date.now()<end)await new Promise(r=>setTimeout(r,20));if(!fn())throw Error(label);};
    await wait(()=>window.FourSymbolsStartupPolicy?.getState?.()==='READY','startup');
    await FourSymbolsFeatures.ensure('gameplay-core','terminal-visual-qa');
    await FourSymbolsFeatures.ensure('feature-boss-relic','terminal-visual-qa');
    closeHomeFeature();
    const rows=[];window.__terminalVisualQaRows=rows;
    for(const skill of ['flameSlash','explosiveFlurry','phoenixCry']){
        autoBattle=false;autoConfig.enabled=false;autoPatrolEnabled=false;
        player.level=70;player.bonusHP=100000;player.bonusSP=100000;player.hp=100000;player.sp=100000;
        characterSkillLoadouts[getPartyCharacterKey(0)].skillLevels[skill]=1;
        const count=skill==='flameSlash'?1:skill==='explosiveFlurry'?3:6;
        monsters=Array.from({length:count},(_,i)=>MonsterBalance.build({monsterKey:'qa.terminal.'+i,name:'QA target '+i,level:1,element:'earth',archetype:'balanced',rank:'regular',mode:'wild',context:'qa/terminal'}));
        for(const m of monsters)Object.assign(m,{hp:100,maxHP:100,alive:true,noRewards:true});
        currentZone='forest';mapCooldown=false;startBattle(0);
        await wait(()=>battleActive&&turn>=1,'battle begin');
        await wait(()=>!document.getElementById('battlePage').classList.contains('v141-entry-moving')&&!document.getElementById('battlePage').classList.contains('v141-preparing-entry'),'entry');
        clearInterval(timerId);closeHomeFeature();
        const release=FourSymbolsBattleFlow.acquirePauseLock('terminal-visual-qa');
        const random=Math.random;
        try{
            currentBattleMonsters=monsters.map((_,i)=>i);for(const m of monsters)Object.assign(m,{hp:1,maxHP:100,alive:true});
            renderBattle();battlePhase='resolve';initiativeIndex=0;activeBattleCharacterIndex=0;selectedMonster=0;
            initiativeQueue=[{type:'player',characterIndex:0}];processedInitiativeIndexes=new Set();battleAdvanceScheduled=false;
            player.sp=getMainCharacterStats().maxSP;Math.random=()=>0;
            const samples=[];let finished=false;
            const sample=()=>{const gate=v142GetActiveAnimationGate();samples.push({at:performance.now(),done:gate?.done??true,remaining:v142GetRemainingAnimationMs(),exit:document.getElementById('battlePage').classList.contains('v141-exit-player'),vfx:!!document.getElementById('v143-skill-stage'),alive:currentBattleMonsters.filter(i=>monsters[i]?.alive).length});if(!finished)requestAnimationFrame(sample);};
            const start=performance.now();castDamageSkill(skill);sample();
            await wait(()=>document.getElementById('battlePage').classList.contains('v141-exit-player'),'victory exit',15000);
            finished=true;
            const exit=samples.find(s=>s.exit)||{at:performance.now(),done:v142GetActiveAnimationGate()?.done??true};
            const premature=samples.filter(s=>s.exit&&!s.done);
            rows.push({skill,count,start,exit,premature:premature.length,samples,gateReason:v142GetActiveAnimationGate()?.reason});
            if(premature.length)throw Error(skill+' victory exit before visual completion');
            if(exit.at-start<v142GetSkillAnimationConfig(skill).duration+650+650)throw Error(skill+' skipped visual lifetime/post-action/exit beat');
            await wait(()=>!battleActive,'settlement',15000);
        }finally{Math.random=random;release();}
    }
    autoBattle=false;autoConfig.enabled=false;autoPatrolEnabled=false;
    monsters=[MonsterBalance.build({monsterKey:'qa.terminal.declaration',name:'QA terminal declaration',level:1,element:'earth',archetype:'balanced',rank:'regular',mode:'wild',context:'qa/terminal'})];
    Object.assign(monsters[0],{hp:100,maxHP:100,alive:true,noRewards:true});
    mapCooldown=false;startBattle(0);await wait(()=>battleActive&&turn>=1,'declaration battle begin');
    await wait(()=>!document.getElementById('battlePage').matches('.v141-entry-moving,.v141-preparing-entry'),'declaration entry');
    clearInterval(timerId);const release=FourSymbolsBattleFlow.acquirePauseLock('terminal-declaration-qa');
    try{
        battlePhase='declare';activeBattleCharacterIndex=0;finishPlayerAction();
        if(!battleAdvanceScheduled)throw Error('formal declaration handoff missing');
        window.__battleLayerQaEndResult={ended:false};
        const start=performance.now();finishBattleLayerQaEndFixture();
        await wait(()=>finishBattleLayerQaEndFixture(),'formal terminal fixture release',5000);
        rows.push({scenario:'queued-declaration-terminal',elapsed:performance.now()-start,ended:window.__battleLayerQaEndResult.ended,battleActive});
    }finally{release();}
    const waves=[0,1].map(wave=>[MonsterBalance.build({monsterKey:'qa.terminal.wave.'+wave,name:'QA wave '+wave,level:40,element:'earth',archetype:'balanced',rank:'regular',mode:'abyss',abyssDifficulty:40,abyssRegion:'east',abyssStage:0,context:'abyss/40/east/stage/1'})]);
    for(const wave of waves)for(const m of wave)Object.assign(m,{hp:m.maxHP,alive:true,noRewards:true,skillIds:['stoneThrow'],skillChance:1,v141SupportSkillIds:[],v132FixedSkillLoadout:true,v141ForceSkillLevel:1});
    let outcome=null;mapCooldown=false;
    if(!v132LaunchDungeonBattle(waves[0],value=>{outcome=value.result;showPage('dungeon');},{mode:'abyss',waves}))throw Error('formal two-wave launch');
    await wait(()=>battleActive&&turn>=1,'two-wave begin');
    await wait(()=>!document.getElementById('battlePage').matches('.v141-entry-moving,.v141-preparing-entry'),'two-wave entry');
    clearInterval(timerId);const random=Math.random;
    try{
        battlePhase='resolve';activeBattleCharacterIndex=0;initiativeIndex=0;
        initiativeQueue=[{type:'player',characterIndex:0}];processedInitiativeIndexes=new Set();
        currentBattleMonsters.forEach(i=>monsters[i].hp=1);selectedMonster=currentBattleMonsters[0];player.sp=getMainCharacterStats().maxSP;
        Math.random=()=>.5;beginBattleDurationAction({token:battleToken,index:0,queue:initiativeQueue});
        battleStatisticsBeginAction(initiativeQueue[0]);castDamageSkill('flameSlash');
        window.__battleLayerQaEndResult={ended:false};window.__battleLayerQaCompleteEnd=finishBattleLayerQaEndFixture;
        const token=battleToken,start=performance.now();
        await wait(()=>battleLayerQaTerminalHandoffReady(),'formal two-wave terminal handoff',5000);
        const handoffMs=performance.now()-start;
        await wait(()=>['win','lose'].includes(outcome),'formal two-wave outcome callback',6000);
        if(battleActive||battleToken<=token||document.getElementById('battlePage').classList.contains('active')||document.getElementById('v143-skill-stage'))throw Error('two-wave final cleanup '+JSON.stringify({battleActive,token,battleToken,page:document.querySelector('.page.active')?.id,stage:!!document.getElementById('v143-skill-stage'),outcome}));
        rows.push({scenario:'two-wave-terminal-phases',handoffMs,totalMs:performance.now()-start,outcome,battleActive,tokenAdvanced:battleToken>token});
    }finally{Math.random=random;}
    return rows;
})()`;
const server=await startServer({baseUrl}),profile=fs.mkdtempSync(path.join(os.tmpdir(),'terminal-visual-qa-'));
const port=9900+Math.floor(Math.random()*90);
const chrome=findChrome();
const proc=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe'],windowsHide:true});
const startup=observeChromeStartup(proc,{port,output:path.join(ROOT,'artifacts/browser-qa/terminal-visual-chrome-startup.json')});
let chromeStderr='',chromeExit=null,chromeSpawnError=null;
proc.stderr.on('data',chunk=>{chromeStderr=(chromeStderr+chunk).slice(-4000);});
proc.on('exit',(code,signal)=>{chromeExit={code,signal};});
proc.on('error',error=>{chromeSpawnError=String(error.message);});
const out=path.join(ROOT,'artifacts/browser-qa');fs.mkdirSync(out,{recursive:true});let cdp;
try{
    const page=(await waitJson('http://127.0.0.1:'+port+'/json/list')).find(p=>p.type==='page');
    await startup.finish('DevTools ready');
    cdp=new Cdp(page.webSocketDebuggerUrl);await cdp.send('Page.enable');await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await cdp.send('Page.navigate',{url:server.url});
    let running=true,frame=0;
    const result=cdp.eval(expression).then(value=>({value}),error=>({error})).finally(()=>{running=false;});
    while(running){
        await new Promise(r=>setTimeout(r,400));
        if(running){const shot=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:65});fs.writeFileSync(path.join(out,'terminal-visual-'+String(frame++).padStart(3,'0')+'.jpg'),Buffer.from(shot.data,'base64'));}
    }
    const outcome=await result;if(outcome.error)throw outcome.error;
    const rows=outcome.value;assert.equal(rows.length,5);assert.equal(rows[3].ended,true);assert.equal(rows[3].battleActive,false);assert.equal(rows[4].outcome,'win');assert.equal(rows[4].tokenAdvanced,true);assert.equal(server.failures.length,0);
    fs.writeFileSync(path.join(out,'terminal-visual-handoff.json'),JSON.stringify({passed:true,expected,baseUrl,rows},null,2));
    console.log('Terminal visual handoff: single/tri/all, queued declaration and two-wave terminal phases PASS');
}catch(error){
    await startup.finish('startup or QA failure');
    const detail=cdp?await collectStartupFailure(cdp,{error:String(error.stack||error)}):{};
    detail.chromeProcess={executable:chrome,pid:proc.pid??null,port,
        exit:chromeExit,spawnError:chromeSpawnError,stderr:chromeStderr};
    if(!cdp){console.error('Terminal visual Chrome startup diagnostics: '+JSON.stringify(detail.chromeProcess));}
    if(cdp){detail.rows=await cdp.eval('window.__terminalVisualQaRows||[]');}
    fs.writeFileSync(path.join(out,'terminal-visual-handoff.json'),JSON.stringify({passed:false,expected,baseUrl,detail,failures:server.failures},null,2));throw error;
}finally{
    cdp?.close();proc.kill();await new Promise(r=>server.server.close(r));
    if(proc.exitCode===null){await new Promise(r=>{proc.once('exit',r);setTimeout(r,2000);});}
    if(path.dirname(path.resolve(profile))===path.resolve(os.tmpdir())&&path.basename(profile).startsWith('terminal-visual-qa-')){
        try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
        catch(error){console.warn('QA temporary profile cleanup pending: '+error.code);}
    }
}
