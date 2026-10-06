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