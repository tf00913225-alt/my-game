import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadLegacyRuntime} from '../scripts/monster-balance-shadow-matrix.mjs';
import {buildAbyssTtkMatrix} from '../scripts/abyss-balance-ttk-matrix.mjs';

// Source Runtime integration, not browser/portrait/VFX rendering evidence.
function load(){
  const {context:c}=loadLegacyRuntime(), timers=new Map();let id=100,clock=0;
  c.setTimeout=(fn,ms)=>{timers.set(++id,{fn,ms,at:clock+Math.max(0,Number(ms)||0)});return id;};
  c.clearTimeout=key=>timers.delete(key);
  c.performance.now=()=>clock;
  c.v154PreparePortraitsForEncounter=()=>({state:'ready'});
  vm.runInContext(fs.readFileSync('tests/fixtures/wild-balance-reference-party.js','utf8'),c);
  vm.runInContext(`
    prepareWildBalanceReferenceParty(100,3);autoBattle=false;autoPatrolEnabled=false;
    saveGame=()=>{};updateUI=()=>{};renderPlayers=()=>{};populateSkillQuickBar=()=>{};
    // Source lifecycle tests settle the presentation boundary explicitly;
    // physical/browser QA separately verifies the real Animation.finished path.
    window.v141PresentBattleWave=({replace,complete})=>{replace();complete();return ()=>{};};
    window.__frames=[];window.__outcomes=[];window.__events=[];
    FourSymbolsCombatEvents.subscribe('battle_start',event=>__events.push(event));
    renderBattle=()=>{
      v138EnsureEnemyFormationSnapshot(currentBattleMonsters);
      __frames.push({token:battleToken,turn,ids:currentBattleMonsters.slice(),
        party:getExistingPartyIndexes().map(i=>JSON.stringify(getPartyCharacterByIndex(i))),
        skills:currentBattleMonsters.map(i=>({skills:monsters[i].skillIds,supports:monsters[i].v141SupportSkillIds||[]}))});
    };
  `,c);
  const run=source=>vm.runInContext(source,c);
  const json=source=>JSON.parse(run('JSON.stringify('+source+')'));
  function advance(){
    const key=run('battleAdvanceTimeoutId'),timer=timers.get(key);
    assert.ok(timer,'formal Core Queue must schedule its own continuation');
    timers.delete(key);clock=timer.at;timer.fn();return timer.ms;
  }
  function presentation(ms){
    const entry=Array.from(timers).find(([,timer])=>timer.ms===ms);
    assert.ok(entry,'missing presentation callback '+ms);
    timers.delete(entry[0]);clock=entry[1].at;entry[1].fn();
  }
  function next(){
    const entry=Array.from(timers).sort((a,b)=>a[1].at-b[1].at)[0];
    assert.ok(entry,'formal Runtime must have a continuation');
    timers.delete(entry[0]);clock=entry[1].at;entry[1].fn();
  }
  function enter(){ presentation(1000);presentation(720); }
  return {c,run,json,advance,timers,presentation,enter,next};
}

