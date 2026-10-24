const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const main=fs.readFileSync('js/00-main.js','utf8');
const block=main.slice(main.indexOf('// A UID-local teaching checkpoint'),main.indexOf('\nfunction resumeBattleAfterPresentationLocks'));
const readers=main.slice(main.indexOf('function getBattleStatisticsOwner()'),main.indexOf('function beginBattleStatisticsSession()'));
function harness(){
    const world=[{name:'original world'}],identity={uid:'tutorial-qa',battleId:'first-battle-identity'};
    const onboarding={active:true,source:'new-character',flowVersion:3,battleId:identity.battleId};
    const player={id:'風角色',hp:80,sp:40,statusEffects:[],activeBuffs:[],isDefending:false,
        adventureProgress:{chapters:{chapter_v1:{currentNodeId:'c1_01',completedNodes:{},onboarding}}}};
    const monster={name:'攔路惡徒',portraitName:'攔路惡徒',monsterKey:'tutorial.c1_01',portraitKey:'NPC_SHARED_029',
        level:1,element:'wind',rank:'regular',mode:'tutorial',tutorialEncounter:true,hp:9,maxHP:119,sp:0,maxSP:0,
        attack:4,magicAttack:0,defense:0,agility:0,speed:0,accuracy:0,evasion:0,criticalChance:0,
        skillIds:[],skillChance:0,statusEffects:[],activeBuffs:[],alive:true,vAdventure:true,vAdventureEncounterId:'tutorial_1'};
    let declarations=0;
    const turnIndicator={textContent:'第 1 回合'};
    const entryClasses=new Set(['v141-preparing-entry']);
    const battlePage={classList:{add:name=>entryClasses.add(name),remove:(...names)=>names.forEach(name=>entryClasses.delete(name)),contains:name=>entryClasses.has(name)}};
    const statsUi={classList:{remove(){},toggle(){}},hidden:true};
    const getElementById=id=>id==='battlePage'?battlePage:['battleMechanismAlert','battleBossMechanismDrawer'].includes(id)?statsUi:null;
    const c={console:{error(){}},player,monsters:[monster],currentZone:'dungeon',currentBattleMonsters:[0],heroBattleCombatants:[],
        battleActive:true,battleToken:7,turn:2,selectedMonster:0,activeBattleCharacterIndex:0,timerId:17,battleAdvanceTimeoutId:null,battleAdvanceScheduled:false,
        battleEscapePendingToken:null,battlePresentationLocks:new Set(),battleInputGuideHolds:new Set(),
        battleAutoActionResume:null,battleInputResumeToken:null,battleResolutionResumeToken:null,activeBattleStatisticsAction:null,
        battleDurationAction:null,battlePhase:'declare',actionReady:false,pendingAction:null,resolutionPhaseStarted:false,
        turnAdvancePending:false,queuedPlayerActions:{},initiativeQueue:[{type:'player'},{type:'monster'}],initiativeIndex:2,
        processedInitiativeIndexes:new Set([0,1]),declaredCharacterIndexes:new Set([0]),battleWaveState:null,
        battleRoundBoundaryKeys:new Set(['7:round_start:1','7:round_end:1','7:round_start:2']),autoBattle:false,
        battleActionFinishObservers:new Set(),battleBeforeCombatantObservers:new Set(),battleRoundStartObservers:new Set(),
        battleRoundEndObservers:new Set(),battleActionFinishInterceptors:[],
        document:{getElementById,body:{classList:{remove(){},toggle(){}}}},
        getExistingPartyIndexes:()=>[0],getPartyCharacterByIndex:()=>player,getPartyBattleStats:()=>({maxHP:130,maxSP:60}),
        getCharacterBattleArtworkPath:()=>'',clearInterval(){},clearTimeout(){},
        clearBattleActionWatchdog(){},clearBattleRoundPrompt(){},clearBattleActionNotice(){},closeMenus(){},
        clearBattleTargetSelectionMode(){},resumeBattleAfterPresentationLocks(){},updateActionHudVisibility(){},
        renderBattle(){c.v141AfterBattleRender();},showPage(){},syncBattleAutoSettings(){},updateAutoButton(){},
        $:id=>id==='battleTurnIndicator'?turnIndicator:null,battleWaveHudText:()=>'',
        beginBattleRoundDeclaration(){declarations++;},startTurn(){throw Error('must not replay round start');},
        FourSymbolsAccountSave:{getActiveUid:()=>identity.uid},FourSymbolsStartupPolicy:{getUid:()=>identity.uid},
        FourSymbolsAdventureContent:{tutorialEncounters:{tutorial_1:{name:'攔路惡徒',hpRatio:2.05}}},
        v132ActiveDungeonRun:{mode:'adventure',tutorial:true,adventureNodeId:'c1_01',startedAt:123,
            previousMonsters:world,previousZone:'forest'},
        v132LaunchDungeonBattle(){throw Error('must not launch another battle');}};
    c.window=c;vm.createContext(c);
    const presentation=fs.readFileSync('js/35-v141-ui-battle.js','utf8');
    const after=presentation.slice(presentation.indexOf('    function v141AfterBattleRender(){'),presentation.indexOf('    // A retained declaration'));
    const adopt=presentation.slice(presentation.indexOf('    function adoptRestoredBattleEntry(token){'),presentation.indexOf('    window.v141PrepareBattleRender='));
    vm.runInContext('const startedEntryTokens=new Set();let transitionRunning=false;function decorateBattleCards(){}\n'+after+'\n'+adopt+'\nwindow.v141AfterBattleRender=v141AfterBattleRender;',c);
    vm.runInContext(fs.readFileSync('js/battle-statistics-system.js','utf8'),c);
    vm.runInContext(readers+'\n'+block,c);
    const owner=c.FourSymbolsBattleStatistics,id=c.buildBattleStatisticsCombatant(0).id;
    owner.begin({battleToken:7,combatants:[c.buildBattleStatisticsCombatant(0)]});
    owner.recordDamage({sourceId:id,amount:18});owner.recordDamage({targetId:id,amount:20});owner.recordCritical({id});
    return {c,identity,onboarding,world,turnIndicator,entryClasses,getElementById,flow:c.FourSymbolsBattleFlow,declarations:()=>declarations};
}
function suspend(h){
    assert.equal(h.flow.checkpointFirstTutorialBattle(h.identity,value=>{h.onboarding.battleCheckpoint=value;return true;},true),true);
    return h.onboarding.battleCheckpoint;
}
test('safe first-tutorial suspension persists first, preserves original roster/ledger and returns world without ending',()=>{
    const h=harness();let during;
    assert.equal(h.flow.checkpointFirstTutorialBattle(h.identity,value=>{
        during={active:h.c.battleActive,world:h.c.monsters===h.world};h.onboarding.battleCheckpoint=value;return true;
    },true),true);
    assert.deepEqual(during,{active:true,world:false});
    assert.equal(h.c.battleActive,false);assert.equal(h.c.monsters,h.world);assert.equal(h.c.currentZone,'forest');
    assert.equal(h.c.v132ActiveDungeonRun,null);assert.equal(h.c.battlePresentationLocks.size,0);
    const dto=h.onboarding.battleCheckpoint;
    assert.equal(dto.roster[0].hp,9);assert.equal(dto.turn,2);assert.equal(dto.statistics.combatants[0].damageDealt,18);
    assert.equal(dto.battleId,h.identity.battleId);assert.equal(dto.party.hp,80);
    assert.equal(h.c.FourSymbolsBattleStatistics.getSnapshot().active,true,'no fake terminal event');
});
test('save refusal/throw leaves the same live battle and grants no suspension',()=>{
    for(const callback of [()=>false,()=>{throw Error('save refused');}]){
        const h=harness(),roster=h.c.monsters;
        assert.equal(h.flow.checkpointFirstTutorialBattle(h.identity,callback,true),false);
        assert.equal(h.c.battleActive,true);assert.equal(h.c.battleToken,7);assert.equal(h.c.monsters,roster);
        assert.equal(h.c.battlePresentationLocks.size,0);assert.equal(h.onboarding.battleCheckpoint,undefined);
    }
});
test('checkpoint copies are detached and an observation-only commit does not leave the battle',()=>{
    const h=harness();let dto;
    assert.equal(h.flow.checkpointFirstTutorialBattle(h.identity,value=>{dto=value;return true;}),true);
    dto.roster[0].hp=1;dto.party.hp=1;dto.statistics.combatants[0].damageDealt=0;
    assert.equal(h.c.monsters[0].hp,9);assert.equal(h.c.player.hp,80);
    assert.equal(h.c.FourSymbolsBattleStatistics.getSnapshot().combatants[0].damageDealt,18);
    assert.equal(h.c.battleActive,true);assert.equal(h.c.battleToken,7);
});
test('only zero-pending, completed declaration boundaries of the original fresh first battle are admitted',()=>{
    const cases=[c=>c.pendingAction='normal',c=>c.actionReady=true,c=>c.battlePhase='resolve',
        c=>c.battleAdvanceScheduled=true,c=>c.battleAutoActionResume={token:7},c=>c.battleInputResumeToken=7,
        c=>c.battleResolutionResumeToken=7,c=>c.activeBattleStatisticsAction={},c=>c.battleDurationAction={completed:false},
        c=>c.resolutionPhaseStarted=true,c=>c.turnAdvancePending=true,c=>c.queuedPlayerActions={0:{type:'normal'}},
        c=>c.initiativeIndex=1,c=>c.battlePresentationLocks.add({owner:'other'}),c=>c.currentBattleMonsters=[0,1],
        c=>c.monsters[0].hp=0,c=>c.v132ActiveDungeonRun.mode='boss',c=>c.v132ActiveDungeonRun.adventureNodeId='c1_02',
        c=>c.heroBattleCombatants=[{}],c=>c.getExistingPartyIndexes=()=>[0,1],c=>c.FourSymbolsStartupPolicy.getUid=()=> 'other',
        c=>c.player.isDefending=true];
    for(const mutate of cases){const h=harness();mutate(h.c);let commits=0;
        assert.equal(h.flow.checkpointFirstTutorialBattle(h.identity,()=>{commits++;return true;},true),false);
        assert.equal(commits,0);assert.equal(h.c.battleToken,7);
    }
});
test('JSON reload resumes the same saved enemies/round/resources/statistics without launch, round replay or refilling',()=>{
    const old=harness(),dto=JSON.parse(JSON.stringify(suspend(old))),h=harness();
    h.c.battleActive=false;h.c.battleToken=0;h.c.monsters=h.world;h.c.currentZone='forest';h.c.v132ActiveDungeonRun=null;
    h.c.player.level=2;h.c.player.hp=130;h.c.player.sp=60;
    h.onboarding.battleCheckpoint=dto;let finished=0;
    assert.equal(h.flow.restoreFirstTutorialBattle(dto,h.identity,()=>finished++),true);
    assert.equal(h.c.monsters[0].hp,9);assert.equal(h.c.monsters[0].level,1);assert.equal(h.c.turn,2);
    assert.equal(h.turnIndicator.textContent,'第2回合','restored HUD projects the retained round without startTurn');
    assert.equal(h.entryClasses.has('v141-preparing-entry'),false,'restored presentation cannot leave original actors transparent');
    h.c.v141AfterBattleRender();assert.equal(h.entryClasses.has('v141-preparing-entry'),false,'ordinary redraw retains entered presentation');
    assert.equal(h.c.player.level,2);assert.equal(h.c.player.hp,80);assert.equal(h.c.player.sp,40);
    assert.equal(h.declarations(),1);assert.equal(h.c.battleToken,1);
    assert.deepEqual(Array.from(h.c.battleRoundBoundaryKeys),['1:round_start:1','1:round_end:1','1:round_start:2']);
    assert.equal(h.c.FourSymbolsBattleStatistics.getSnapshot().combatants[0].damageDealt,18);
    assert.equal(h.c.FourSymbolsBattleStatistics.getSnapshot().combatants[0].criticalHits,1);
    h.c.v132ActiveDungeonRun.onComplete({result:'win'});assert.equal(finished,1);
    assert.equal(h.flow.restoreFirstTutorialBattle(dto,h.identity,()=>{}),false,'double restore cannot replace active battle');
});
test('wrong owner, stale source/generation, corrupt or consumed checkpoints fail before activating a battle',()=>{
    const mutations=[s=>s.version=2,s=>s.uid='other',s=>s.battleId='different-battle',s=>s.sequence=0,
        s=>s.turn=Number.MAX_SAFE_INTEGER,s=>s.boundaries.pop(),s=>s.boundaries.push('round_end:2'),
        s=>s.pendingAction='normal',s=>s.roster[0].hp=NaN,s=>s.roster[0].hp=120,s=>s.roster[0].skillIds=['stormFist'],
        s=>s.party.sp=-1,s=>s.party.activeBuffs=[{type:'damageUp'}],s=>s.roster[0].statusEffects=[{type:'freeze'}],
        s=>s.statistics.combatants[0].damageDealt=Infinity,s=>s.statistics.combatants[0].id='other'];
    for(const mutate of mutations){const h=harness(),dto=suspend(h),bad=JSON.parse(JSON.stringify(dto));mutate(bad);
        h.onboarding.battleCheckpoint=bad;
        assert.equal(h.flow.restoreFirstTutorialBattle(bad,h.identity,()=>{}),false);
        assert.equal(h.c.battleActive,false);assert.equal(h.c.monsters,h.world);
    }
    for(const mutate of [h=>delete h.onboarding.battleCheckpoint,h=>h.onboarding.battleCheckpoint.sequence++,
        h=>h.c.FourSymbolsAdventureContent.tutorialEncounters.tutorial_1.hpRatio=3,
        h=>h.onboarding.active=false,h=>h.c.player.adventureProgress.chapters.chapter_v1.completedNodes.c1_01=true]){
        const h=harness(),dto=JSON.parse(JSON.stringify(suspend(h)));mutate(h);
        assert.equal(h.flow.restoreFirstTutorialBattle(dto,h.identity,()=>{}),false);assert.equal(h.c.battleActive,false);
    }
});
test('render, page, declaration or Statistics failure restores the original world/resources/ledger and permits retry',()=>{
    const failureSites=['renderBattle','showPage','beginBattleRoundDeclaration','statistics','statistics-dom'];
    for(const site of failureSites){
        const h=harness(),dto=suspend(h),c=h.c,owner=c.FourSymbolsBattleStatistics;
        owner.recordDamage({sourceId:c.buildBattleStatisticsCombatant(0).id,amount:11});
        c.player.hp=130;c.player.sp=60;c.turn=37;c.currentBattleMonsters=[3,8];c.selectedMonster=8;
        const before={ledger:JSON.stringify(owner.getSnapshot()),boundaries:c.battleRoundBoundaryKeys,
            queue:c.initiativeQueue,processed:c.processedInitiativeIndexes,declared:c.declaredCharacterIndexes,
            monsters:c.monsters,indices:c.currentBattleMonsters};
        const original=c[site];
        if(site==='statistics'){
            c.FourSymbolsBattleStatistics={...owner,restoreFirstTutorialSnapshot(){throw Error('statistics rejected');}};
        }else if(site==='statistics-dom'){
            c.document.getElementById=()=>{throw Error('statistics UI rejected');};
        }else{c[site]=()=>{throw Error(site+' rejected');};}
        assert.equal(h.flow.restoreFirstTutorialBattle(dto,h.identity,()=>{}),false,site);
        assert.equal(c.battleActive,false);assert.equal(c.v132ActiveDungeonRun,null);
        assert.equal(c.monsters,before.monsters);assert.equal(c.currentZone,'forest');
        assert.equal(c.player.hp,130);assert.equal(c.player.sp,60);assert.equal(c.turn,37);assert.equal(c.selectedMonster,8);
        assert.equal(c.currentBattleMonsters,before.indices);assert.equal(c.battleRoundBoundaryKeys,before.boundaries);
        assert.equal(c.initiativeQueue,before.queue);assert.equal(c.processedInitiativeIndexes,before.processed);
        assert.equal(c.declaredCharacterIndexes,before.declared);assert.equal(JSON.stringify(owner.getSnapshot()),before.ledger);
        assert.equal(c.battlePresentationLocks.size,0);assert.equal(h.onboarding.battleCheckpoint,dto);
        if(site==='statistics'){c.FourSymbolsBattleStatistics=owner;}
        else if(site==='statistics-dom'){c.document.getElementById=h.getElementById;}
        else{c[site]=original;}
        assert.equal(h.flow.restoreFirstTutorialBattle(dto,h.identity,()=>{}),true,'retained checkpoint remains retryable: '+site);
    }
});
test('original presentation adoption refuses inactive, stale or transitioning restore and preserves normal fresh entry',()=>{
    const h=harness();assert.equal(h.c.v141AdoptRestoredBattleEntry(6),false);
    h.c.battleActive=false;assert.equal(h.c.v141AdoptRestoredBattleEntry(7),false);h.c.battleActive=true;
    vm.runInContext('transitionRunning=true',h.c);assert.equal(h.c.v141AdoptRestoredBattleEntry(7),false);
    assert.equal(h.entryClasses.has('v141-preparing-entry'),true);
    vm.runInContext('transitionRunning=false',h.c);assert.equal(h.c.v141AdoptRestoredBattleEntry(7),true);
    assert.equal(h.entryClasses.has('v141-preparing-entry'),false);
    h.c.battleToken=8;h.c.v141AfterBattleRender();assert.equal(h.entryClasses.has('v141-preparing-entry'),true,'a genuinely new entry still uses its original presentation lifecycle');
    const refused=harness(),dto=suspend(refused);refused.c.v141AdoptRestoredBattleEntry=()=>false;
    assert.equal(refused.flow.restoreFirstTutorialBattle(dto,refused.identity,()=>{}),false);
    assert.equal(refused.c.battleActive,false);assert.equal(refused.c.monsters,refused.world);
    assert.deepEqual(refused.onboarding.battleCheckpoint,dto,'presentation refusal retains the committed checkpoint');
});
