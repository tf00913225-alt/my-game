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
 await wait(()=>FourSymbolsStartupPolicy?.getState?.()==='READY'&&document.getElementById('startupLoader')?.hidden===true&&!document.getElementById('firebaseAuthOverlay')?.classList.contains('show'));
 await FourSymbolsFeatures.ensure('gameplay-core','abyss-balance-qa');await FourSymbolsFeatures.ensure('abyss','abyss-balance-qa');await FourSymbolsFeatures.ensure('feature-boss-relic','abyss-balance-qa');
 await wait(()=>FourSymbolsReleaseUpdate?.getState?.().availableReleaseVersion);closeHomeFeature();
 const evidence=window.abyssBalanceQaEvidence={matrix:[],scenes:[],skills:[],controls:[],portraitGaps:[],frequencies:[],controlRolls:[],controlStates:[],healing:[],portraitDecode:[]};
 const oldRandom=Math.random,enemySkillAiOwner=window.FourSymbolsEnemySkillAI;let hardControlDecision=null;
 // Inject the boundary draw at the formal AI decision, rather than counting
 // unrelated target/VFX draws before it. Keep the native legal pool and owner.
 window.FourSymbolsEnemySkillAI={...enemySkillAiOwner,chooseCategory(attacks,buffs,draw,...args){
  if(hardControlDecision){
   hardControlDecision=null;
   const index=attacks.findIndex(id=>Array.isArray(skillDatabase[id]?.petrifyChanceByLevel)&&skillDatabase[id].petrifyChanceByLevel.some(chance=>chance>0));check(index>=0,'final native emperor hard-control skill is legal and affordable');
   const category=enemySkillAiOwner.chooseCategory(attacks,buffs,.1,...args);check(category==='attack','native emperor attack category');
   const selectionDraw=(index+.5)/attacks.length;let select=true;
   Math.random=()=>{if(select){select=false;return selectionDraw;}return 0;};
   evidence.controlDecisionProbe={skillId:attacks[index],attacks:attacks.slice(),buffs:buffs.slice(),category,categoryDraw:.1,selectionDraw,round:turn};return category;
  }
  return enemySkillAiOwner.chooseCategory(attacks,buffs,draw,...args);
 }};
 Math.random=()=>.5;autoBattle=false;autoPatrolEnabled=false;
 const stats=m=>[m.v141Shield?.baseMaxHP??m.maxHP,m.maxSP,m.attack,m.magicAttack,m.v155RockWall?.originalDefense??m.defense,m.agility,m.rank,m.element];
 const verify=m=>{const p=MonsterBalance.debug(m);if(m.v155RockWall){const state=m.v155RockWall,percent=state.displayBuff.percent,level=Math.min(skillDatabase.rockWall.maxLevel, m.v141ForceSkillLevel||m.v141SkillLevel||skillDatabase.rockWall.maxLevel);check(state.originalDefense===p.final.defense&&percent===(skillDatabase.rockWall.defenseBonusPercentByLevel?.[level-1]??skillDatabase.rockWall.defenseBonusPercent)&&m.defense===Math.max(0,state.originalDefense*(1+percent/100)),'formal Rock Wall defense buff only');}if(m.v141Shield)check(m.v141Shield.v141MonsterShield&&m.v141Shield.baseMaxHP===p.final.maxHP&&m.maxHP===m.v141Shield.baseMaxHP+m.v141Shield.amount,'formal combat shield only');check(m.mode==='abyss'&&m.balanceOwner==='MonsterBalance','Abyss owner');check(!Object.hasOwn(m,'v132Dungeon')&&!Object.hasOwn(m,'v141ExtraHP'),'no legacy stat markers');check(JSON.stringify(stats(m).slice(0,6))===JSON.stringify([p.final.maxHP,p.final.maxSP,p.final.physicalAttack,p.final.magicAttack,p.final.defense,p.final.speed]),'projection equality');check(getEnemyPressureMultiplier(m,player)===p.finalDamagePressure,'pressure once');};
 for(const level of [20,40])for(let region=0;region<5;region++)for(let stage=0;stage<5;stage++){const roster=v174AbyssBuildRoster(level,region,stage);roster.forEach(verify);for(const m of roster){const affordable=FourSymbolsEnemySkillAI.enterSkillDecision(m,0);let entered=0;for(let roll=0;roll<1000;roll++)entered+=Number(FourSymbolsEnemySkillAI.enterSkillDecision(m,(roll+.5)/1000));check(entered===(affordable?m.skillChance*1000:0),'formal skill frequency');evidence.frequencies.push({name:m.name,level,region,stage,chance:m.skillChance,entered,rolls:1000,legalAffordable:affordable});}evidence.matrix.push({level,region,stage,units:roster.map(m=>({name:m.name,rank:m.rank,context:m.context,stats:stats(m),portraitKey:m.portraitKey,portrait:v154ResolveMonsterPortraitRecord(m)}))});}
 const statusRollOwner=rollStatusEffectHit,healOwner=window.v141HealMonsterPreservingShield,debuffOwner=applyMonsterDebuff,freezeOwner=applyFreezeEffect;const recordControl=(target,type)=>{if(isPartyDamageTarget(target)&&['freeze','petrify','stun'].includes(type)){const state=target.statusEffects?.find(s=>s.type===type&&s.turnsLeft>0);if(state)evidence.controlStates.push({type,turnsLeft:state.turnsLeft,round:turn,source:'formal status execution'});}};applyMonsterDebuff=function(target,type,...args){const result=debuffOwner(target,type,...args);recordControl(target,type);return result;};applyFreezeEffect=function(target,...args){const result=freezeOwner(target,...args);recordControl(target,'freeze');return result;};rollStatusEffectHit=function(...args){let hit;const context=evidence.sceneContext,boundary=context?.difficulty===40&&context.region===4&&context.stage===4&&args[5]&&args[6]==='player'&&!evidence.controlBoundaryProbe&&calculateStatusEffectChance(...args)>0;if(boundary){const randomOwner=Math.random;try{Math.random=()=>0;hit=statusRollOwner(...args);evidence.controlBoundaryProbe={chance:calculateStatusEffectChance(...args),draw:0,hit,round:turn};}finally{Math.random=randomOwner;}}else hit=statusRollOwner(...args);if(args[5]){const chance=calculateStatusEffectChance(...args),rank=args[6],cap=rank==='regular'?90:rank==='elite'?75:60;check(chance<=cap,'actual hard-control cap');evidence.controlRolls.push({rank,chance,hit,round:turn});}return hit;};window.v141HealMonsterPreservingShield=function(m,...args){const before=m.hp,healed=healOwner(m,...args);evidence.healing.push({name:m.name,before,after:m.hp,healed});return healed;};const badgeOwner=showMonsterSkillNameBadge;showMonsterSkillNameBadge=function(name,...args){evidence.skills.push(name);return badgeOwner(name,...args);};
 const resultClose=()=>document.querySelector('#battleStatisticsResultModal [data-close]')?.click();
 async function scene(difficulty,region,stage,partyLevel,manual=false){
  evidence.sceneContext={difficulty,region,stage};const sceneStartedAt=performance.now();
  const randomSeed=difficulty*100000+region*1000+stage*100+partyLevel;let randomState=randomSeed;const nextRandom=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};Math.random=nextRandom;
  const reference=prepareWildBalanceReferenceParty(partyLevel,partyLevel>=50?3:2),castSkills=[];
  if(manual&&partyLevel===40)for(const i of getExistingPartyIndexes()){const key=getPartyCharacterKey(i),loadout=characterSkillLoadouts[key];Object.assign(loadout.skillLevels,{flameSlash:1,fireCritical:1,explosiveFlurry:1});const cost=Object.entries(loadout.skillLevels).reduce((sum,[id,n])=>sum+skillDatabase[id].learnCost+n-1,0);check(cost<=partyLevel*2&&Object.keys(loadout.skillLevels).every(id=>skillDatabase[id].learnLevel<=partyLevel),'legal geometry skill budget');getPartyCharacterByIndex(i).skillPoints=partyLevel*2-cost;loadout.equippedSkills=[reference.skill,'fireRocket','flameTornado','explosiveFlurry'];}
  v131GrantElementBoxHours(8,32);for(const cfg of [autoConfig,autoConfig2,autoConfig3]){cfg.enabled=false;cfg.skill=reference.skill;}autoBattle=false;
  closeHomeFeature();vGameplayBackToHub();document.querySelector('.gameplay-mode-card.abyss').click();check(document.querySelector('.v174-abyss-selection'),'Gameplay Center Abyss entry');v174AbyssSelectDifficulty(difficulty);
  // Seed progression only in the isolated read-only QA account. Entry, combat,
  // results, chest claim and return remain the unmodified production owners.
  const root=v174AbyssGetRootState();root.selectedDifficulty=difficulty;root.runs[difficulty]={...root.runs[difficulty],active:true,regionIndex:region,encounterIndex:stage,isBoss:stage===4,phase:'ready',battleCompleted:false,chestSpawned:false,chestClaimed:false,portalUnlocked:false,completed:false,completedStages:{},rewardClaims:{},firstClearClaims:{},completedRegions:[false,false,false,false,false],x:50,y:84};
  const uid=FourSymbolsAccountSave.getActiveUid(),save=FourSymbolsAccountSave.readForUid(uid);check(save.status==='ready','isolated QA save');FourSymbolsAccountSave.writeForUid(uid,{...save.save,abyssProgress:root},{source:'abyss-balance-qa'});v174AbyssReloadState();v174AbyssSelectDifficulty(difficulty);
  const entry=document.querySelector('.v174-abyss-encounter');check(entry,'formal entry');entry.click();
  if(stage===4){await wait(()=>document.getElementById('v169RpgDialogLayer')?.classList.contains('show'));document.querySelectorAll('#v169RpgDialogLayer .v169-rpg-dialog-button')[1].click();}
  await wait(()=>battleActive&&window.v132ActiveDungeonRun?.mode==='abyss');await wait(()=>!document.getElementById('battlePage')?.matches('.v141-preparing-entry,.v141-entry-moving'));
  check(!document.getElementById('homeFeatureModal')?.classList.contains('show'),'no blocking shared modal');
  const entities=monsters.slice(),initial=entities.map(stats),ids=currentBattleMonsters.slice(),snapshot=FourSymbolsBattlefieldSlots.getActiveEnemySnapshot(),slots=ids.map(i=>FourSymbolsBattlefieldSlots.getEnemySlotForMonster(snapshot,i));
  check(new Set(slots).size===ids.length,'unique fixed slots');check(monsters.every(m=>m.context==='abyss/'+difficulty+'/'+v174AbyssRegions[region].id+'/stage/'+(stage+1)),'actual encounter context');check(monsters.filter(m=>m.rank==='smallBoss').length===(stage<4?0:difficulty===40&&region===4?5:1),'canonical emperor rank');monsters.forEach(verify);renderBattle();monsters.forEach(verify);
  for(const i of ids){const card=document.getElementById('battleMonster'+i),art=card?.querySelector('.v174-battle-art'),r=card?.getBoundingClientRect();check(r&&r.width>0&&r.height>0&&r.left>=-1&&r.right<=innerWidth+1,'visible target card');check(card.dataset.geometryOwner==='fixed-slot'&&card.dataset.slot===FourSymbolsBattlefieldSlots.getEnemySlotForMonster(snapshot,i),'canonical rendered slot');const expectedSnapshot=FourSymbolsBattlefieldSlots.createEnemyFormationSnapshot(ids,{originalFormationType:ids.length,rankWeight:index=>{const rank=getMonsterRank(monsters[index]);return rank==='boss'?3:rank==='elite'?2:1;}}),expectedSlot=FourSymbolsBattlefieldSlots.getEnemySlotForMonster(expectedSnapshot,i);check(card.dataset.slot===expectedSlot,'fresh canonical rank placement');check(card.closest('.v-fixed-enemy-row')?.dataset.slotRow===(expectedSlot.startsWith('ENEMY_B')?'back':'front'),'canonical visual row');if(monsters[i].rank==='smallBoss'&&!(difficulty===40&&region===4))check(expectedSlot==='ENEMY_B3','single emperor central slot');check(art&&getComputedStyle(art).backgroundImage!=='none','formal portrait');const imageUrl=getComputedStyle(art).backgroundImage.split('url(')[1].split(')')[0].replaceAll('"','').replaceAll("'",'');const decoded=new Image();decoded.src=imageUrl;await decoded.decode();check(decoded.naturalWidth>0&&decoded.naturalHeight>0,'portrait decode');evidence.portraitDecode.push({name:monsters[i].name,url:imageUrl,width:decoded.naturalWidth,height:decoded.naturalHeight});check(card.querySelector('.monster-hp-inner')&&card.querySelector('.monster-sp-inner'),'HP SP UI');const record=v154ResolveMonsterPortraitRecord(monsters[i]);if(record.temporary)evidence.portraitGaps.push(record);}
  const shapes={};for(const shape of ['single','all','row','tri']){const targets=FourSymbolsBattlefieldSlots.resolveEnemyTargets(snapshot,ids[0],shape,i=>monsters[i]?.alive);check(targets.length>0&&targets.every(i=>ids.includes(i)),'target geometry '+shape);shapes[shape]=targets;}
  window.abyssBalanceQaCapture={difficulty,region,stage};await new Promise(r=>setTimeout(r,400));
  const events=[];evidence.activeScene={difficulty,region,stage,events};let controlBoundaryUsed=false;const off=FourSymbolsBattleFlow.subscribeBeforeCombatant(e=>{const actor=e.queue[e.index];Math.random=nextRandom;if(difficulty===40&&region===4&&stage===4&&!controlBoundaryUsed&&actor?.type==='monster'&&monsters[actor.monsterIndex]?.name==='東帝天尊'){controlBoundaryUsed=true;hardControlDecision=true;}for(const i of getExistingPartyIndexes())for(const state of getPartyCharacterByIndex(i).statusEffects||[])if(['freeze','petrify','stun'].includes(state.type)&&state.turnsLeft>0)evidence.controlStates.push({characterIndex:i,type:state.type,round:turn});events.push({round:turn,type:actor?.type,index:actor?.monsterIndex??actor?.characterIndex,elapsedMs:Math.round(performance.now()-sceneStartedAt)});monsters.forEach(verify);check(JSON.stringify(ids.map(i=>FourSymbolsBattlefieldSlots.getEnemySlotForMonster(FourSymbolsBattlefieldSlots.getActiveEnemySnapshot(),i)))===JSON.stringify(slots),'no death reflow');});
  let rounds=1;
  try{
   if(!manual){
    if(difficulty===40&&region===4&&stage===4){
     const firstTurn=turn;
     while(battleActive&&battlePhase==='declare'){
      await wait(()=>!battleActive||battlePhase!=='declare'||(!battleAdvanceScheduled&&battlePresentationLocks.size===0&&declaredCharacterIndexes.has(activeBattleCharacterIndex)));
      if(!battleActive||battlePhase!=='declare')break;
      const defend=document.querySelector('#battlePage .menu-button.defend');check(defend,'formal defend input');defend.click();
     }
     await wait(()=>!battleActive||turn>firstTurn,160000);
    }
    toggleAutoBattle();check(autoBattle,'formal auto input');
   }
   while(battleActive){
    await wait(()=>!battleActive||(battlePhase==='declare'&&battlePresentationLocks.size===0),160000);if(!battleActive)break;rounds=turn;
    if(!manual){await wait(()=>!battleActive,300000);break;}
    const beforeTurn=turn;
    while(battleActive&&battlePhase==='declare'){
     await wait(()=>!battleActive||battlePhase!=='declare'||(!battleAdvanceScheduled&&battlePresentationLocks.size===0&&declaredCharacterIndexes.has(activeBattleCharacterIndex)));
     if(!battleActive||battlePhase!=='declare')break;
     const skill=partyLevel===40&&castSkills.length<2?['flameTornado','explosiveFlurry'][castSkills.length]:reference.skill;const action=chooseWildBalanceReferenceAction(activeBattleCharacterIndex,skill);toggleSkillQuickBar();const button=document.querySelector('.skill-quick-button[data-skill-id="'+skill+'"]');check(button&&!button.disabled,'legal skill');button.click();check(actionReady&&pendingAction===skill,'skill declaration');document.getElementById('battleMonster'+(action.target??ids.find(i=>monsters[i].alive))).click();castSkills.push(skill);
    }
    await wait(()=>!battleActive||turn>beforeTurn,160000);
   }
  }finally{off();}
  autoBattle=false;autoConfig.enabled=false;await wait(()=>document.getElementById('battleStatisticsResultModal')?.hidden===false);resultClose();
  await wait(()=>v174AbyssGetRunState(difficulty).phase==='chest');check(!window.v132ActiveDungeonRun,'no background battle');
  entities.forEach(verify);evidence.statChecks=evidence.statChecks||[];evidence.statChecks.push({difficulty,region,stage,initial,after:entities.map(stats),combatStates:entities.map(m=>({name:m.name,rockWall:m.v155RockWall||null,shield:m.v141Shield||null}))});check(JSON.stringify(initial)===JSON.stringify(entities.map(stats)),'no late stat writer');
  const goldBefore=gold;document.querySelector('.v174-abyss-chest').click();await wait(()=>v174AbyssGetRunState(difficulty).chestClaimed,12000);check(gold>goldBefore,'formal reward');
  document.querySelector('#v132RewardModal button')?.click();document.querySelector('#v141BlackGoldRewardModal button')?.click();
  v174AbyssBackToSelection();v174AbyssLeaveToGameplay();check(!battleActive&&!window.v132ActiveDungeonRun,'return cleanup');
  evidence.scenes.push({elapsedMs:Math.round(performance.now()-sceneStartedAt),difficulty,region,stage,partyLevel,manual,randomSeed,castSkills,initial,slots,shapes,events,rounds:Math.max(...events.map(e=>e.round)),survivors:getExistingPartyIndexes().filter(i=>getPartyCharacterByIndex(i).hp>0).length,rewardGold:gold-goldBefore});
 }
 try{
  for(const region of [0,1,2,3])await scene(20,region,0,region===0?40:30,region===0);
  await scene(20,3,4,30);await scene(40,4,4,60);await scene(20,0,0,20,true);
  check(['flameTornado','explosiveFlurry','phoenixCry','fireRocket'].every(id=>evidence.scenes.some(s=>s.castSkills.includes(id))),'real row/tri/all/single skill input');for(const rank of ['regular','elite','boss']){const cap=rank==='regular'?90:rank==='elite'?75:60;check(calculateStatusEffectChance(999,100,100,0,0,true,rank,0)===cap,'player hard cap');evidence.controls.push({rank,cap});}check(calculateStatusEffectChance(999,100,100,0,0,true,'player',0)===60,'enemy hard cap');
  check(evidence.controlDecisionProbe?.category==='attack'&&evidence.controlBoundaryProbe?.hit,'native hard-control decision and status boundary');check(evidence.controlRolls.some(r=>r.hit)&&evidence.controlStates.some(s=>['freeze','petrify'].includes(s.type)),'actual hard control application');check(evidence.healing.some(r=>r.healed>0),'actual support healing');return evidence;
 }finally{Math.random=oldRandom;window.FourSymbolsEnemySkillAI=enemySkillAiOwner;hardControlDecision=null;showMonsterSkillNameBadge=badgeOwner;rollStatusEffectHit=statusRollOwner;applyMonsterDebuff=debuffOwner;applyFreezeEffect=freezeOwner;window.v141HealMonsterPreservingShield=healOwner;autoBattle=false;autoConfig.enabled=false;}
})()`;
const baseUrl=process.env.ABYSS_BALANCE_BASE_URL;
if(baseUrl){const manifest=await fetch(new URL('release-manifest.json',baseUrl+'/')).then(r=>r.json());assert.equal(manifest.commitSha,process.env.EXPECTED_COMMIT_SHA,'Abyss deployed exact SHA');}
const server=await startServer({baseUrl});const artifact=path.join(ROOT,'artifacts/browser-qa/abyss-balance.json');fs.mkdirSync(path.dirname(artifact),{recursive:true});const results=[];let client,proc,profile;
function close(){client?.close();client=null;proc?.kill('SIGTERM');proc=null;if(profile){try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}profile=null;}}
try{
 for(const [width,height] of [[390,844],[412,915]]){
  profile=fs.mkdtempSync(path.join(os.tmpdir(),'abyss-balance-'));const port=9850+Math.floor(Math.random()*100);proc=spawn(findChrome(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
  const tabs=await waitJson('http://127.0.0.1:'+port+'/json/list');client=new Cdp(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await client.send('Page.enable');await client.send('Runtime.enable');await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await client.send('Page.navigate',{url:server.url});await new Promise(r=>setTimeout(r,1000));const active=client.eval(fixture+'\n'+expression);let done=false;active.finally(()=>{done=true;}).catch(()=>{});const captured=new Set();while(!done){await new Promise(r=>setTimeout(r,200));const marker=await client.eval('window.abyssBalanceQaCapture||null').catch(()=>null);if(marker){const key=[marker.difficulty,marker.region,marker.stage].join('-');if(!captured.has(key)){captured.add(key);const shot=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(artifact.replace('.json','-'+width+'x'+height+'-'+key+'.png'),Buffer.from(shot.data,'base64'));}}}
  const evidence=await active;assert.equal(evidence.matrix.length,50);assert.equal(evidence.scenes.length,7);assert.equal(evidence.scenes.every(s=>s.survivors>0),true);assert.equal(client.events.some(e=>e.method==='Runtime.consoleAPICalled'&&e.params.type==='error'&&JSON.stringify(e.params.args).includes('戰鬥行動超過安全期限')),false,'no watchdog recovery');results.push({width,height,...evidence});close();
 }
 fs.writeFileSync(artifact,JSON.stringify({passed:true,commitSha:process.env.EXPECTED_COMMIT_SHA||process.env.GITHUB_SHA||'local',results},null,2)+'\n');console.log('Abyss production QA: 14 natural scenes, 100 rosters / 804 projections, both mobile viewports PASS');
}catch(error){const partial=await client?.eval('({evidence:window.abyssBalanceQaEvidence,phase:battlePhase,turn,battleActive,initiativeIndex,queueLength:initiativeQueue.length,advanceScheduled:battleAdvanceScheduled,locks:[...battlePresentationLocks].map(lock=>lock.owner),party:getExistingPartyIndexes().map(i=>({index:i,hp:getPartyCharacterByIndex(i).hp,status:getPartyCharacterByIndex(i).statusEffects})),enemies:currentBattleMonsters.map(i=>({index:i,hp:monsters[i].hp,alive:monsters[i].alive})),runMode:window.v132ActiveDungeonRun?.mode,modals:[...document.querySelectorAll(".show")].map(x=>x.id)})').catch(()=>null);fs.writeFileSync(artifact,JSON.stringify({passed:false,error:String(error.stack||error),results,partial,console:client?.events.filter(e=>e.method==='Runtime.consoleAPICalled').slice(-15)},null,2)+'\n');throw error;}
finally{close();await new Promise(r=>server.server.close(r));}