for(const [name,mode,build,size] of [
  ['tower normal','tower','GameplaySystem.buildTowerWaves(1)',6],
  ['tower elite','tower','GameplaySystem.buildTowerWaves(5)',6],
  ['tower boss composition','tower','GameplaySystem.buildTowerWaves(10)',6],
  ['abyss pre-stage','abyss','v174AbyssBuildWaves(20,0,0)',6],
  ['abyss emperor composition','abyss','v174AbyssBuildWaves(40,0,4)',6],
  ['abyss final five','abyss','v174AbyssBuildWaves(40,4,4)',5]
]){
  test(name+': shared launch, action boundary, fixed slots and once-only outcome',()=>{
    const r=load();
    assert.equal(r.run(`window.__waves=${build};v132LaunchDungeonBattle(__waves[0],o=>__outcomes.push(o.result),{mode:'${mode}',waves:__waves})`),true);
    r.enter();
    const token=r.run('battleToken');
    const carriedSkills=r.json('__waves[1].map(m=>({skills:m.skillIds,supports:m.v141SupportSkillIds||[]}))');
    r.run(`
      player.hp-=7;player.sp-=3;player.rage=2;
      player.activeBuffs=[{id:'wave-test-buff',turns:3}];
      player.statusEffects=[{id:'wave-test-debuff',turns:3}];
      battlePhase='resolve';initiativeQueue=buildInitiativeQueue();initiativeIndex=0;
      queuedPlayerActions[1]={action:'defend',target:null};queuedPlayerActions[2]={action:'defend',target:null};
      currentBattleMonsters.forEach(i=>{monsters[i].hp=0;});
      finishPlayerAction();
    `);
    assert.deepEqual(r.json('__outcomes'),[],'first-wave death must not reward/progress');
    const before=r.json('getExistingPartyIndexes().map(i=>JSON.stringify(getPartyCharacterByIndex(i)))');
    assert.equal(r.run('FourSymbolsBattleWaves.getState().phase'),'WAVE_TRANSITION');
    assert.ok(r.advance()>=650);
    const frame=r.json('__frames.find(frame=>frame.ids[0]===6)');
    assert.deepEqual(frame.party,before,'transition must not reset any player state');
    assert.deepEqual(frame.skills,carriedSkills,'wave entry must retain the prepared fixed skill loadout');
    assert.equal(frame.token,token);assert.equal(frame.turn,1);
    assert.equal(frame.ids.length,size);
    assert.equal(r.run('monsters.slice(0,6).filter(Boolean).length'),0);
    assert.equal(r.run('FourSymbolsBattlefieldSlots.getActiveEnemySnapshot().battlefieldProfile'),'standard-six');
    assert.equal(new Set(r.json('Object.values(FourSymbolsBattlefieldSlots.getActiveEnemySnapshot().monsterIndexToSlot)')).size,size);
    assert.equal(r.run('getSkillTargets(currentBattleMonsters[0],"all").length'),size);
    assert.equal(r.run('getSkillTargets(currentBattleMonsters[0],"single")[0]'),6);
    assert.equal(r.run('FourSymbolsBattleWaves.getState().phase'),'WAVE_2_ACTIVE');
    r.run('currentBattleMonsters.forEach(i=>{monsters[i].hp=0;});checkBattleEnd();checkBattleEnd();');
    r.presentation(2700);
    assert.deepEqual(r.json('__outcomes'),['win']);
  });
}

test('shared failure path stops pending wave and returns one loss',()=>{
  const r=load();
  r.run(`window.__waves=v174AbyssBuildWaves(20,0,0);v132LaunchDungeonBattle(__waves[0],o=>__outcomes.push(o.result),{mode:'abyss',waves:__waves});`);
  r.enter();
  r.run(`
    battlePhase='resolve';initiativeQueue=buildInitiativeQueue();initiativeIndex=0;
    currentBattleMonsters.forEach(i=>monsters[i].hp=0);finishPlayerAction();
    getExistingPartyIndexes().forEach(i=>getPartyCharacterByIndex(i).hp=0);`);
  r.advance();
  r.presentation(2700);
  assert.deepEqual(r.json('__outcomes'),['lose']);
  assert.equal(r.run('battleActive'),false);
  assert.equal(r.json('__frames').some(frame=>frame.ids[0]===6),false);
});

