import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT,findChrome,startServer,waitJson,Cdp} from './runtime-browser-qa-support.mjs';
const fixture=fs.readFileSync('tests/fixtures/wild-balance-reference-party.js','utf8');
const expression=`(async()=>{
 const check=(v,m)=>{if(!v)throw Error(m);};
 const wait=async(fn,ms=30000)=>{const end=performance.now()+ms;while(!fn()&&performance.now()<end)await new Promise(r=>setTimeout(r,40));check(fn(),'Runtime wait: '+fn);};
 await wait(()=>FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden===true&&getComputedStyle(document.getElementById('gameInterface')).display!=='none'&&!document.getElementById('firebaseAuthOverlay')?.classList.contains('show'));
 await FourSymbolsFeatures.ensure('gameplay-core','daily-balance-qa');
 await wait(()=>FourSymbolsReleaseUpdate?.getState?.().availableReleaseVersion);
 closeHomeFeature();autoConfig.enabled=false;autoBattle=false;autoPatrolEnabled=false;
 const evidence=window.dailyBalanceQaEvidence={encounters:[],captures:[],floatingFeedback:[],lateMutation:false},oldRandom=Math.random;
 const feedbackObserver=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1&&node.matches('.battle-floating-feedback')){const r=node.getBoundingClientRect();evidence.floatingFeedback.push({kind:node.dataset.feedbackKind,text:node.textContent,width:r.width,height:r.height});}});
 feedbackObserver.observe(document.body,{childList:true});
 const stats=m=>({hp:m.maxHP,sp:m.maxSP,attack:m.attack,magic:m.magicAttack,defense:m.defense,speed:m.agility,points:m.balanceProjection.allocation});
 const verify=()=>{
  for(const i of currentBattleMonsters){const m=monsters[i],p=MonsterBalance.debug(m);
   check(m.mode==='daily'&&m.balanceOwner==='MonsterBalance','Daily Owner');
   check(m.maxHP===p.final.maxHP&&m.maxSP===p.final.maxSP&&m.attack===p.final.physicalAttack&&m.magicAttack===p.final.magicAttack&&m.defense===p.final.defense&&m.agility===p.final.speed,'no late scaling');
   check(m.skillChance===p.skillFrequency,'one skill frequency owner');
   const box=document.getElementById('battleMonster'+i),art=box?.querySelector('.v174-battle-art'),r=art?.getBoundingClientRect();
   check(r&&r.width>0&&r.height>0&&getComputedStyle(art).backgroundImage!=='none','visible portrait');
   const hp=box.querySelector('.monster-hp-inner'),sp=box.querySelector('.monster-sp-inner');check(hp&&sp,'HP/SP UI');
   check(box.querySelector('.monster-status-badges'),'formal status presentation');
  }
 };
 async function scene(type,level,size,automatic){
  const reference=prepareWildBalanceReferenceParty(level,size);
  closeHomeFeature();
  window.v131GrantElementBoxHours(8,32);for(const c of [autoConfig,autoConfig2,autoConfig3]){c.skill=reference.skill;c.enabled=false;}
  autoConfig.enabled=false;autoBattle=false;showPage('dungeon');switchDungeonTab('daily');
  const start=type==='exp'?v132BeginExpDungeon:type==='material'?v132BeginMaterialDungeon:v148BeginGoldDungeon;
  const launched=start();await wait(()=>document.getElementById('v169RpgDialogLayer')?.classList.contains('show'));
  const confirm=document.querySelectorAll('#v169RpgDialogLayer .v169-rpg-dialog-button')[1];check(confirm?.textContent==='進入副本','entry confirmation');confirm.click();await launched;
  await wait(()=>battleActive&&window.v132ActiveDungeonRun?.mode==='daily');
  Math.random=()=>.5;
  const encountered=[],initial=monsters.map(stats);let off,snapshots=[];
  off=FourSymbolsBattleFlow.subscribeBeforeCombatant(e=>snapshots.push({wave:monsters[0]?.wave,turn,actor:e.queue[e.index]?.type,hp:getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp)}));
  try{
   let previousWave=0;
   while(battleActive){
    await wait(()=>!battleActive||(battlePhase==='declare'&&battlePresentationLocks.size===0&&!document.getElementById('battlePage')?.matches('.v141-preparing-entry,.v141-entry-moving')),100000);if(!battleActive)break;
    const wave=monsters[0]?.wave;check(wave>=1&&wave<=3,'wave identity');
    if(wave!==previousWave){
     previousWave=wave;verify();renderBattle();verify();
     check(!document.getElementById('homeFeatureModal')?.classList.contains('show'),'unobstructed battle');
     encountered.push({wave,ranks:monsters.map(m=>m.rank),before:monsters.map(stats),rounds:0});
     // Expose a stable natural battle frame to the outer screenshot runner.
     window.dailyBalanceQaCapture={type,wave,level,size};await new Promise(r=>setTimeout(r,350));
    }
    const oldRoster=monsters,beforeTurn=turn;encountered.at(-1).rounds=turn;
    // Use the real skill button and target card, so declaration timers and
    // the queue lifecycle are settled by their existing owners.
    while(battleActive&&battlePhase==='declare'){
     await wait(()=>!battleActive||battlePhase!=='declare'||(!battleAdvanceScheduled&&battlePresentationLocks.size===0&&declaredCharacterIndexes.has(activeBattleCharacterIndex)));
     if(!battleActive||battlePhase!=='declare')break;
     const action=chooseWildBalanceReferenceAction(activeBattleCharacterIndex,reference.skill);
     toggleSkillQuickBar();
     const button=document.querySelector('.skill-quick-button[data-skill-id="'+reference.skill+'"]');
     check(button&&!button.disabled,'manual learned skill button');button.click();
     check(actionReady&&pendingAction===reference.skill,'formal skill declaration');
     document.getElementById('battleMonster'+(action.target??currentBattleMonsters.find(i=>monsters[i].alive))).click();
    }
    await wait(()=>!battleActive||monsters!==oldRoster||turn>beforeTurn,100000);
    if(automatic&&battleActive&&!autoBattle){toggleAutoBattle();check(autoBattle,'formal auto battle');}
    if(autoBattle){await wait(()=>!battleActive,160000);break;}
   }
  }finally{off();}
  // Auto waves are identified from the actual combatant callback snapshots.
  if(automatic){for(const wave of [2,3])if(!encountered.some(x=>x.wave===wave))encountered.push({wave,rounds:Math.max(...snapshots.filter(s=>s.wave===wave).map(s=>s.turn)),automatic:true});}
  check(encountered.length===3,'all three waves naturally activated');check(encountered.every(w=>w.rounds<=2),'natural <=2 round waves '+JSON.stringify(encountered.map(w=>[w.wave,w.rounds])));
  await wait(()=>document.getElementById('v132RewardModal')?.classList.contains('show'));
  const title=document.querySelector('#v132RewardModal h3')?.textContent;
  check(title?.includes(type==='material'?'材料':type==='gold'?'金幣':'經驗'),'matching reward '+title);
  const beforeClaim={gold,exp:sharedExp,material:inventoryItems.filter(x=>x.id==='materialChest').reduce((s,x)=>s+(x.count||1),0)};
  const claim=document.querySelector('#v132RewardModal button');check(claim?.textContent==='直接領取','formal reward');claim.click();
  await wait(()=>document.getElementById('dungeonPage')?.classList.contains('active')&&!document.getElementById('v132RewardModal')?.classList.contains('show'));
  // Material claim uses the existing alert; acknowledge it using the formal dialog.
  const alert=document.getElementById('v169RpgDialogLayer');if(alert?.classList.contains('show'))document.querySelectorAll('#v169RpgDialogLayer .v169-rpg-dialog-button')[1].click();
  autoConfig.enabled=false;autoBattle=false;
  const reward={gold:gold-beforeClaim.gold,exp:sharedExp-beforeClaim.exp,material:inventoryItems.filter(x=>x.id==='materialChest').reduce((s,x)=>s+(x.count||1),0)-beforeClaim.material,inventory:inventoryItems.filter(x=>/materialChest/.test(x.id)).map(x=>({id:x.id,count:x.count}))};
  if(type==='gold')check(reward.gold===v148GetGoldDungeonReward(level),'Gold amount');if(type==='exp')check(reward.exp>0,'EXP reward');if(type==='material')check(reward.material===3,'Material reward');
  evidence.encounters.push({type,level,size,automatic,initial,waves:encountered,snapshots,reward,partyHp:getExistingPartyIndexes().map(i=>getPartyCharacterByIndex(i).hp)});
  check(!window.v132ActiveDungeonRun,'run cleanup');
 }
 try{
  await scene('exp',50,3,false);await scene('material',50,3,false);await scene('gold',50,3,true);
  await scene('exp',50,3,false);
  if(innerWidth===412)await scene('gold',10,1,false);
  check(evidence.floatingFeedback.some(x=>x.width>0&&x.height>0),'visible natural floating feedback');
  return evidence;
 }finally{feedbackObserver.disconnect();Math.random=oldRandom;autoConfig.enabled=false;autoBattle=false;}
})()
`;
const liveBase=process.env.DAILY_BALANCE_BASE_URL;
if(liveBase){
 const manifest=await fetch(new URL('release-manifest.json',liveBase+'/')).then(r=>{assert.equal(r.ok,true,'deployed manifest');return r.json();});
 assert.equal(manifest.commitSha,process.env.EXPECTED_COMMIT_SHA,'Daily live exact SHA');
}
const server=await startServer({baseUrl:liveBase}),chrome=findChrome();
const artifact=path.join(ROOT,'artifacts/browser-qa/daily-balance.json');fs.mkdirSync(path.dirname(artifact),{recursive:true});let client,proc,profile;const results=[];
function closeViewport(){
 client?.close();client=null;proc?.kill('SIGTERM');proc=null;
 if(profile){try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}profile=null;}
}
try{
 for(const [width,height] of [[412,915],[390,844]]){
  // Match the existing Skill Runtime QA: diagnostics write local candidates,
  // so each independent viewport needs its own process and fresh profile.
  // Formal reload conflict protection remains unchanged.
  profile=fs.mkdtempSync(path.join(os.tmpdir(),'daily-balance-'));
  const port=9900+Math.floor(Math.random()*100);
  proc=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
  const tabs=await waitJson('http://127.0.0.1:'+port+'/json/list');client=new Cdp(tabs.find(x=>x.type==='page').webSocketDebuggerUrl);await client.send('Page.enable');await client.send('Runtime.enable');
  await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await client.send('Page.navigate',{url:server.url});
  await new Promise(r=>setTimeout(r,1000));const active=client.eval(fixture+'\n'+expression);let done=false;active.finally(()=>{done=true;}).catch(()=>{});let captured=new Set();while(!done){await new Promise(r=>setTimeout(r,120));const marker=await client.eval('window.dailyBalanceQaCapture||null').catch(()=>null);if(marker){const key=marker.type+'-'+marker.wave+'-'+marker.size;if(!captured.has(key)){captured.add(key);const shot=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(artifact.replace('.json','-'+width+'x'+height+'-'+key+'.png'),Buffer.from(shot.data,'base64'));}}}const result=await active;results.push({width,height,...result,captures:[...captured]});
  assert.equal(client.events.some(e=>e.method==='Runtime.consoleAPICalled'&&e.params.type==='error'&&JSON.stringify(e.params.args).includes('戰鬥行動超過安全期限')),false,'natural actions must finish without watchdog recovery');
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
 assert.equal(results[0].encounters.length,5);fs.writeFileSync(artifact,JSON.stringify({passed:true,commitSha:process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||'local',results},null,2)+'\n');console.log('Daily balance natural production waves, TTK, manual/auto, rewards, re-entry and beginner: PASS');
}catch(error){const partial=await client?.eval('({evidence:window.dailyBalanceQaEvidence,startupState:window.FourSymbolsStartupPolicy?.getState?.(),startupUid:window.FourSymbolsStartupPolicy?.getUid?.(),turn,battleActive,battlePhase,autoBattle,currentZone,inventory:inventoryItems,reward:document.getElementById("v132RewardModal")?.innerHTML,dialog:document.getElementById("v169RpgDialogMessage")?.textContent})').catch(()=>null);fs.writeFileSync(artifact,JSON.stringify({passed:false,error:String(error.stack||error),results,partial,console:client?.events.filter(e=>e.method==='Runtime.consoleAPICalled').slice(-15)},null,2)+'\n');throw error;}
finally{closeViewport();await new Promise(r=>server.server.close(r));}
