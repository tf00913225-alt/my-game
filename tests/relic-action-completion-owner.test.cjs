const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const main=fs.readFileSync('js/00-main.js','utf8');
function declaration(name){const m=main.match(new RegExp('^function '+name+'\\([\\s\\S]*?^\\}','m'));assert.ok(m,name);return m[0];}
test('formal Action completion waits for captured follow-ups and then holds newly-triggered relic presentation once',()=>{
    const timers=[],action={token:7,index:0,entity:{hp:100},entry:{type:'monster'}};
    const c={window:null,console,Math,Number,Object,Array,Set,Map,battleDurationAction:action,
        combatEventObservers:new Map(),battleActionFinishObservers:new Set(),battleActionFinishInterceptors:[],
        battleActive:true,battleToken:7,battlePhase:'resolve',turn:1,initiativeIndex:0,
        battleAdvanceScheduled:false,battleAdvanceTimeoutId:null,timerId:null,
        battleStatisticsFinishAction(){},clearInterval(){},clearBattleTargetSelectionMode(){},
        checkBattleEnd:()=>false,getBattleAdvanceDelay:()=>0,setTimeout:fn=>{timers.push(fn);return timers.length;}};
    c.window=c;vm.createContext(c);
    for(const name of ['emitCombatEvent','notifyBattleActionFinished','interceptBattleActionFinish','finishBattleDurationAction','finishPlayerAction'])vm.runInContext(declaration(name),c);
    let captured=true,presentation=false,completions=0;
    c.battleActionFinishInterceptors.push(()=>presentation,()=>captured);
    c.combatEventObservers.set('action_finished',new Set([()=>{completions++;presentation=true;} ]));
    c.finishPlayerAction();assert.equal(completions,0);assert.equal(action.completed,undefined);assert.equal(c.initiativeIndex,0);
    captured=false;c.finishPlayerAction();assert.equal(completions,1);assert.equal(action.completed,true);assert.equal(c.initiativeIndex,0);assert.equal(timers.length,0);
    presentation=false;c.finishPlayerAction();assert.equal(completions,1);assert.equal(c.battleDurationAction,null);assert.equal(c.initiativeIndex,1);assert.equal(timers.length,1);
    c.finishPlayerAction();assert.equal(completions,1);assert.equal(c.initiativeIndex,1);assert.equal(timers.length,1);
});
test('successful escape publishes Battle End for normal and dungeon routes; failed escape preserves state',async()=>{
    for(const dungeon of [false,true])for(const succeeds of [false,true]){
        let state={enemyActions:6},ends=0,finishes=0,aborts=0;
        const c={window:null,Math:Object.assign(Object.create(Math),{random:()=>succeeds?0:1}),Promise,
            timerId:null,monsters:[{alive:true,level:1}],currentBattleMonsters:[0],player:{level:1},
            battleActive:true,autoBattle:true,actionReady:true,pendingAction:{},battleAdvanceTimeoutId:null,
            battleAdvanceScheduled:false,battleToken:1,
            clearInterval(){},getPartyCharacterByIndex:()=>null,addBattleLog(){},
            finishPlayerAction(){finishes++;},clearBattleRoundPrompt(){},clearBattleActionWatchdog(){},
            finishBattleStatisticsSession(){},closeMenus(){},showPage(){},setMapCooldown(){},
            startMonsterMovement(){},ensureAutoPatrolInterval(){},
            emitCombatEvent(type,payload){assert.equal(type,'battle_end');assert.equal(payload.result,'escape');state=null;ends++;},
            v132ActiveDungeonRun:dungeon?{}:null,v132AbortDungeonBattle(){aborts++;c.battleActive=false;}};
        c.window=c;vm.createContext(c);vm.runInContext(declaration('resolveEscapeAttempt'),c);
        c.resolveEscapeAttempt(0);await new Promise(resolve=>setImmediate(resolve));
        assert.equal(ends,succeeds?1:0);assert.equal(state===null,succeeds);
        assert.equal(finishes,succeeds?0:1);assert.equal(aborts,dungeon&&succeeds?1:0);
        assert.equal(c.battleActive,!succeeds);
    }
});