for(const wave of [0,1]){
  test('successful escape in wave '+(wave+1)+' blocks late continuation and retry starts wave one',async()=>{
    const r=load();
    r.run(`window.__waves=v174AbyssBuildWaves(40,4,4);v132LaunchDungeonBattle(__waves[0],o=>__outcomes.push(o.result),{mode:'abyss',waves:__waves});`);
    r.enter();
    if(wave===1){r.run(`battlePhase='resolve';initiativeQueue=buildInitiativeQueue();initiativeIndex=0;currentBattleMonsters.forEach(i=>monsters[i].hp=0);finishPlayerAction();`);r.advance();}
    r.run(`
      window.__escapeEnds=[];FourSymbolsCombatEvents.subscribe('battle_end',e=>__escapeEnds.push(e.result));
      window.FourSymbolsBattlePresentation={playEscape:()=>new Promise(resolve=>window.__resolveEscape=resolve),cleanupEscape:()=>{}};
      window.__originalRandom=Math.random;Math.random=()=>0;resolveEscapeAttempt(0);Math.random=__originalRandom;
      window.__escapeRoster=currentBattleMonsters.slice();window.__escapeToken=battleToken;
      currentBattleMonsters.forEach(i=>monsters[i].hp=0);
      finishPlayerAction();processNextCombatant(battleToken);startTurn(battleToken);
    `);
    assert.equal(r.run('isBattleEscapePending()'),true);
    assert.equal(r.run('FourSymbolsBattleWaves.getState()'),null);
    assert.deepEqual(r.json('currentBattleMonsters'),r.json('__escapeRoster'));
    assert.equal(r.run('battleAdvanceScheduled'),false);assert.deepEqual(r.json('__outcomes'),[]);
    r.run('__resolveEscape(true)');for(let i=0;i<5;i++)await Promise.resolve();
    r.presentation(460);r.presentation(120);for(let i=0;i<5;i++)await Promise.resolve();
    assert.equal(r.run('battleActive'),false);assert.equal(r.run('FourSymbolsBattleFlow.isPresentationActive()'),false);
    assert.deepEqual(r.json('__outcomes'),['escape']);assert.deepEqual(r.json('__escapeEnds'),['escape']);
    r.run(`window.__retry=v174AbyssBuildWaves(40,4,4);v132LaunchDungeonBattle(__retry[0],()=>{}, {mode:'abyss',waves:__retry});`);
    assert.equal(r.run('FourSymbolsBattleWaves.getState().index'),0);
    assert.equal(r.run('FourSymbolsBattleWaves.getState().phase'),'WAVE_1_ACTIVE');
    assert.deepEqual(r.json('currentBattleMonsters'),[0,1,2,3,4,5]);
    assert.equal(r.run('isBattleEscapePending()'),false);
  });
}

test('an escape animation callback from an aborted encounter cannot abort its replacement',async()=>{
  const r=load();r.run(`window.__waves=GameplaySystem.buildTowerWaves(1);v132LaunchDungeonBattle(__waves[0],o=>__outcomes.push(o.result),{mode:'tower',waves:__waves});`);r.enter();
  r.run(`FourSymbolsBattlePresentation={playEscape:()=>new Promise(resolve=>window.__oldEscape=resolve),cleanupEscape:()=>{}};window.__random=Math.random;Math.random=()=>0;resolveEscapeAttempt(0);Math.random=__random;v132AbortDungeonBattle('external');window.__newWaves=GameplaySystem.buildTowerWaves(1);v132LaunchDungeonBattle(__newWaves[0],o=>__outcomes.push(o.result),{mode:'tower',waves:__newWaves});window.__newToken=battleToken;__oldEscape(true);`);
  for(let i=0;i<5;i++)await Promise.resolve();
  assert.equal(r.run('battleActive'),true);assert.equal(r.run('battleToken===__newToken'),true);
  assert.equal(r.run('FourSymbolsBattleWaves.getState().index'),0);assert.deepEqual(r.json('__outcomes'),['external']);
});

test('dungeon abort during wave exit cancels presentation and stale callbacks cannot spawn wave two',()=>{
  const r=load();r.run(`window.v141PresentBattleWave=callbacks=>{window.__waveCallbacks=callbacks;return ()=>window.__waveCancelled=true;};window.__waves=v174AbyssBuildWaves(40,4,4);v132LaunchDungeonBattle(__waves[0],o=>__outcomes.push(o.result),{mode:'abyss',waves:__waves});`);r.enter();
  r.run(`battlePhase='resolve';initiativeQueue=[];initiativeIndex=0;currentBattleMonsters.forEach(i=>monsters[i].hp=0);finishPlayerAction();`);r.advance();
  assert.equal(r.run('FourSymbolsBattleWaves.getState().presentation'),'exit');
  r.run(`v132AbortDungeonBattle('escape');window.__replacement=__waveCallbacks.replace();__waveCallbacks.complete();`);
  assert.equal(r.run('__waveCancelled'),true);assert.equal(r.run('__replacement'),false);
  assert.equal(r.run('FourSymbolsBattleWaves.getState()'),null);assert.equal(r.run('FourSymbolsBattleFlow.isPresentationActive()'),false);
  assert.deepEqual(r.json('__outcomes'),['escape']);assert.equal(r.run('battleActive'),false);
});

