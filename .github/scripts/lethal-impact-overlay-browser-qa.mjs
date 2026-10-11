/* Targeted 360x800 lethal presentation acceptance. Read-only isolated account;
   fixture HP/damage and red slash all-target override, real production owners.
   No complete Boss battle, gameplay formula override or external save write. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {startServer,findChrome} from './runtime-browser-qa-support.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.QA_PLAYWRIGHT_MODULE||'playwright');
const dir=path.resolve(process.env.IMPACT_QA_ARTIFACT_DIR||'artifacts/browser-qa/lethal-impact');
fs.mkdirSync(dir,{recursive:true});
const {server,url}=await startServer();
const browser=await chromium.launch({executablePath:findChrome(),args:['--no-sandbox','--disable-dev-shm-usage']});
const evidence={viewport:{width:360,height:800},disclosure:'Isolated read-only Firebase transport. Warm authored VFX; fixture HP=1/100 and direct damage=1; formal settleBattleHpDamage/showHit/killMonster/checkBattleEnd and V143 timing/geometry/art/HUD. Red flameSlash targetType=all and wild portrait selection are test-only; no original damage formula, cold-start acceptance or complete Boss fight claimed. Six visual scenes play naturally. Separate cleanup fixtures pause the overlay and synthesize hidden/pagehide events.',scenes:[],lifecycle:[]};
const cases=[
 {label:'single-lethal',id:'flameSlash',count:3,lethal:[0]},
 {label:'red-slash-mixed-test-all',id:'flameSlash',count:3,lethal:[0,2],override:'all'},
 {label:'blue-ice-mixed',id:'iceArrowRain',count:3,lethal:[0,2]},
 {label:'player-lethal',id:'iceArrowRain',count:3,lethal:[0],side:'player'},
 {label:'boss-multi-slot-lethal',id:'iceArrowRain',count:1,lethal:[0],boss:true},
 {label:'last-enemy-batch',id:'iceArrowRain',count:3,lethal:[0,1,2],terminal:true}
];
try{
 for(const scenario of cases){
  if(process.env.IMPACT_QA_SCENE&&process.env.IMPACT_QA_SCENE!==scenario.label){ continue; }
  console.log('START '+scenario.label);
  const page=await browser.newPage({viewport:evidence.viewport});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(()=>window.FourSymbolsStartupPolicy?.getState?.()==='READY');
  await page.getByRole('button',{name:'直接進入'}).click().catch(()=>{});
  await page.waitForFunction(()=>!document.getElementById('firebaseAuthOverlay')?.classList.contains('show')&&document.getElementById('startupLoader')?.hidden===true);
  await page.evaluate(async()=>{await FourSymbolsFeatures.ensure('boss-tower','lethal-impact-qa');closeHomeFeature();});
  await page.evaluate(fs.readFileSync('tests/fixtures/wild-balance-reference-party.js','utf8'));
  await page.evaluate(s=>{
   prepareWildBalanceReferenceParty(70,3);
   monsters=Array.from({length:s.count},(_,i)=>configureBuiltMonster(MonsterBalance.build({monsterKey:'qa.'+i,name:'致死驗收'+i,level:40,element:['fire','water','wind'][i%3],archetype:'balanced',rank:'regular',mode:'wild',context:'wild/qa'})));
   monsters.forEach(m=>{m.noRewards=true;});currentZone='forest';mapCooldown=false;startBattle(0);
   autoBattle=false;autoPatrolEnabled=false;
  },scenario);
  await page.waitForFunction(()=>!document.getElementById('battlePage')?.matches('.v141-preparing-entry,.v141-entry-moving'));
  if(!scenario.boss)await page.evaluate(()=>{currentBattleMonsters=monsters.map((_,i)=>i);FourSymbolsBattlefieldSlots.setActiveEnemySnapshot(null);renderBattle();});
  if(scenario.boss){
   await page.evaluate(()=>{v142SkillAnimationDirector.dispose();v132AbortDungeonBattle('qa-stop');battleActive=false;if(!vGameplayStartBoss('personal','personal-70'))throw Error('Boss minimal fixture failed');});
   await page.waitForFunction(()=>FourSymbolsBossBattle.isActive()&&!document.getElementById('battlePage')?.matches('.v141-preparing-entry,.v141-entry-moving'));
  }
  await page.evaluate(()=>{
   clearInterval(timerId);timerId=null;
   currentBattleMonsters.forEach(i=>{
    const m=monsters[i];m.noRewards=true;
    // Formal artwork projection with explicit test portrait selection for wild fixtures.
    if(!m.vGameplayBoss)m.vGameplayPortrait='assets/monsters/wild/zone-10/fire-01.webp';
    FourSymbolsBattlePresentation.applyUnit(document.getElementById('battleMonster'+i),'monster');
   });FourSymbolsBattlefieldRenderGeometry.reconcile();
  });
  // Warm the same authored VFX once with no damage or action progression.
  // Acceptance below uses unchanged timings; this is not cold-start acceptance.
  await page.evaluate(s=>{
   const side=s.side||'monster',skill=skillDatabase[s.id],type=s.override||skill.targetType;
   const ids=side==='monster'?currentBattleMonsters:getExistingPartyIndexes();
   const targets=type==='single'?[ids[0]]:ids;
   if(side==='monster')showSkillNameBadge(skill.name,skill.element,0,targets[0],targets,side,type);
   else showMonsterSkillNameBadge(skill.name,skill.element,0,targets[0],targets,side,type);
  },scenario);
  await page.waitForFunction(()=>!v143SkillAnimationState.current);
  const session=await page.context().newCDPSession(page);
  const frames=[];
  session.on('Page.screencastFrame',event=>{frames.push({timestamp:event.metadata.timestamp*1000,data:event.data});session.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});});
  await session.send('Page.startScreencast',{format:'jpeg',quality:80,everyNthFrame:1,maxWidth:360,maxHeight:800});
  const info=await page.evaluate(s=>{
   v142SkillAnimationDirector.dispose();
   const side=s.side||'monster',skill=skillDatabase[s.id],type=s.override||skill.targetType;
   const available=side==='monster'?currentBattleMonsters.filter(i=>monsters[i].alive&&monsters[i].hp>0):getExistingPartyIndexes();
   const targets=type==='single'?[available[0]]:available;
   const entity=i=>side==='monster'?monsters[i]:getPartyCharacterByIndex(i);
   targets.forEach((i,pos)=>{entity(i).hp=s.lethal.includes(pos)?1:100;});
   if(side==='player')updateBattlePlayerBars();else currentBattleMonsters.forEach(i=>updateMonsterUI(i));
   if(side==='monster')showSkillNameBadge(skill.name,skill.element,0,targets[0],targets,side,type);
   else showMonsterSkillNameBadge(skill.name,skill.element,0,targets[0],targets,side,type);
   const gate=v142SkillAnimationDirector.getLatest();
   window.__qaGate=gate;window.__qaSamples=[];window.__qaHit=false;window.__qaObserved=null;
   window.__qaBattleEndAt=null;FourSymbolsCombatEvents.subscribe('battle_end',()=>{window.__qaBattleEndAt=Date.now();});
   const before={duration:gate.config.duration,deadline:gate.deadline};
   targets.forEach(i=>{
    settleBattleHpDamage(entity(i),1,{sourceType:'activeSkill',damageKind:'direct',attacker:side==='monster'?player:monsters[0]});
    if(side==='monster'){showMonsterHit(i,1,'hp');if(entity(i).hp<=0)killMonster(i);}
    else{showPlayerHit(1,'hp',i,false);updateBattlePlayerBars();}
   });
   const hpImmediately=targets.map(i=>({index:i,hp:entity(i).hp,alive:entity(i).alive}));
   let ended=false;if(s.terminal||s.boss)ended=checkBattleEnd();
   const settled={at:Date.now(),hpImmediately,ended,battleActive,token:battleToken};
   v143RunAtTargetHit(side,targets.at(-1),()=>{

    window.__qaHit=true;window.__qaHitAt=Date.now();
    window.__qaHitDebug={reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,epoch:v143SkillAnimationState.impactEpoch,token:battleToken,hits:[...v143SkillAnimationState.current?.impactHits?.values()||[]].map(h=>({index:h.index,epoch:h.epoch,token:h.battleToken,lethal:h.lethal,scheduled:h.scheduled,presented:h.presented,artConnected:h.artwork.isConnected,projection:h.projection})),count:v143SkillAnimationState.impactFlashes.size};
    const sample=()=>{
     const entries=[...v143SkillAnimationState.impactFlashes.values()];
     if(!window.__qaObserved&&entries.length===targets.length){
    window.__qaObserved=(()=>{
   const z=n=>n?Number(getComputedStyle(n).zIndex):null;
   const entries=[...v143SkillAnimationState.impactFlashes.values()];
   return {count:entries.length,lethal:entries.filter(e=>e.hit?.lethal).map(e=>e.index),durations:entries.map(e=>e.animation.effect.getTiming().duration),pointer:entries.map(e=>getComputedStyle(e.node).pointerEvents),vfxRunning:[...document.querySelectorAll('.v143-vfx-sprite')].some(n=>n.getAnimations().some(a=>a.playState==='running')&&getComputedStyle(n).visibility==='visible'),layers:{vfx:z(v143SkillAnimationState.stage),hit:z(v143SkillAnimationState.hitOverlay),hud:z(document.querySelector('.v174-battle-hud-layer')),name:z(document.querySelector('body > .skill-name-badge'))},floatZ:[...document.querySelectorAll('.battle-floating-feedback')].map(z),gateDuration:__qaGate.config.duration,gateDeadline:__qaGate.deadline,battleActive};
    })();
     }
     __qaSamples.push({at:Date.now(),times:entries.map(e=>e.animation.currentTime),opacities:entries.map(e=>getComputedStyle(e.node).opacity),vfx:[...document.querySelectorAll('.v143-vfx-sprite')].some(n=>getComputedStyle(n).visibility==='visible'&&+getComputedStyle(n).opacity>0),running:entries.every(e=>e.animation.playState==='running')});
     if(entries.length)requestAnimationFrame(sample);
    };requestAnimationFrame(sample);
   },true);
   return {id:s.id,side,targets,before,settled,debug:{epoch:v143SkillAnimationState.impactEpoch,targets:[...v143SkillAnimationState.current?.impactTargets?.keys()||[]],hits:[...v143SkillAnimationState.current?.impactHits?.values()||[]].map(h=>({index:h.index,epoch:h.epoch,token:h.battleToken,lethal:h.lethal,scheduled:h.scheduled,presented:h.presented}))},bossFootprint:s.boss?document.querySelector('.v-fixed-boss-footprint')?.dataset.slots:null};
  },scenario);
  try{await page.waitForFunction(()=>__qaHit&&[...v143SkillAnimationState.impactFlashes.values()].some(e=>e.animation.currentTime<70),{},{polling:'raf',timeout:10000});}
  catch(error){console.log(JSON.stringify(info));console.log(JSON.stringify(await page.evaluate(()=>({hit:__qaHit,debug:__qaHitDebug,samples:__qaSamples,state:{epoch:v143SkillAnimationState.impactEpoch,metrics:v143SkillAnimationState.metrics}}))));console.log(errors);throw error;}
  await page.waitForFunction(()=>v143SkillAnimationState.impactFlashes.size===0);
  const observed=await page.evaluate(()=>__qaObserved);
  assert.equal(observed.count,info.targets.length,scenario.label+' all direct targets');
  assert.equal(observed.lethal.length,scenario.lethal.length);
  assert.ok(observed.vfxRunning,'VFX actually playing at lethal flash');
  assert.ok(observed.durations.every(n=>n===200)&&observed.pointer.every(n=>n==='none'));
  assert.deepEqual([observed.layers.vfx,observed.layers.hit,observed.layers.hud],[16000,16010,16015]);
  assert.ok(observed.floatZ.every(n=>n>16010));
  assert.equal(observed.gateDuration,info.before.duration);
  if(scenario.boss)assert.ok(info.bossFootprint?.split(' ').length>1,'formal multi-slot Boss footprint');
  await page.waitForFunction(()=>v143SkillAnimationState.impactFlashes.size===0);
  await session.send('Page.stopScreencast');
  const recordedFrames=frames.slice();
  const frameDir=fs.mkdtempSync(path.join(dir,scenario.label+'-frames-'));
  recordedFrames.forEach((frame,i)=>fs.writeFileSync(path.join(frameDir,String(i).padStart(3,'0')+'.jpg'),Buffer.from(frame.data,'base64')));
  const samples=await page.evaluate(()=>__qaSamples);
  fs.writeFileSync(path.join(dir,scenario.label+'-observation.json'),JSON.stringify({info,observed,samples,frames:recordedFrames.map(f=>f.timestamp)},null,2));
  const bases=samples.filter(s=>s.times.length&&Number.isFinite(s.times[0])).map(s=>s.at-s.times[0]).sort((a,b)=>a-b);
  const hitAt=bases[Math.floor(bases.length/2)];
  const screenshots=[];
  // Approximate temporal samples; raw compositor frames must also be inspected.
  // Multiple target callbacks may paint in different frames on a busy device.
  for(const [phase,low,high] of [['first',0,80],['gap',80,120],['second',120,200]]){
   const frame=recordedFrames.filter(f=>f.timestamp-hitAt>=low+5&&f.timestamp-hitAt<high).sort((a,b)=>Math.abs(a.timestamp-hitAt-(low+high)/2)-Math.abs(b.timestamp-hitAt-(low+high)/2))[0];
   assert.ok(frame,scenario.label+' compositor frame for '+phase+'; '+JSON.stringify(recordedFrames.map(f=>f.timestamp-hitAt)));
   const filename=scenario.label+'-'+phase+'.jpg';screenshots.push(filename);
   fs.writeFileSync(path.join(dir,filename),Buffer.from(frame.data,'base64'));
  }
  assert.ok(samples.some(s=>s.running&&s.opacities.includes('1')&&s.times.some(t=>t<80)&&s.vfx));
  assert.ok(samples.some(s=>s.opacities.includes('0')&&s.times.some(t=>t>=80&&t<120)));
  assert.ok(samples.some(s=>s.running&&s.opacities.includes('1')&&s.times.some(t=>t>=120)&&s.vfx));
  let terminal=null;
  if(scenario.terminal||scenario.boss){
   assert.equal(info.settled.ended,true);
   await page.waitForFunction(()=>__qaBattleEndAt!==null||!battleActive,{},{timeout:6000});
   terminal=await page.evaluate(()=>({battleActive,endAt:__qaBattleEndAt,impactCount:v143SkillAnimationState.impactFlashes.size,pageActive:document.getElementById('battlePage').classList.contains('active')}));
   assert.equal(terminal.battleActive,false);
  }
  assert.equal(errors.length,0,errors.join('\n'));
  evidence.scenes.push({scenario,info,observed,samples,screenshots,frameDirectory:path.basename(frameDir),terminal,compositorTimes:recordedFrames.map(f=>f.timestamp-hitAt)});
  fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(evidence,null,2));
  console.log('PASS '+scenario.label+' natural 80/40/80 while VFX running');
  if(scenario.label==='single-lethal'){
   for(const reason of ['post-death-feedback','dispose','supersede','hidden','navigation','new-battle','pagehide','unloaded']){
    await page.evaluate(()=>{
     v142SkillAnimationDirector.dispose();monsters.forEach(m=>{m.hp=100;m.alive=true;});
     battleActive=true;showPage('battle');renderBattle();
     const i=currentBattleMonsters[0],skill=skillDatabase.flameSlash;
     monsters[i].hp=1;showSkillNameBadge(skill.name,skill.element,0,i,[i],'monster','single');
     settleBattleHpDamage(monsters[i],1,{sourceType:'activeSkill',damageKind:'direct',attacker:player});showMonsterHit(i,1,'hp');killMonster(i);
     window.__qaCleanupReady=false;
     v143RunAtTargetHit('monster',i,()=>{v143SkillAnimationState.impactFlashes.forEach(e=>e.animation.pause());window.__qaCleanupReady=true;},true);
    });
    await page.waitForFunction(()=>__qaCleanupReady&&v143SkillAnimationState.impactFlashes.size===1);
    if(reason==='post-death-feedback'){
     const point=await page.evaluate(()=>{
      const entry=[...v143SkillAnimationState.impactFlashes.values()][0],r=entry.node.getBoundingClientRect();
      window.__qaPointerReached=false;
      document.addEventListener('pointerdown',event=>{window.__qaPointerReached=!event.target.closest('.v143-hit-feedback-overlay,#v143-skill-stage');},{once:true});
      return {x:r.left+r.width/2,y:r.top+r.height/2};
     });
     await page.mouse.click(point.x,point.y);
     assert.equal(await page.evaluate(()=>__qaPointerReached),true,'real pointer dispatch passes through presentation planes');
    }
    const result=await page.evaluate(reason=>{
     const state=v143SkillAnimationState,old=[...state.impactFlashes.values()][0],oldFinish=old.animation.onfinish;
     let sameCommittedHit=null;
     if(reason==='post-death-feedback'){
      settleBattleHpDamage(monsters[old.index],1,{sourceType:'activeSkill',damageKind:'direct',attacker:player});showMonsterHit(old.index,1,'hp');
      sameCommittedHit=state.impactFlashes.get(old.hit.artwork)===old;v142SkillAnimationDirector.dispose();
     }else if(reason==='supersede'){
      const skill=skillDatabase.iceArrowRain;showSkillNameBadge(skill.name,skill.element,0,currentBattleMonsters[1],[currentBattleMonsters[1]],'monster','all');
     }else if(reason==='hidden'){
      Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;
     }else if(reason==='navigation'){battleActive=false;showPage('map');}
     else if(reason==='new-battle'){battleActive=false;mapCooldown=false;monsters[0].hp=100;monsters[0].alive=true;startBattle(0);clearInterval(timerId);timerId=null;}
     else if(reason==='pagehide'){window.dispatchEvent(new Event('pagehide'));}
     else if(reason==='unloaded'){document.getElementById('battlePage').remove();FourSymbolsBattlefieldRenderGeometry.reconcile();}
     else v142SkillAnimationDirector.dispose();
     oldFinish();
     return {reason,sameCommittedHit,impactCount:state.impactFlashes.size,rootGone:!document.querySelector('.v143-hit-feedback-overlay'),hudGone:!document.querySelector('.v174-battle-hud-layer'),oldRemoved:!old.node.isConnected};
    },reason);
    assert.equal(result.impactCount,0);assert.ok(result.rootGone&&result.hudGone&&result.oldRemoved,reason+' fully clears');
    if(reason==='post-death-feedback')assert.equal(result.sameCommittedHit,true);
    evidence.lifecycle.push(result);console.log('PASS lifecycle '+reason);
    if(reason==='new-battle')await page.waitForFunction(()=>!document.getElementById('battlePage').matches('.v141-preparing-entry,.v141-entry-moving'));
   }
   fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(evidence,null,2));
  }
  await page.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
