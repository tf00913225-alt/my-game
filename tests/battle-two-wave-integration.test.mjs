import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadLegacyRuntime} from '../scripts/monster-balance-shadow-matrix.mjs';
import {buildAbyssTtkMatrix} from '../scripts/abyss-balance-ttk-matrix.mjs';

// Source Runtime integration, not browser/portrait/VFX rendering evidence.
function load(probe=false){
  let context;
  if(probe){
    const sourceTransform=function(path,value){
      if(path==='js/00-main.js'){
        const marker='function checkBattleEnd(afterAction=false){';
        if(!value.includes(marker))throw Error('missing core probe marker');
        value=value.replace(marker,`const __q61DryRun=(()=>{
          const runs=new WeakMap(),proofs=new WeakMap();
          return {events:[],capture(run,token){if(!run||run.mode!=='tower'||runs.has(run))return;
            const indexes=getExistingPartyIndexes().slice();runs.set(run,{token,indexes,members:indexes.map(getPartyCharacterByIndex)});},
          issue(){const run=window.v132ActiveDungeonRun,entry=run&&runs.get(run);if(!entry||entry.issued||!battleActive||entry.token!==battleToken)return null;
            const indexes=getExistingPartyIndexes();if(!indexes.length||indexes.length!==entry.indexes.length||new Set(indexes).size!==indexes.length)return null;
            if(indexes.some((index,i)=>index!==entry.indexes[i]||!Number.isSafeInteger(index)||index<0||index>5||getPartyCharacterByIndex(index)!==entry.members[i]||!entry.members[i]||typeof entry.members[i].hp!=='number'||!Number.isFinite(entry.members[i].hp)||entry.members[i].hp>0))return null;
            const proof={};entry.issued=true;proofs.set(proof,{run,token:battleToken});this.events.push('issued');return proof;},
          consume(proof,run,token){const entry=proof&&proofs.get(proof);if(proof)proofs.delete(proof);
            const valid=!!entry&&entry.run===run&&entry.token===token&&battleToken===token&&battleActive&&window.v132ActiveDungeonRun===run;
            this.events.push(valid?'consumed':'rejected');return valid;}};
        })();\n`+marker);
        const branch='    if(partyDefeated){\n\n        loseBattle();';
        if(!value.includes(branch))throw Error('missing defeat probe marker');
        value=value.replace(branch,'    if(partyDefeated){\n\n        loseBattle(__q61DryRun.issue());');
      }
      if(path==='js/27-v132-content-expansion.js'){
        const entry='        battleActive=true;\n        battleToken++;\n        battleRoundBoundaryKeys';
        if(!value.includes(entry))throw Error('missing launcher probe marker');
        value=value.replace(entry,'        battleActive=true;\n        battleToken++;\n        __q61DryRun.capture(window.v132ActiveDungeonRun,battleToken);\n        battleRoundBoundaryKeys');
        const start=value.indexOf('    if(typeof loseBattle==="function"){'),tail=value.slice(start);
        if(start<0||!tail.includes('            battleActive=false;')||!tail.includes('run.onComplete({result:"lose"});'))throw Error('missing loss probe marker');
        value=value.slice(0,start)+tail.replace('            battleActive=false;','            const __q61Consumed=__q61DryRun.consume(arguments[0],run,battleToken);\n            battleActive=false;').replace('run.onComplete({result:"lose"});','run.onComplete({result:"lose",__q61Consumed});');
      }
      if(path==='js/gameplay-boss-tower-system.js'){
        const marker='    function completeTowerFloor(floor,outcome){';
        if(!value.includes(marker))throw Error('missing Tower consumer probe marker');
        value=value.replace(marker,marker+'\n        __q61DryRun.events.push(outcome&&outcome.__q61Consumed===true?"tower-observed-candidate":"tower-observed-none");');
      }
      return value;
    };
    context=loadLegacyRuntime({sourceTransform}).context;
  }else context=loadLegacyRuntime().context;
  const c=context, timers=new Map();let id=100,clock=0;
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

test('isolated dry-run: core defeat reaches original Tower consumer; direct loss does not',()=>{
  for(const origin of ['core','direct']){
    const r=load(true);
    assert.equal(r.run('vGameplaySelectTowerBand(1)'),true);
    r.enter();
    if(origin==='core'){
      r.run('getExistingPartyIndexes().forEach(i=>getPartyCharacterByIndex(i).hp=0);checkBattleEnd()');
      assert.equal(r.run('__q61DryRun.issue()'),null,'one candidate per captured run');
      r.run('__q61DryRun.capture(v132ActiveDungeonRun,battleToken)');
      assert.equal(r.run('__q61DryRun.issue()'),null,'recapturing cannot reset issuance');
    }
    else r.run('loseBattle()');
    r.presentation(2700);
    assert.deepEqual(r.json('__q61DryRun.events'),origin==='core'?
      ['issued','consumed','tower-observed-candidate']:['rejected','tower-observed-none']);
  }
});

test('isolated dry-run: empty, missing or replaced party cannot qualify a Tower loss',()=>{
  for(const scenario of ['empty','missing','replaced']){
    const r=load(true);assert.equal(r.run('vGameplaySelectTowerBand(1)'),true);r.enter();
    r.run(scenario==='empty'?"getExistingPartyIndexes=()=>[]":scenario==='missing'?
      "getExistingPartyIndexes=()=>[0];getPartyCharacterByIndex=()=>null":
      "window.__originalMember=getPartyCharacterByIndex;getPartyCharacterByIndex=i=>{const p=__originalMember(i);return p?{...p,hp:0}:null}");
    r.run('checkBattleEnd()');r.presentation(2700);
    assert.deepEqual(r.json('__q61DryRun.events'),['rejected','tower-observed-none']);
  }
});

test('isolated dry-run: abort and stale loss callback cannot qualify a replacement run',()=>{
  const r=load(true);assert.equal(r.run('vGameplaySelectTowerBand(1)'),true);r.enter();
  r.run('getExistingPartyIndexes().forEach(i=>getPartyCharacterByIndex(i).hp=0);checkBattleEnd()');
  const stale=Array.from(r.timers.values()).find(timer=>timer.ms===2700)?.fn;assert.ok(stale);
  assert.equal(r.run("v132AbortDungeonBattle('escape')"),true);
  assert.equal(r.run('vGameplaySelectTowerBand(1)'),true);
  const token=r.run('battleToken');stale();
  assert.equal(r.run('battleToken'),token);assert.equal(r.run('battleActive'),true);
  assert.deepEqual(r.json('__q61DryRun.events'),['issued','tower-observed-none']);
});

test('Tower real launcher distinguishes core defeat from direct loss and protects replacement from stale exit',()=>{
  for(const origin of ['core','direct']){
    const r=load();
    assert.equal(r.run("window.__waves=GameplaySystem.buildTowerWaves(1);v132LaunchDungeonBattle(__waves[0],o=>__outcomes.push(o.result),{mode:'tower',waves:__waves})"),true);
    r.enter();
    assert.equal(r.run('battleActive'),true);
    assert.ok(r.run('getExistingPartyIndexes().length')>0);
    if(origin==='core'){
      r.run('getExistingPartyIndexes().forEach(i=>getPartyCharacterByIndex(i).hp=0);checkBattleEnd()');
    }else{
      assert.equal(r.run('getExistingPartyIndexes().every(i=>getPartyCharacterByIndex(i).hp>0)'),true);
      r.run('loseBattle()');
    }
    assert.deepEqual(r.json('__outcomes'),[]);
    assert.equal(r.run('battleActive'),true);
    r.presentation(2700);
    assert.deepEqual(r.json('__outcomes'),['lose']);
    assert.equal(r.run('battleActive'),false);
  }
  const r=load();
  assert.equal(r.run("window.__waves=GameplaySystem.buildTowerWaves(1);v132LaunchDungeonBattle(__waves[0],o=>__outcomes.push('old:'+o.result),{mode:'tower',waves:__waves})"),true);
  r.enter();
  r.run("window.__oldToken=battleToken;getExistingPartyIndexes().forEach(i=>getPartyCharacterByIndex(i).hp=0);checkBattleEnd();");
  const staleExit=Array.from(r.timers.values()).find(timer=>timer.ms===2700)?.fn;
  assert.ok(staleExit,'original deferred loss callback must be scheduled');
  r.run("window.__abortResult=v132AbortDungeonBattle('external');window.__replacement=GameplaySystem.buildTowerWaves(1);window.__replacementStarted=v132LaunchDungeonBattle(__replacement[0],o=>__outcomes.push('new:'+o.result),{mode:'tower',waves:__replacement});window.__replacementRun=v132ActiveDungeonRun;window.__replacementToken=battleToken;");
  assert.equal(r.run('__abortResult && __replacementStarted'),true);
  assert.equal(r.run('__oldToken!==__replacementToken'),true);
  assert.deepEqual(r.json('__outcomes'),['old:external']);
  assert.equal(r.run('battleActive'),true);
  staleExit();
  assert.equal(r.run('battleActive'),true,'stale loss exit must not end the replacement');
  assert.equal(r.run('v132ActiveDungeonRun===__replacementRun && battleToken===__replacementToken'),true);
  assert.deepEqual(r.json('__outcomes'),['old:external']);
  r.enter();
  r.run('getExistingPartyIndexes().forEach(i=>getPartyCharacterByIndex(i).hp=0);checkBattleEnd()');
  r.presentation(2700);
  assert.deepEqual(r.json('__outcomes'),['old:external','new:lose']);
});

test('stale Tower loss releases only its own presentation before replacement entry',()=>{
  for(const stage of [0,720,1450])for(const mode of ['tower','daily']){
    const r=load();
    assert.equal(r.run("window.__waves=GameplaySystem.buildTowerWaves(1);v132LaunchDungeonBattle(__waves[0],o=>__outcomes.push('old:'+o.result),{mode:'tower',waves:__waves})"),true);
    r.enter();
    const doc=r.c.document,originalGet=doc.getElementById.bind(doc),label={textContent:'戰'};
    const classes=()=>{const values=new Set();return {add:v=>values.add(v),remove:v=>values.delete(v),contains:v=>values.has(v),toggle(v){if(values.has(v)){values.delete(v);return false;}values.add(v);return true;},snapshot:()=>[...values].sort()};};
    const pageClasses=classes(),overlayClasses=classes(),dataset={};
    const page=new Proxy(originalGet('battlePage'),{get:(target,key)=>key==='classList'?pageClasses:Reflect.get(target,key)});
    const overlay=new Proxy(originalGet('v141BattleTransition'),{get:(target,key)=>key==='classList'?overlayClasses:key==='dataset'?dataset:key==='querySelector'?()=>label:Reflect.get(target,key)});
    doc.getElementById=id=>id==='battlePage'?page:id==='v141BattleTransition'?overlay:originalGet(id);
    r.run('window.__saveCalls=0;saveGame=()=>{__saveCalls++;};getExistingPartyIndexes().forEach(i=>getPartyCharacterByIndex(i).hp=0);checkBattleEnd();');
    const stale=Array.from(r.timers.values()).filter(timer=>[720,1450,2700].includes(timer.ms)).map(timer=>timer.fn);
    assert.equal(stale.length,3);
    if(stage>=720)r.presentation(720);
    if(stage>=1450){r.presentation(1450);assert.equal(label.textContent,'戰鬥失敗');}
    assert.equal(r.run("v132AbortDungeonBattle('external')"),true);
    if(stage<1450){
      dataset.v144Kind='lose';label.textContent='其他原有標記';stale[2]();
      assert.equal(dataset.v144Kind,'lose');assert.equal(label.textContent,'其他原有標記');
    }
    r.run(`window.__replacement=GameplaySystem.buildTowerWaves(1);window.__replacementStarted=v132LaunchDungeonBattle(__replacement[0],o=>__outcomes.push('new:'+o.result),${mode==='tower'?"{mode:'tower',waves:__replacement}":"{mode:'daily'}"});window.__replacementRun=v132ActiveDungeonRun;window.__replacementToken=battleToken;`);
    assert.equal(r.run('__replacementStarted'),true);
    assert.notEqual(label.textContent,'戰鬥失敗');assert.notEqual(dataset.v144Kind,'lose');
    const before=JSON.stringify({page:pageClasses.snapshot(),overlay:overlayClasses.snapshot(),label:label.textContent,dataset,saves:r.run('__saveCalls')});
    stale.forEach(fn=>fn());
    assert.equal(JSON.stringify({page:pageClasses.snapshot(),overlay:overlayClasses.snapshot(),label:label.textContent,dataset,saves:r.run('__saveCalls')}),before);
    assert.equal(r.run('battleActive && v132ActiveDungeonRun===__replacementRun && battleToken===__replacementToken'),true);
    r.enter();r.run('loseBattle()');r.presentation(2700);
    assert.deepEqual(r.json('__outcomes'),['old:external','new:lose']);
  }
});

test('Tower exit releases its guard after abort, busy entry, and callback errors',()=>{
  for(const scenario of ['abort','busy','throw']){
    const r=load();
    assert.equal(r.run(`window.__waves=GameplaySystem.buildTowerWaves(1);v132LaunchDungeonBattle(__waves[0],${scenario==='throw'?"()=>{throw new Error('fixture callback');}":"o=>__outcomes.push('old:'+o.result)"},{mode:'tower',waves:__waves})`),true);
    if(scenario==='busy'){
      r.run('loseBattle()');
      r.enter();r.run('loseBattle()');r.presentation(2700);
      assert.deepEqual(r.json('__outcomes'),['old:lose']);
      continue;
    }
    r.enter();r.run('loseBattle()');
    if(scenario==='abort'){
      const stale=Array.from(r.timers.values()).find(timer=>timer.ms===2700)?.fn;assert.ok(stale);
      assert.equal(r.run("v132AbortDungeonBattle('external')"),true);stale();
    }else{
      r.presentation(720);r.presentation(1450);
      assert.throws(()=>r.presentation(2700),/fixture callback/);
    }
    assert.equal(r.run("window.__retry=GameplaySystem.buildTowerWaves(1);v132LaunchDungeonBattle(__retry[0],o=>__outcomes.push('new:'+o.result),{mode:'tower',waves:__retry})"),true);
    r.enter();r.run('loseBattle()');assert.ok([...r.timers.values()].some(timer=>timer.ms===2700),scenario+' replacement loss scheduled');r.presentation(2700);
    assert.equal(r.json('__outcomes').at(-1),'new:lose');
  }
});

test('Tower loss callback reentry cannot release the replacement entry',async()=>{
  for(const throws of [false,true]){
    const r=load();
    assert.equal(r.run(`window.__waves=GameplaySystem.buildTowerWaves(1);v132LaunchDungeonBattle(__waves[0],()=>{__outcomes.push('old:lose');window.__retry=GameplaySystem.buildTowerWaves(1);window.__reentered=v132LaunchDungeonBattle(__retry[0],o=>__outcomes.push('new:'+o.result),{mode:'tower',waves:__retry});window.__newToken=battleToken;${throws?"throw new Error('reentry callback');":''}},{mode:'tower',waves:__waves})`),true);
    r.enter();r.run('loseBattle()');r.presentation(720);r.presentation(1450);
    if(throws)assert.throws(()=>r.presentation(2700),/reentry callback/);else r.presentation(2700);
    assert.equal(r.run('__reentered && battleActive && battleToken===__newToken'),true);
    assert.equal(r.run('FourSymbolsBattleFlow.isPresentationActive()'),true);
    assert.equal(await r.run('v141PlayEscapeBattleExit(()=>true)'),false);
    r.enter();r.run('loseBattle()');r.presentation(2700);
    assert.deepEqual(r.json('__outcomes'),['old:lose','new:lose']);
  }
});

test('Tower round-start defeat retains loss label through the entry-label callback',()=>{
  const r=load(),doc=r.c.document,originalGet=doc.getElementById.bind(doc),label={textContent:'戰'},dataset={};
  const overlay=new Proxy(originalGet('v141BattleTransition'),{get:(target,key)=>key==='dataset'?dataset:key==='querySelector'?()=>label:Reflect.get(target,key)});
  doc.getElementById=id=>id==='v141BattleTransition'?overlay:originalGet(id);
  assert.equal(r.run("window.__waves=GameplaySystem.buildTowerWaves(1);v132LaunchDungeonBattle(__waves[0],o=>__outcomes.push(o.result),{mode:'tower',waves:__waves})"),true);
  r.enter();
  const entryTimers=Array.from(r.timers.values()).filter(timer=>timer.ms===0);
  const entryLabel=entryTimers.at(-1)?.fn;
  assert.ok(entryLabel,'earlier entry label callback must be scheduled');
  r.run('getExistingPartyIndexes().forEach(i=>getPartyCharacterByIndex(i).hp=0);startTurn(battleToken)');
  assert.equal(label.textContent,'戰鬥失敗');assert.equal(dataset.v144Kind,'lose');
  assert.equal(Array.from(r.timers.values()).filter(timer=>timer.ms===0).length,entryTimers.length);
  entryLabel();
  assert.equal(label.textContent,'戰鬥失敗');assert.equal(dataset.v144Kind,'lose');
  assert.equal(r.run('v141HasTowerLossExit()'),true);
  r.presentation(2700);assert.deepEqual(r.json('__outcomes'),['lose']);
  assert.equal(r.run('v141HasTowerLossExit()'),false);
});

test('Tower label preserves accepted loss and rejects stale entry callbacks',()=>{
  for(const mode of ['tower','daily']){
    const r=load(),doc=r.c.document,originalGet=doc.getElementById.bind(doc),label={textContent:'戰'},dataset={};
    const overlay=new Proxy(originalGet('v141BattleTransition'),{get:(target,key)=>key==='dataset'?dataset:key==='querySelector'?()=>label:Reflect.get(target,key)});
    doc.getElementById=id=>id==='v141BattleTransition'?overlay:originalGet(id);
    assert.equal(r.run("window.__waves=GameplaySystem.buildTowerWaves(1);v132LaunchDungeonBattle(__waves[0],o=>__outcomes.push('old:'+o.result),{mode:'tower',waves:__waves})"),true);
    const oldEntry=Array.from(r.timers.values()).filter(timer=>timer.ms===0).at(-1)?.fn;assert.ok(oldEntry);
    assert.equal(dataset.v144Kind,'entry');
    assert.equal(r.run('loseBattle()'),false,'entry-busy Tower loss was not accepted');
    assert.equal(dataset.v144Kind,'entry');oldEntry();assert.equal(dataset.v144Kind,'entry');
    r.enter();
    const before=JSON.stringify({label:label.textContent,dataset});
    r.run('startTurn(battleToken-1)');assert.equal(JSON.stringify({label:label.textContent,dataset}),before);
    const query=r.c.v141HasTowerLossExit;r.c.v141HasTowerLossExit=undefined;
    r.run('startTurn(battleToken)');assert.equal(JSON.stringify({label:label.textContent,dataset}),before);
    r.c.v141HasTowerLossExit=query;
    assert.equal(r.run("v132AbortDungeonBattle('external')"),true);
    assert.equal(r.run(`window.__replacement=GameplaySystem.buildTowerWaves(1);v132LaunchDungeonBattle(__replacement[0],o=>__outcomes.push('new:'+o.result),${mode==='tower'?"{mode:'tower',waves:__replacement}":"{mode:'daily'}"})`),true);
    r.enter();
    const result=r.run('loseBattle()');
    assert.equal(result,mode==='tower'?true:undefined);
    assert.equal(dataset.v144Kind,'lose');const expected=label.textContent;
    oldEntry();assert.equal(dataset.v144Kind,'lose');assert.equal(label.textContent,expected);
    r.presentation(2700);assert.deepEqual(r.json('__outcomes'),['old:external','new:lose']);
    assert.equal(r.run('v141HasTowerLossExit()'),false);
  }
});

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