test('round-start deaths continue declaration without an extra round-start event',()=>{
  const r=load();
  r.run(`window.__waves=v174AbyssBuildWaves(20,0,0);v132LaunchDungeonBattle(__waves[0],o=>__outcomes.push(o.result),{mode:'abyss',waves:__waves});`);
  r.enter();
  r.run(`
    currentBattleMonsters.forEach(i=>monsters[i].hp=0);turn=2;startTurn(battleToken);`);
  assert.equal(r.run('FourSymbolsBattleWaves.getState().phase'),'WAVE_2_ACTIVE');
  assert.equal(r.run('turn'),2);assert.equal(r.run('battlePhase'),'declare');
  assert.deepEqual(r.json('__outcomes'),[]);
});

test('ordinary pre-stage resolves both waves through real queued damage for two random policies',()=>{
  for(const randomPolicy of ['neutral','seeded']){
    const report=buildAbyssTtkMatrix({randomPolicy,
      caseFilter:c=>c.difficulty===20&&c.partyLevel===40&&c.region===0&&c.stage===0});
    assert.equal(report.cases,1);
    const row=report.rows[0];
    assert.equal(row.clear,true);assert.ok(row.survivors>0);
    assert.equal(row.initialMonsters.length,12);
    assert.equal(row.finalMonsters.filter(m=>m.hp<=0).length,12);
  }
});

test('before-combatant deaths transition at the settled queue boundary without a dummy action',()=>{
  const r=load();
  r.run(`window.__waves=v174AbyssBuildWaves(20,0,0);v132LaunchDungeonBattle(__waves[0],o=>__outcomes.push(o.result),{mode:'abyss',waves:__waves});`);
  r.enter();
  r.run(`battlePhase='resolve';initiativeQueue=buildInitiativeQueue();initiativeIndex=0;
    queuedPlayerActions[0]={action:'defend',target:null};
    const release=FourSymbolsBattleFlow.subscribeBeforeCombatant(()=>{
      currentBattleMonsters.filter(i=>i<6).forEach(i=>monsters[i].hp=0);
    });
    processNextCombatant(battleToken);release();`);
  assert.equal(r.run('FourSymbolsBattleWaves.getState().phase'),'WAVE_2_ACTIVE');
  assert.equal(r.run('turn'),1);
  assert.deepEqual(r.json('__outcomes'),[]);
});

test('opening relic once-only ledger and accumulated battle statistics survive wave two',()=>{
  const r=load();
  // No real presentation host in this source-only fixture; retain relic effects
  // and once-only ledger while leaving cinematic verification to Browser QA.
  const findNode=r.c.document.getElementById;
  r.c.document.getElementById=id=>id==='battlePage'?null:findNode(id);
  if(!r.c.v174RelicSystem){vm.runInContext(fs.readFileSync('js/60-team-relic-system.js','utf8'),r.c);}
  r.run(`
    v174RelicSystem.getOwnedState().relic_red_sky_war_mark.unlocked=true;
    v174RelicSystem.getTeamLoadout().relicId='relic_red_sky_war_mark';
    window.__waves=v174AbyssBuildWaves(20,0,0);
    v132LaunchDungeonBattle(__waves[0],o=>__outcomes.push(o.result),{mode:'abyss',waves:__waves});
  `);
  r.enter();
  assert.equal(r.run('v174RelicDamageModifiers.ordinaryBonus(player,"activeSkill")'),6);
  assert.equal(r.run('v174RelicSystem.dispatch("battle_start",{sourceType:"system"})'),false);
  r.run(`
    const stats=FourSymbolsBattleStatistics,sourceId=stats.getCombatantIdByBattleIndex(0);
    stats.recordDamage({sourceId,amount:37});stats.recordHealing({sourceId,amount:11});
    battlePhase='resolve';initiativeQueue=buildInitiativeQueue();initiativeIndex=0;
    queuedPlayerActions[1]={action:'defend',target:null};queuedPlayerActions[2]={action:'defend',target:null};
    currentBattleMonsters.forEach(i=>monsters[i].hp=0);finishPlayerAction();
  `);
  r.advance();
  assert.equal(r.run('FourSymbolsBattleWaves.getState().phase'),'WAVE_2_ACTIVE');
  assert.equal(r.run('v174RelicSystem.dispatch("battle_start",{sourceType:"system"})'),false);
  const stats=r.json('FourSymbolsBattleStatistics.getSnapshot()');
  assert.equal(stats.combatants[0].damageDealt,37);assert.equal(stats.combatants[0].healingDone,11);
});

