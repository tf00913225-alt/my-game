import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT,findChrome,startServer,waitJson,Cdp,collectStartupFailure} from './runtime-browser-qa-support.mjs';
const baseUrl=process.env.QA_BASE_URL||'';
const expected=process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||'local';
if(baseUrl){assert.equal((await (await fetch(baseUrl+'/release-manifest.json',{cache:'no-store'})).json()).commitSha,expected);}
const expression=`(async()=>{
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
    return rows;
})()`;
const server=await startServer({baseUrl}),profile=fs.mkdtempSync(path.join(os.tmpdir(),'terminal-visual-qa-'));
const port=9900+Math.floor(Math.random()*90);
const proc=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
const out=path.join(ROOT,'artifacts/browser-qa');fs.mkdirSync(out,{recursive:true});let cdp;
try{
    const page=(await waitJson('http://127.0.0.1:'+port+'/json/list')).find(p=>p.type==='page');
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
    const rows=outcome.value;assert.equal(rows.length,3);assert.equal(server.failures.length,0);
    fs.writeFileSync(path.join(out,'terminal-visual-handoff.json'),JSON.stringify({passed:true,expected,baseUrl,rows},null,2));
    console.log('Terminal visual handoff: full production single/tri/all PASS');
}catch(error){
    const detail=cdp?await collectStartupFailure(cdp,{error:String(error.stack||error)}):{};
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
