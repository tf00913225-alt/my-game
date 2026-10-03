import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT,findChrome,startServer,waitJson,Cdp} from './runtime-browser-qa-support.mjs';
const fixture=fs.readFileSync('tests/fixtures/wild-balance-reference-party.js','utf8');
const expression=`(async()=>{
 const check=(v,m)=>{if(!v)throw new Error(m);};
 const wait=async(test,ms=15000)=>{const end=performance.now()+ms;while(!test()&&performance.now()<end)await new Promise(r=>setTimeout(r,40));check(test(),'Runtime wait timeout: '+test);};
 await wait(()=>window.FourSymbolsStartupPolicy?.getState?.()==='READY',30000);
 await FourSymbolsFeatures.ensure('gameplay-core','wild-balance-qa');
 closeHomeFeature();showPage('home');autoConfig.enabled=false;autoBattle=false;autoPatrolEnabled=false;
 const evidence=window.wildBalanceQaEvidence={ttk:[],scenes:[],beginner:null},oldRandom=Math.random;
 const project=m=>({hp:m.maxHP,sp:m.maxSP,attack:m.attack,magic:m.magicAttack,defense:m.defense,speed:m.agility});
 const verify=()=>{
  for(const i of currentBattleMonsters){const m=monsters[i],p=MonsterBalance.debug(m);check(m.rank===p.identity.rank,'canonical rank');check(JSON.stringify(project(m))===JSON.stringify({hp:p.final.maxHP,sp:p.final.maxSP,attack:p.final.physicalAttack,magic:p.final.magicAttack,defense:p.final.defense,speed:p.final.speed}),'no late stat mutation');
   const node=document.getElementById('battleMonster'+i),r=node?.getBoundingClientRect();check(r&&r.width>0&&r.height>0,'visible monster');check(m.name&&m.element&&m.portraitKey,'identity and portrait');
  }
 };
 const settle=async()=>{await wait(()=>!battleActive,100000);await new Promise(r=>setTimeout(r,1600));check(document.getElementById('mapPage')?.classList.contains('active'),'returns to patrol map');};
 try{
 if(innerWidth===412){
  for(const level of [10,30,50,70,100])for(const elite of [false,true]){
   const reference=prepareWildBalanceReferenceParty(level),encounter=buildWildBalanceReferenceRoster(level,'water',elite);
   enterZone(encounter.zone);await wait(()=>document.getElementById('mapPage')?.classList.contains('active'));monsters=encounter.roster;mapCooldown=false;
   Math.random=()=>.999;startBattle(0);Math.random=()=>.5;
   // StartBattle owns the normal 10% rank draw. Diagnostics request one Elite tank explicitly.
   if(elite){const m=monsters.find(m=>m.archetype==='tank');Object.assign(m,MonsterBalance.build({...m.balanceProjection.identity,rank:'elite'}));m.v141BattleRank=m.rank;configureBuiltMonster(m);}
   await wait(()=>battleActive&&!document.getElementById('battlePage')?.matches('.v141-preparing-entry,.v141-entry-moving'));verify();
   check(currentBattleMonsters.length===encounter.count,'maximum formal encounter size');
   let rounds=0;const actions=[];const off=FourSymbolsBattleFlow.subscribeBeforeCombatant(e=>{actions.push(e.queue[e.index]?.type);});
   try{while(battleActive&&rounds<4){await wait(()=>!battleActive||battlePhase==='declare');if(!battleActive)break;const before=turn;rounds++;queuedPlayerActions={};for(const i of getExistingPartyIndexes())queuedPlayerActions[i]=chooseWildBalanceReferenceAction(i,reference.skill);startResolutionPhase(battleToken);await wait(()=>!battleActive||turn>before,100000);}}
   finally{off();}
   const cleared=monsters.filter((m,i)=>currentBattleMonsters.includes(i)).every(m=>!m.alive||m.hp<=0);
   evidence.ttk.push({level,elite,rounds,cleared,actions,reference});check(cleared,'encounter cleared');check(rounds<=(elite?3:2),'TTK '+level+'/'+elite+' = '+rounds);
   await settle();
  }
 }
 // Real zone entry, patrol scheduler, manual action and automatic next encounter at both sizes.
 const reference=prepareWildBalanceReferenceParty(50);window.v131GrantElementBoxHours(8,32);for(const c of [autoConfig,autoConfig2,autoConfig3])c.skill=reference.skill;enterZone('zone5');await wait(()=>isPatrolMapActive());
 const before=monsters.map(project);toggleAutoPatrol();check(autoPatrolEnabled,'auto patrol enabled');await wait(()=>battleActive,20000);toggleAutoPatrol();autoPatrolEnabled=false;
 await wait(()=>!document.getElementById('battlePage')?.matches('.v141-preparing-entry,.v141-entry-moving'));verify();
 const initial=currentBattleMonsters.map(i=>({key:monsters[i].monsterKey,rank:monsters[i].rank,...project(monsters[i])}));
 queuedPlayerActions={};for(const i of getExistingPartyIndexes())queuedPlayerActions[i]=chooseWildBalanceReferenceAction(i,reference.skill);const initialTurn=turn;startResolutionPhase(battleToken);await wait(()=>!battleActive||turn>initialTurn,100000);
 if(battleActive){toggleAutoBattle();check(autoBattle,'auto battle enabled');await wait(()=>!battleActive,100000);}
 await settle();enterZone('zone5');if(!autoBattle)toggleAutoBattle();check(autoBattle,'formal auto preference enabled');mapCooldown=false;startBattle(0);await wait(()=>battleActive);check(autoBattle,'fresh automatic encounter');await settle();autoConfig.enabled=false;autoBattle=false;evidence.scenes.push({manual:true,automatic:true,patrol:true,initial,before});
 enterZone('zone5');for(const m of monsters){const p=MonsterBalance.debug(m);check(m.maxHP===p.final.maxHP,'fresh encounter has no repeated multiplier');}
 // Beginner: one natural enemy round against a legal Lv1 character, no inflated health.
 autoConfig.enabled=false;autoBattle=false;prepareWildBalanceReferenceParty(1);player2=null;player3=null;enterZone('forest');mapCooldown=false;Math.random=()=>.999;startBattle(0);Math.random=()=>.5;
 await wait(()=>battleActive&&!document.getElementById('battlePage')?.matches('.v141-preparing-entry,.v141-entry-moving'));
 const hp=player.hp,count=currentBattleMonsters.length;check(currentBattleMonsters.every(i=>monsters[i].agility===0&&monsters[i].skillIds.length===0),'beginner speed and skills');
 queuedPlayerActions={0:{action:'defend'}};const round=turn;startResolutionPhase(battleToken);await wait(()=>!battleActive||turn>round,100000);
 evidence.beginner={before:hp,after:player.hp,count};check(player.hp>0&&hp-player.hp<=count*8,'beginner safety');
 verify();return evidence;
 }finally{Math.random=oldRandom;autoPatrolEnabled=false;}
})()`;
const server=await startServer(),chrome=findChrome();
const artifact=path.join(ROOT,'artifacts/browser-qa/wild-balance.json');fs.mkdirSync(path.dirname(artifact),{recursive:true});let client,proc,profile;const results=[];
function closeViewport(){
 client?.close();client=null;proc?.kill('SIGTERM');proc=null;
 if(profile){try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}profile=null;}
}
try{
 for(const [width,height] of [[412,915],[390,844]]){
  // Match the existing Skill Runtime QA: diagnostics write local candidates,
  // so each independent viewport needs its own process and fresh profile.
  // Formal reload conflict protection remains unchanged.
  profile=fs.mkdtempSync(path.join(os.tmpdir(),'wild-balance-'));
  const port=9900+Math.floor(Math.random()*100);
  proc=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
  const tabs=await waitJson('http://127.0.0.1:'+port+'/json/list');client=new Cdp(tabs.find(x=>x.type==='page').webSocketDebuggerUrl);await client.send('Page.enable');await client.send('Runtime.enable');
  await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await client.send('Page.navigate',{url:server.url});
  await new Promise(r=>setTimeout(r,1000));const result=await client.eval(fixture+'\n'+expression);results.push({width,height,...result});
  // A fresh profile can show the normal release notice after combat settles.
  // Use its existing header return control before verifying screenshot visibility.
  const notice=await client.eval(`(()=>{const modal=document.getElementById('homeFeatureModal');if(!modal?.classList.contains('show'))return null;if(!modal.classList.contains('release-update-modal')||modal.classList.contains('release-update-forced'))throw Error('Unexpected blocking modal in Wild QA');const button=modal.querySelector('.home-feature-close-btn[onclick="closeHomeFeature()"]');if(!button)throw Error('Release notice has no formal return control');const r=button.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,unobstructed:button.contains(document.elementFromPoint(x,y))};})()`);
  if(notice){
   assert.equal(notice.unobstructed,true,'Release notice return must be accessible');
   await client.send('Input.dispatchMouseEvent',{type:'mousePressed',x:notice.x,y:notice.y,button:'left',clickCount:1});
   await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:notice.x,y:notice.y,button:'left',clickCount:1});
   await new Promise(r=>setTimeout(r,300));
  }
  assert.equal(await client.eval("!!document.getElementById('homeFeatureModal')?.classList.contains('show')"),false,'Battle screenshot must not be hidden by a modal');
  results.at(-1).releaseNoticeDismissed=!!notice;
  const shot=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(artifact.replace('.json','-'+width+'x'+height+'.png'),Buffer.from(shot.data,'base64'));
  closeViewport();
 }
 assert.equal(results[0].ttk.length,10);fs.writeFileSync(artifact,JSON.stringify({passed:true,commitSha:process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||'local',results},null,2)+'\n');console.log('Wild balance natural production battles, TTK, patrol, manual/auto and beginner: PASS');
}catch(error){const partial=await client?.eval('({evidence:window.wildBalanceQaEvidence,startupState:window.FourSymbolsStartupPolicy?.getState?.(),startupUid:window.FourSymbolsStartupPolicy?.getUid?.(),turn,battleActive,battlePhase,autoBattle,currentZone})').catch(()=>null);fs.writeFileSync(artifact,JSON.stringify({passed:false,error:String(error.stack||error),results,partial,console:client?.events.filter(e=>e.method==='Runtime.consoleAPICalled').slice(-15)},null,2)+'\n');throw error;}
finally{closeViewport();await new Promise(r=>server.server.close(r));}