test('single and all damage owners only hit current-wave entities',()=>{
  const r=load();
  r.run(`window.__waves=v174AbyssBuildWaves(40,0,0);v132LaunchDungeonBattle(__waves[0],o=>__outcomes.push(o.result),{mode:'abyss',waves:__waves});`);
  r.enter();
  r.run(`battlePhase='resolve';initiativeQueue=buildInitiativeQueue();initiativeIndex=0;
    queuedPlayerActions[1]={action:'defend',target:null};queuedPlayerActions[2]={action:'defend',target:null};
    currentBattleMonsters.forEach(i=>monsters[i].hp=0);finishPlayerAction();`);
  r.advance();
  const before=r.json('currentBattleMonsters.map(i=>monsters[i].hp)');
  r.run(`Math.random=()=>.5;activeBattleCharacterIndex=1;queuedPlayerActions[1]={action:'normal',target:6};resolveQueuedPlayerAction(1,battleToken);`);
  const single=r.json('currentBattleMonsters.map(i=>monsters[i].hp)');
  assert.ok(single[0]<before[0]);assert.deepEqual(single.slice(1),before.slice(1));
  r.run(`activeBattleCharacterIndex=2;queuedPlayerActions[2]={action:'phoenixCry',target:null};resolveQueuedPlayerAction(2,battleToken);`);
  const all=r.json('currentBattleMonsters.map(i=>monsters[i].hp)');
  single.forEach((hp,i)=>{if(hp>0)assert.ok(all[i]<hp,'living current-wave target '+i+' must receive all damage');});
  assert.equal(r.run('monsters.slice(0,6).filter(Boolean).length'),0);
});

test('all six second-wave enemies resolve a formal action without repeating already-acted players',()=>{
  const r=load();
  r.run(`window.__waves=v174AbyssBuildWaves(20,0,0);v132LaunchDungeonBattle(__waves[0],o=>__outcomes.push(o.result),{mode:'abyss',waves:__waves});`);
  r.enter();
  r.run(`window.__actions=[];FourSymbolsCombatEvents.subscribe('action_started',e=>__actions.push({type:e.action.entry.type,index:e.action.entry.monsterIndex??e.action.entry.characterIndex}));
    Math.random=()=>.5;battlePhase='resolve';initiativeQueue=buildInitiativeQueue();initiativeIndex=0;
    queuedPlayerActions[1]={action:'defend',target:null};queuedPlayerActions[2]={action:'defend',target:null};
    currentBattleMonsters.forEach(i=>monsters[i].hp=0);finishPlayerAction();`);
  r.advance();
  for(let step=0;step<300&&r.run('turn')<2;step++){r.next();}
  assert.equal(r.run('turn'),2);
  const actions=r.json('__actions');
  assert.deepEqual(actions.filter(a=>a.type==='monster').map(a=>a.index).sort((a,b)=>a-b),[6,7,8,9,10,11]);
  assert.deepEqual(actions.filter(a=>a.type==='player').map(a=>a.index).sort(),[1,2]);
  assert.deepEqual(r.json('__outcomes'),[]);
});

test('final elite extension retains the four-element cycle and valid +10 difficulty evidence',()=>{
  for(const randomPolicy of ['neutral','seeded']){
    const report=buildAbyssTtkMatrix({randomPolicy,
      caseFilter:c=>c.difficulty===40&&c.partyLevel===50&&c.region===4&&c.stage===4});
    assert.equal(report.cases,1);assert.deepEqual(report.gate.invalidCases,[{reason:'matrix coverage'}]);assert.deepEqual(report.gate.instantWipes,[]);
    const row=report.rows[0],first=row.initialMonsters.slice(0,6);
    assert.deepEqual(first.map(m=>m.element),['water','earth','fire','wind','water','earth']);
    assert.equal(first.filter(m=>m.supportIds.includes('healSpell')).length,2);
    assert.equal(typeof row.clear,'boolean');assert.ok(row.survivors>=0&&row.survivors<=row.partySize);
  }
});
