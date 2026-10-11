/* Targeted presentation acceptance only: isolated account transport, real full
   production bundles, no Boss rounds/rewards or external account writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {startServer,findChrome} from './runtime-browser-qa-support.mjs';
const require=createRequire(import.meta.url);
let playwright;
try{playwright=require('playwright');}catch{playwright=require('/opt/codex/runtimes/cua/lib/node_modules/playwright');}
const artifactDir=process.env.IMPACT_QA_ARTIFACT_DIR||'/tmp/direct-impact-overlay-qa';
fs.mkdirSync(artifactDir,{recursive:true});
const {server,url}=await startServer({baseUrl:process.env.IMPACT_QA_BASE_URL||undefined});
const browser=await playwright.chromium.launch({executablePath:findChrome(),args:['--no-sandbox','--disable-dev-shm-usage']});
const evidence={viewport:{width:360,height:800},scenes:[],lifecycle:[],exclusions:[]};
try{
 const page=await browser.newPage({viewport:evidence.viewport});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);
 await page.waitForFunction(()=>window.FourSymbolsStartupPolicy?.getState?.()==='READY');
 await page.getByRole('button',{name:'直接進入'}).click().catch(()=>{});
 await page.waitForFunction(()=>!document.getElementById('firebaseAuthOverlay')?.classList.contains('show')&&document.getElementById('startupLoader')?.hidden===true);
 await page.evaluate(async()=>{await FourSymbolsFeatures.ensure('boss-tower','direct-impact-overlay-qa');closeHomeFeature();});
 await page.evaluate(fs.readFileSync('tests/fixtures/wild-balance-reference-party.js','utf8'));
 await page.evaluate(()=>{
  prepareWildBalanceReferenceParty(70,3);
  monsters=['fire','water','wind'].map((element,i)=>configureBuiltMonster(MonsterBalance.build({monsterKey:'qa.'+i,name:'QA巡怪'+i,level:40,element,archetype:'balanced',rank:'regular',mode:'wild',context:'wild/qa'})));
  currentZone='forest';mapCooldown=false;startBattle(0);
  autoBattle=false;autoPatrolEnabled=false;
 });
 await page.waitForFunction(()=>!document.getElementById('battlePage')?.matches('.v141-preparing-entry,.v141-entry-moving'));
 await page.evaluate(()=>{clearInterval(timerId);timerId=null;});
 const scene=async(count,boss=false)=>{
  await page.evaluate(({count,boss})=>{
   v142SkillAnimationDirector.dispose();
   if(boss){
    if(battleActive){v132AbortDungeonBattle('qa-stop');battleActive=false;}
    const started=vGameplayStartBoss('personal','personal-70');if(!started)throw Error('Boss fixture launch failed');
   }else{
    monsters=Array.from({length:count},(_,i)=>configureBuiltMonster(MonsterBalance.build({monsterKey:'qa.'+i,name:'QA巡怪'+i,level:40,element:['fire','water','wind'][i%3],archetype:'balanced',rank:'regular',mode:'wild',context:'wild/qa'})));
    currentBattleMonsters=monsters.map((_,i)=>i);
    FourSymbolsBattlefieldSlots.setActiveEnemySnapshot(null);
    battleActive=true;renderBattle();
   }
  },{count,boss});
  if(boss){await page.waitForFunction(()=>FourSymbolsBossBattle.isActive()&&!document.getElementById('battlePage')?.matches('.v141-preparing-entry,.v141-entry-moving'));}
  await page.evaluate(()=>{
   clearInterval(timerId);timerId=null;
   const path='assets/monsters/wild/zone-10/fire-01.webp';
   // Test-only asset selection through the formal artwork owner, not cloned DOM.
   currentBattleMonsters.forEach(i=>{monsters[i].vGameplayPortrait=monsters[i].vGameplayBoss?'assets/monsters/boss/boss-placeholder-fire-demon.webp':path;FourSymbolsBattlePresentation.applyUnit(document.getElementById('battleMonster'+i),'monster');});
   FourSymbolsBattlefieldRenderGeometry.reconcile();
  });
  await page.waitForFunction(()=>[...document.querySelectorAll('.v174-battle-art')].every(a=>a.getBoundingClientRect().width>0));
 };
 const cast=async(id,side='monster',override=null)=>{
  return page.evaluate(({id,side,override})=>{
   v142SkillAnimationDirector.dispose();
   const ids=side==='monster'?currentBattleMonsters.filter(i=>monsters[i].alive!==false&&monsters[i].hp>0):getExistingPartyIndexes().filter(i=>getPartyCharacterByIndex(i).hp>0);
   const skill=id==='normal'?{id:'normal',name:'普通攻擊',element:'fire',targetType:'single'}:skillDatabase[id];
   const type=override||skill.targetType;
   const targets=type==='single'?[ids[0]]:ids;
   const contract={version:'battle-target-contract-v1',side:side==='monster'?'player':'monster',actorIndex:0,targetSide:side,targetType:type,targetId:targets[0],targetIds:targets};
   showSkillNameBadge(skill.name,skill.element,0,targets[0],targets,side,type);
   // Skill names may start the cast; use the formal config/director as needed.
   const config={...skill,id,duration:id==='normal'?520:skill.animationDuration,resolveDuration:id==='normal'?520:skill.resolveDuration,targetType:type};
   const gate=v142SkillAnimationDirector.play(config,{side:contract.side,actorIndex:0,targetSide:side,targetId:targets[0],targetIds:targets,targetContract:contract,key:'overlay-qa-'+id+'-'+side});
   window.__impactGate=gate;
   window.__impactQaReady=false;
   targets.forEach(i=>{
    const target=side==='monster'?monsters[i]:getPartyCharacterByIndex(i);
    // Real settlement facts select direct feedback; amounts/HP are fixture-only.
    settleBattleHpDamage(target,1,{sourceType:'activeSkill',damageKind:'direct',attacker:side==='monster'?player:monsters[0]});
    if(side==='monster'){showMonsterHit(i,1,'hp');}else{showPlayerHit(1,'hp',i,false);}
   });
   v143RunAtTargetHit(side,targets.at(-1),()=>{
    for(const [art,entry] of v143SkillAnimationState.impactFlashes){
        entry.animation.pause();entry.animation.currentTime=40;
        art.v143ImpactRecoil?.pause();if(art.v143ImpactRecoil){art.v143ImpactRecoil.currentTime=0;}
    }
    for(const node of document.querySelectorAll('.v143-vfx-sprite')){node.getAnimations().forEach(a=>a.pause());}
    window.__impactQaReady=true;
   },true);
   return {id,side,targets,duration:gate.config.duration,deadline:gate.deadline,override};
  },{id,side,override});
 };
 const capture=async(label,castInfo)=>{
  await page.waitForFunction(()=>window.__impactQaReady,{timeout:10000});

  const observed=await page.evaluate(()=>{
   const state=v143SkillAnimationState;
   const root=state.hitOverlay,stage=state.stage,hud=document.querySelector('.v174-battle-hud-layer');
   const z=n=>Number(getComputedStyle(n).zIndex);
   const flashes=[...state.impactFlashes.values()].map(e=>{
    const g=FourSymbolsBattlefieldRenderGeometry.getUnitGeometry(e.side,e.index),r=e.node.getBoundingClientRect(),p=g.artworkProjection.rect;
    return {side:e.side,index:e.index,opacity:getComputedStyle(e.node).opacity,pointer:getComputedStyle(e.node).pointerEvents,rectMatch:['left','top','width','height'].every(k=>Math.abs(r[k]-p[k])<.2),duration:e.animation.effect.getTiming().duration,frames:e.animation.effect.getKeyframes().map(f=>({offset:f.offset,opacity:f.opacity}))};
   });
   const hudTests=[...document.querySelectorAll('.v174-unit-hud')].filter(h=>h.closest('.v174-battle-hud-layer')).map(h=>{
    const hp=h.querySelector('.hp-bar,.monster-hp'),sp=h.querySelector('.sp-bar,.monster-sp'),name=h.querySelector('.battle-player-id,.battle-monster-name'),status=h.querySelector('.monster-status-badges');
    const g=FourSymbolsBattlefieldRenderGeometry.getUnitGeometry(h.dataset.side,Number(h.dataset.index));
    return {side:h.dataset.side,index:h.dataset.index,hp:hp?.getBoundingClientRect().height,sp:sp?.getBoundingClientRect().height,name:!!name,statusLineHeight:parseFloat(getComputedStyle(status).lineHeight),hpAboveSp:hp.getBoundingClientRect().bottom<=sp.getBoundingClientRect().top+.2,sameNode:hp===FourSymbolsBattlePresentation.getUnitHud(h.v174Card).querySelector('.hp-bar,.monster-hp'),unitRectMatch:Math.abs(h.getBoundingClientRect().left-g.hudSurface.rect.left)<.2};
   });
   const sprite=[...stage.querySelectorAll('.v143-vfx-sprite')].map(n=>({opacity:getComputedStyle(n).opacity,visibility:getComputedStyle(n).visibility,src:getComputedStyle(n).backgroundImage}));
   const numbers=[...document.querySelectorAll('.battle-floating-feedback')].map(n=>({z:z(n),text:n.textContent}));
   const name=document.querySelector('body > .skill-name-badge');
   return {count:flashes.length,flashes,hudTests,sprite,numbers,layers:{vfx:z(stage),hit:z(root),hud:z(hud),name:name?z(name):16020},rootPointer:getComputedStyle(root).pointerEvents,gateDuration:__impactGate.config.duration,gateDeadline:__impactGate.deadline};
  });
  assert.equal(observed.count,castInfo.targets.length,label+' all valid targets flash');
  assert.ok(observed.flashes.every(f=>f.opacity==='1'&&f.pointer==='none'&&f.rectMatch&&f.duration===200),label+' exact target artwork and 200ms transparent-input white pulse');
  assert.ok(observed.layers.vfx<observed.layers.hit&&observed.layers.hit<observed.layers.hud&&observed.layers.hud<observed.layers.name);
  assert.ok(observed.numbers.length&&observed.numbers.every(n=>n.z>observed.layers.hit),'floating numbers above hit');
  assert.equal(observed.rootPointer,'none');
  assert.ok(observed.hudTests.every(h=>h.hp>0&&h.sp>0&&h.name&&h.statusLineHeight===(h.side==='monster'?14:12)&&h.hpAboveSp&&h.sameNode&&h.unitRectMatch),'real HUD nodes and geometry remain correct');
  assert.ok(observed.sprite.some(s=>s.visibility==='visible'&&Number(s.opacity)>0),'authored skill VFX still visibly paints');
  assert.equal(observed.gateDuration,castInfo.duration);
  await page.screenshot({path:artifactDir+'/'+label+'.png'});
  // Both pulses and the original-color gap are sampled in the real browser.
  const phases=await page.evaluate(()=>{
   const entry=[...v143SkillAnimationState.impactFlashes.values()][0];
   return [40,100,160].map(t=>{entry.animation.currentTime=t;return getComputedStyle(entry.node).opacity;});
  });
  assert.deepEqual(phases,['1','0','1']);
  evidence.scenes.push({label,castInfo,observed,phases});
 };
 await scene(3);
 await capture('single-direct',await cast('flameSlash'));
 await capture('red-slash-all-contract-3',await cast('flameSlash','monster','all'));
 await capture('blue-ice-all-3',await cast('iceArrowRain'));
 // Real pointer dispatch reaches the underlying official unit through both
 // presentation planes; reading retains the identical HUD node and no replay.
 const interaction=await page.evaluate(()=>{
  const card=document.getElementById('battleMonster'+currentBattleMonsters[0]);
  const hud=FourSymbolsBattlePresentation.getUnitHud(card);
  const art=card.querySelector('.v174-battle-art'),r=art.getBoundingClientRect();
  window.__impactPointerReached=false;
  card.addEventListener('pointerdown',()=>{window.__impactPointerReached=true;},{once:true});
  const x=r.left+r.width/2,y=r.top+r.height/2;
  const receiver=document.elementFromPoint(x,y);
  window.__impactReadingHud=hud;window.__impactReadingCard=card;
  return {x,y,targetBelowPlanes:receiver===card||card.contains(receiver)};
 });
 assert.equal(interaction.targetBelowPlanes,true);
 await page.mouse.click(interaction.x,interaction.y);
 assert.equal(await page.evaluate(()=>window.__impactPointerReached),true);
 const reading=await page.evaluate(()=>{
  closeBattleStatusDetailModal();
  setBattleInfoExpanded(true);
  const original=window.__impactReadingHud,card=window.__impactReadingCard;
  const open={sameNode:original===FourSymbolsBattlePresentation.getUnitHud(card),returned:card.contains(original),hitHidden:getComputedStyle(v143SkillAnimationState.hitOverlay).visibility==='hidden',bodyLayerGone:!document.querySelector('.v174-battle-hud-layer')};
  setBattleInfoExpanded(false);
  return {open,restoredSameNode:original===FourSymbolsBattlePresentation.getUnitHud(card),restoredPlane:!!original.closest('.v174-battle-hud-layer')};
 });
 assert.ok(Object.values(reading.open).every(Boolean));
 assert.ok(reading.restoredSameNode&&reading.restoredPlane);
 evidence.interaction={...interaction,reading};

 await scene(6);
 await capture('blue-ice-all-6',await cast('iceArrowRain'));
 await capture('large-fire-all-6',await cast('phoenixCry'));
 await capture('friendly-hit-all',await cast('iceArrowRain','player'));
 await scene(1,true);
 await capture('boss-footprint-all',await cast('iceArrowRain'));
 // Start each exclusion on an active direct cast, including DOT settlement
 // while VFX remains active. No category-only test can hide a DOT false positive.
 for(const kind of ['heal','sp','shield','miss','status','dot']){
  const result=await page.evaluate(async kind=>{
   v142SkillAnimationDirector.dispose();
   const index=currentBattleMonsters[0],skill=skillDatabase.iceArrowRain;
   v142SkillAnimationDirector.play({...skill,id:'iceArrowRain',duration:skill.animationDuration,resolveDuration:skill.resolveDuration},{side:'player',actorIndex:0,targetSide:'monster',targetId:index,targetIds:[index],key:'exclude-'+kind});
   if(kind==='dot'){settleBattleHpDamage(monsters[index],1,{sourceType:'dot',damageKind:'dot'});showMonsterHit(index,1,'hp');}
   else{v143ResolveBattleFeedbackTiming('monster',index,kind,false);}
   await new Promise(resolve=>v143RunAtTargetHit('monster',index,resolve,true));
   return {kind,count:v143SkillAnimationState.impactFlashes.size};
  },kind);
  assert.equal(result.count,0);evidence.exclusions.push(result);
 }
 const life=async(reason)=>{
  const info=await cast('iceArrowRain');
  await page.waitForFunction(()=>__impactQaReady);
  const result=await page.evaluate(reason=>{
   const index=currentBattleMonsters[0],originalHud=FourSymbolsBattlePresentation.getUnitHud(document.getElementById('battleMonster'+index));
   if(reason==='dispose'){v142SkillAnimationDirector.dispose();}
   if(reason==='supersede'){v142SkillAnimationDirector.play({id:'normal',duration:520,resolveDuration:520,targetType:'single'},{side:'player',actorIndex:0,targetSide:'monster',targetId:index,targetIds:[index],key:'supersede'});}
   if(reason==='death'){monsters[index].hp=0;v143ClearImpactTarget('monster',index);}
   if(reason==='departure'){document.getElementById('battleMonster'+index).remove();v143SyncImpactOverlays();}
   if(reason==='navigation'){battleActive=false;showPage('home');}
   if(reason==='battle-end'){FourSymbolsCombatEvents.emit('battle_end',{});}
   return {reason,remaining:v143SkillAnimationState.impactFlashes.size,root:!!document.querySelector('.v143-hit-feedback-overlay'),hudIdentity:originalHud===FourSymbolsBattlePresentation.getUnitHud(document.getElementById('battleMonster'+index)),oldTargetPresent:!!document.querySelector('.v143-hit-feedback-art[data-index="'+index+'"]')};
  },reason);
  if(reason==='death'||reason==='departure'){assert.equal(result.oldTargetPresent,false);}else{assert.equal(result.remaining,0);assert.equal(result.root,false);}
  evidence.lifecycle.push(result);
  await page.evaluate(()=>{v142SkillAnimationDirector.dispose();battleActive=true;showPage('battle');currentBattleMonsters.forEach(i=>{monsters[i].hp=monsters[i].maxHP;monsters[i].alive=true;});renderBattle();});
 };
 for(const reason of ['dispose','supersede','death','departure','navigation','battle-end'])await life(reason);
 const earlyEnd=await page.evaluate(async()=>{
  const index=currentBattleMonsters[0],skill=skillDatabase.iceArrowRain;
  v142SkillAnimationDirector.dispose();
  v142SkillAnimationDirector.play({...skill,id:'iceArrowRain',duration:skill.animationDuration,resolveDuration:skill.resolveDuration},{side:'player',actorIndex:0,targetSide:'monster',targetId:index,targetIds:[index],key:'early-end'});
  settleBattleHpDamage(monsters[index],1,{sourceType:'activeSkill',damageKind:'direct'});showMonsterHit(index,1,'hp');
  battleActive=false;FourSymbolsCombatEvents.emit('battle_end',{});
  await new Promise(resolve=>v143RunAtTargetHit('monster',index,resolve,true));
  const result={reason:'battle-end-before-hit',remaining:v143SkillAnimationState.impactFlashes.size,root:!!document.querySelector('.v143-hit-feedback-overlay'),hudPlane:!!document.querySelector('.v174-battle-hud-layer')};
  battleActive=true;return result;
 });
 assert.equal(earlyEnd.remaining,0);assert.equal(earlyEnd.root,false);assert.equal(earlyEnd.hudPlane,false);evidence.lifecycle.push(earlyEnd);
 const idle=await page.evaluate(()=>{v142SkillAnimationDirector.dispose();return {noPlanes:!document.querySelector('.v143-hit-feedback-overlay,.v174-battle-hud-layer'),originalHudReturned:[...document.querySelectorAll('.battle-monster,.battle-player')].every(c=>!c.v174UnitHud||c.contains(c.v174UnitHud))};});
 assert.ok(idle.noPlanes&&idle.originalHudReturned);evidence.idle=idle;
 await page.screenshot({path:artifactDir+'/idle-original-hud.png'});
 assert.deepEqual(errors,[],'full-runtime page errors');
 fs.writeFileSync(artifactDir+'/evidence.json',JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({result:'PASS',viewport:evidence.viewport,scenes:evidence.scenes.map(s=>s.label),exclusions:evidence.exclusions,lifecycle:evidence.lifecycle,artifactDir},null,2));
}finally{await browser.close();server.close();}
