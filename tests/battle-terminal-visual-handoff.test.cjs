'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const main=fs.readFileSync('js/00-main.js','utf8');
const bridge=fs.readFileSync('js/37-v142-skill-animation.js','utf8');
const declaration=name=>{const m=main.match(new RegExp('^function '+name+'\\([\\s\\S]*?^\\}','m'));assert.ok(m,name);return m[0];};
function fixture(){
    let now=0,id=0;const timers=new Map(),wins=[],party=[{hp:100}],enemies=[{hp:0,alive:true}];
    const noop=()=>{};
    const c={console,Promise,Math,Map,Set,Number,Array,Object,Date:{now:()=>now},
        setTimeout(fn,delay){timers.set(++id,{fn,at:now+delay});return id;},clearTimeout:key=>timers.delete(key),clearInterval:noop,
        document:{hidden:false,addEventListener:noop,removeEventListener:noop,getElementById:()=>null},addEventListener:noop,
        skillDatabase:{flameSlash:{id:'flameSlash',name:'火焰斬',element:'fire',category:'physical',targetType:'single'},
            explosiveFlurry:{id:'explosiveFlurry',name:'火爆亂擊',element:'fire',category:'physical',targetType:'tri'},
            phoenixCry:{id:'phoenixCry',name:'火鳳天鳴',element:'fire',category:'magic',targetType:'all'}},
        battleActive:true,battleToken:7,battleWaveState:null,battlePhase:'resolve',initiativeIndex:0,turn:1,activeBattleCharacterIndex:0,
        battleAdvanceScheduled:false,battleAdvanceTimeoutId:null,battleTerminalPresentationToken:null,timerId:null,POST_ACTION_DELAY_MS:650,
        getExistingPartyIndexes:()=>[0],getPartyCharacterByIndex:i=>party[i],currentBattleMonsters:[0],monsters:enemies,
        killMonster:i=>{enemies[i].alive=false;},winBattle:()=>{wins.push(now);c.battleActive=false;},loseBattle:()=>{c.battleActive=false;c.lost=true;},
        battleStatisticsFinishAction:noop,interceptBattleActionFinish:()=>false,notifyBattleActionFinished:noop,finishBattleDurationAction:noop,
        clearBattleTargetSelectionMode:noop,isBattleWaveTransition:()=>false,processNextCombatant:()=>{c.advanced=true;},showSkillNameBadge:noop};
    c.window=c;vm.createContext(c);
    for(const name of ['requestBattleWaveTransition','getBattleAdvanceDelay','checkBattleEnd','finishPlayerAction'])vm.runInContext(declaration(name),c);
    vm.runInContext(bridge,c);
    const advance=target=>{while(true){const job=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!job)break;now=job[1].at;timers.delete(job[0]);job[1].fn();}now=target;};
    const play=id=>c.v142SkillAnimationDirector.play(c.v142GetSkillAnimationConfig(id),{key:id,side:'player',render:false});
    return {c,wins,party,enemies,timers,advance,play};
}
for(const [skill,duration] of [['flameSlash',760],['explosiveFlurry',1450],['phoenixCry',3200]]){
    test(skill+' terminal death waits for actual V142 lifetime and unchanged post-action beat',()=>{
        const f=fixture(),gate=f.play(skill);f.c.finishPlayerAction();f.c.finishPlayerAction();
        assert.equal(f.enemies[0].alive,false,'death commits immediately');assert.equal(f.wins.length,0);
        assert.equal(gate.done,false,'terminal recheck cannot dispose a living visual');assert.equal(f.c.initiativeIndex,0);
        assert.equal(f.timers.size,2,'one V142 deadline and one core handoff');
        f.advance(duration);assert.equal(gate.done,true);assert.equal(f.wins.length,0);
        assert.equal(f.c.checkBattleEnd(),true);assert.equal(f.wins.length,0,'re-entry cannot skip the beat');
        f.advance(duration+649);assert.equal(f.wins.length,0);f.advance(duration+650);
        assert.deepEqual(f.wins,[duration+650]);assert.equal(f.c.advanced,undefined);
        f.c.checkBattleEnd();assert.equal(f.wins.length,1);
    });
}
test('late visual start is remeasured without a renderer Promise or duplicate victory',()=>{
    const f=fixture(),gate=f.play('flameSlash');f.c.finishPlayerAction();f.advance(700);gate.restartVisualTimeline(1450);
    f.advance(1410);assert.equal(f.wins.length,0);assert.equal(gate.done,false);
    f.advance(2799);assert.equal(f.wins.length,0);f.advance(2800);assert.deepEqual(f.wins,[2800]);
});
test('cancelled presentation releases by bounded existing handoff',()=>{
    const f=fixture(),gate=f.play('phoenixCry');f.c.finishPlayerAction();gate.complete('dispose');f.advance(3850);assert.equal(f.wins.length,1);
});
test('obsolete battle callback cannot win the next battle',()=>{
    const f=fixture();f.play('phoenixCry');f.c.finishPlayerAction();f.c.battleToken++;f.advance(5000);assert.equal(f.wins.length,0);
});
test('DOT or relic terminal boundary without active VFX adds no invented action',()=>{
    const f=fixture();assert.equal(f.c.checkBattleEnd(),true);assert.deepEqual(f.wins,[0]);assert.equal(f.timers.size,0);
});
test('completed action without active VFX retains exactly the formal 650ms beat',()=>{
    const f=fixture();f.c.finishPlayerAction();f.advance(649);assert.equal(f.wins.length,0);f.advance(650);assert.deepEqual(f.wins,[650]);
});
test('MISS with a surviving enemy continues the same action queue',()=>{
    const f=fixture();f.enemies[0].hp=100;const gate=f.play('flameSlash');f.c.finishPlayerAction();
    assert.equal(f.c.initiativeIndex,1);f.advance(1410);assert.equal(gate.done,true);assert.equal(f.c.advanced,true);assert.equal(f.wins.length,0);
});
test('defeat keeps priority and its existing immediate decision',()=>{
    const f=fixture();f.play('flameSlash');f.party[0].hp=0;assert.equal(f.c.checkBattleEnd(),true);assert.equal(f.c.lost,true);assert.equal(f.wins.length,0);
});
test('a pending ordinary declaration timer does not block a settled terminal boundary',()=>{
    const f=fixture();f.c.battlePhase='declare';f.c.battleAdvanceScheduled=true;
    f.c.battleAdvanceTimeoutId=f.c.setTimeout(()=>{},250);
    assert.equal(f.c.checkBattleEnd(),true);assert.deepEqual(f.wins,[0]);
});
test('terminal visual handoff replaces an unrelated ordinary declaration timer',()=>{
    const f=fixture();f.c.battlePhase='declare';f.c.battleAdvanceScheduled=true;
    f.c.battleAdvanceTimeoutId=f.c.setTimeout(()=>{f.c.unrelatedDeclarationRan=true;},250);
    f.play('flameSlash');f.c.checkBattleEnd();f.advance(1410);
    assert.equal(f.c.unrelatedDeclarationRan,undefined);assert.deepEqual(f.wins,[1410]);
});
test('an obsolete terminal callback cannot clear the next battle handoff',()=>{
    const f=fixture();f.play('flameSlash');f.c.finishPlayerAction();
    const stale=f.timers.get(f.c.battleAdvanceTimeoutId).fn;
    f.c.battleToken++;f.c.battleTerminalPresentationToken=f.c.battleToken;f.c.battleAdvanceTimeoutId=999;
    stale();assert.equal(f.c.battleAdvanceScheduled,true);assert.equal(f.c.battleAdvanceTimeoutId,999);
    assert.equal(f.c.battleTerminalPresentationToken,f.c.battleToken);assert.equal(f.wins.length,0);
});
