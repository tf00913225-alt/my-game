import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT,findChrome,startServer,waitJson,Cdp} from './runtime-browser-qa-support.mjs';
const expression=`(async()=>{
 const check=(value,message)=>{if(!value)throw new Error(message);};
 const wait=async(test,ms=12000)=>{const end=performance.now()+ms;while(!test()&&performance.now()<end)await new Promise(r=>setTimeout(r,40));check(test(),'Runtime wait timeout');};
 await wait(()=>window.FourSymbolsStartupPolicy?.getState?.()==='READY',30000);
 await FourSymbolsFeatures.ensure('gameplay-core','tower-challenge-qa');
 await FourSymbolsFeatures.ensure('feature-boss-relic','tower-challenge-qa');
 showPage('home');await FourSymbolsReleaseUpdate.checkForUpdate('tower-challenge-qa',{force:true});FourSymbolsReleaseUpdate.notifySafeState();closeHomeFeature();
 check(!document.getElementById('homeFeatureModal')?.classList.contains('show'),'login announcement closed through official owner');
 autoBattle=false;autoConfig.enabled=false;autoPatrolEnabled=false;player.level=100;player.vitality=100000;player.energy=100000;
 const evidence={matrix:[],actions:[],healing:[],status:[],aoe:[]};
 const dates={};for(const element of ['fire','water','wind','earth']){let date=Date.now();while(GameplaySystem.getWeekInfo(date).element!==element)date-=604800000;dates[element]=date;}
 const enter=async(element,floor)=>{
   player.hp=getMainCharacterStats().maxHP;player.sp=getMainCharacterStats().maxSP;player.statusEffects=[];player.activeBuffs=[];
   const realNow=Date.now;let roster;
   try{Date.now=()=>dates[element];const week=GameplaySystem.getWeekInfo(Date.now());GameplaySystem.debugReloadState({tower:{weekKey:week.key,completedFloor:floor-1}},Date.now());roster=GameplaySystem.buildTowerRoster(floor);check(vGameplaySelectTowerBand(floor)===true,'Tower entry refused');}finally{Date.now=realNow;}
   await wait(()=>battleActive);await wait(()=>!document.getElementById('battlePage')?.matches('.v141-preparing-entry,.v141-entry-moving'));
   check(currentBattleMonsters.length===10,'real roster count');
   check(!document.getElementById('homeFeatureModal')?.classList.contains('show'),'battle has no covering shared modal');
   const slots=FourSymbolsBattlefieldSlots.getActiveEnemySnapshot();
   check(slots&&new Set(Object.values(slots.monsterIndexToSlot)).size===10,'unique battle slots');
   const chance=floor<=30?.65:floor<=60?.7:floor<=90?.75:.8;
   check(currentBattleMonsters.every(i=>monsters[i].skillChance===chance),'common skill chance');
   const units=currentBattleMonsters.map(i=>({index:i,rank:monsters[i].rank,chance:monsters[i].skillChance,slot:FourSymbolsBattlefieldSlots.getEnemySlotForMonster(slots,i),evasion:getMonsterEvasion(monsters[i]),speed:getMonsterAgility(monsters[i]),hp:monsters[i].maxHP,defense:getMonsterEffectiveDefense(monsters[i])}));
   check(units.every(u=>{const r=document.getElementById('battleMonster'+u.index)?.getBoundingClientRect();return r&&r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth+1;}),'ten visible targets');
   evidence.matrix.push({element,floor,units});return roster;
 };
 const exit=async()=>{loseBattle();await wait(()=>!battleActive);await new Promise(r=>setTimeout(r,1300));};
 // Full production loadout, slots and decision frequency at every band and rank.
 for(const element of ['fire','water','wind','earth'])for(const floor of [1,5,10,45,75,100]){
   await enter(element,floor);
   const chance=monsters[currentBattleMonsters[0]].skillChance;
   for(const i of currentBattleMonsters){const m=monsters[i];m.sp=100000;let count=0;for(let roll=0;roll<1000;roll++)count+=Number(FourSymbolsEnemySkillAI.enterSkillDecision(m,(roll+.5)/1000));check(count===chance*1000,'frequency '+element+'/'+floor+'/'+i);const before=JSON.stringify(m);GameplaySystem.applyTowerElementProfile(m,element);GameplaySystem.applyTowerChallengeProfile(m);check(JSON.stringify(m)===before,'idempotency');}
   await exit();
 }
 await enter('water',100);
 const caster=monsters[currentBattleMonsters[0]],ally=monsters[currentBattleMonsters[1]];
 const beforeHp=ally.hp;ally.hp=1;const healed=v141HealMonsterPreservingShield(ally,1000,caster);check(healed===1150,'water HP heal +15');evidence.healing.push({healed,sp:ally.sp});ally.hp=beforeHp;
 const bonus=getTowerStatusAccuracyBonus(caster);
 for(const base of [30,52,999]){const hard=calculateStatusEffectChance(base,100,100,0,0,true,'player',0,bonus);evidence.status.push({base,hard});check(hard===(base===30?45:60),'water hard cap');}
 check(calculateStatusEffectChance(40,1,1,0,0,false,'player',0,bonus)===55,'water soft +15');
 // The real enemy turn must choose healing inside, and only inside, the probability gate.
 caster.sp=100000;ally.hp=1;const spBefore=caster.sp;const oldRandom=Math.random;
 try{Math.random=()=>0;processSingleMonsterAttack(currentBattleMonsters[0],battleToken);}finally{Math.random=oldRandom;}
 await new Promise(r=>setTimeout(r,4500));check(caster.sp<spBefore&&ally.hp>1,'real water heal action');
 await exit();
 await enter('water',100);
 // Ten-unit highest-frequency natural queue, observed through formal lifecycle subscriptions.
 const queueRandom=Math.random;Math.random=()=>.4;const skillNames=[];const badgeOwner=showMonsterSkillNameBadge;showMonsterSkillNameBadge=function(name,...args){skillNames.push(name);return badgeOwner(name,...args);};
 const actions=[];const off=FourSymbolsBattleFlow.subscribeBeforeCombatant(event=>{const unit=event.queue[event.index];if(unit?.type==='monster')actions.push(unit.monsterIndex);});
 let ended=false;const endOff=FourSymbolsBattleFlow.subscribeRoundEnd(()=>{ended=true;});
 queuedPlayerActions={};for(const i of getExistingPartyIndexes())queuedPlayerActions[i]={action:'defend'};
 for(const i of currentBattleMonsters){monsters[i].sp=100000;monsters[i].hp=monsters[i].maxHP;}
 try{startResolutionPhase(battleToken);await wait(()=>ended,100000);}finally{off();endOff();Math.random=queueRandom;showMonsterSkillNameBadge=badgeOwner;}
 check(actions.length===10&&new Set(actions).size===10,'10 x 80 queue completes exactly once');evidence.actions=actions;evidence.freezeSkills=skillNames;check(skillNames.includes(skillDatabase.freeze.name),'real water Freeze decision');
 await exit();
 await enter('fire',1);
 // Actual all-target skill, ten independent settlements and feedback events.
 characterSkillLoadouts.fire.skillLevels.iceArrowRain=1;player.sp=100000;activeBattleCharacterIndex=0;selectedMonster=currentBattleMonsters[0];
 const ids=currentBattleMonsters.slice();for(const i of ids){monsters[i].hp=monsters[i].maxHP=100000;monsters[i].evasion=0;}
 const hitOwner=showMonsterHit, feedback=[];showMonsterHit=function(index,amount,type,...rest){if(type==='hp')feedback.push({index,amount});return hitOwner(index,amount,type,...rest);};
 try{Math.random=()=>.5;castDamageSkill('iceArrowRain');await new Promise(r=>setTimeout(r,5500));}finally{Math.random=oldRandom;showMonsterHit=hitOwner;}
 check(ids.every(i=>monsters[i].hp<100000),'AOE damages all 10');check(feedback.length===10&&new Set(feedback.map(x=>x.index)).size===10,'AOE feedback exactly once per target');evidence.aoe=feedback;
 evidence.battleScreenshotPending=true;vGameplayRenderTower();evidence.rules=document.getElementById('towerPageContent').textContent;check(evidence.rules.includes('每層固定 10 名敵人')&&evidence.rules.includes('65%')&&evidence.rules.includes('80%'),'visible tower rules');
 return evidence;
})()`;
const server=await startServer(),profile=fs.mkdtempSync(path.join(os.tmpdir(),'tower-challenge-')),port=9850+Math.floor(Math.random()*100);
const proc=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
const artifact=path.join(ROOT,'artifacts/browser-qa/tower-challenge.json');fs.mkdirSync(path.dirname(artifact),{recursive:true});let client,evidence;
try{
 const targets=await waitJson('http://127.0.0.1:'+port+'/json/list');client=new Cdp(targets.find(x=>x.type==='page').webSocketDebuggerUrl);await client.send('Page.enable');await client.send('Runtime.enable');await client.send('Emulation.setDeviceMetricsOverride',{width:412,height:915,deviceScaleFactor:1,mobile:true});await client.send('Page.navigate',{url:server.url});evidence=await client.eval(expression);assert.equal(evidence.matrix.length,27);assert.deepEqual(evidence.matrix.map(({element,floor})=>[element,floor]),[...['fire','water','wind','earth'].flatMap(element=>[1,5,10,45,75,100].map(floor=>[element,floor])),['water',100],['water',100],['fire',1]]);
 const shot=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(artifact.replace('.json','-battle.png'),Buffer.from(shot.data,'base64'));await client.eval('loseBattle()');await new Promise(r=>setTimeout(r,3000));await client.eval('vGameplayOpenTower()');const ruleShot=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(artifact.replace('.json','-rules.png'),Buffer.from(ruleShot.data,'base64'));fs.writeFileSync(artifact,JSON.stringify({passed:true,commitSha:process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||'local',evidence},null,2)+'\n');console.log('Tower challenge production Runtime 24 scenes / 10-unit queue / AOE QA passed');
}catch(error){fs.writeFileSync(artifact,JSON.stringify({passed:false,error:String(error.stack||error),evidence,console:client?.events.filter(e=>e.method==='Runtime.consoleAPICalled').slice(-12)},null,2)+'\n');throw error;}
finally{
 console.log('Tower QA cleanup: closing CDP and Chrome');
 client?.close();proc.kill('SIGTERM');
 console.log('Tower QA cleanup: removing temporary profile');
 try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch(_){}
 console.log('Tower QA cleanup: closing HTTP server');
 await new Promise(r=>{server.server.close(r);server.server.closeAllConnections();});
 console.log('Tower QA cleanup: HTTP server closed');
 setTimeout(()=>console.log('Tower QA remaining resources:',process.getActiveResourcesInfo()),5000).unref();
}
