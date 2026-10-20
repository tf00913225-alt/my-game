const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/00-main.js','utf8');

function harness(){
    const declarations=source.slice(source.indexOf('const battleInputGuideHolds='),source.indexOf('let battleInputResumeToken='));
    const method=source.slice(source.indexOf('        acquireInputGuideHold(owner){'),source.indexOf('        isAutoBattle(){'));
    const interval=source.match(/timerId\s*=\s*setInterval\(\(\)=>\{[\s\S]*?\},1000\);/)[0];
    const context={battleActive:true,battleToken:1,token:1,timer:3,timerId:null,updates:0,timeouts:0,clears:0,
        setInterval(fn){context.tick=fn;return 1;},clearInterval(){context.clears++;},
        updateTimer(){context.updates++;},timeoutTurn(){context.timeouts++;},
        updateActionHudVisibility(){throw Error('A countdown hold must not change HUD visibility.');}};
    vm.createContext(context);
    vm.runInContext(declarations+'\nglobalThis.flow={'+method+'};',context);
    const start=()=>vm.runInContext(interval,context);
    start();
    return {context,start};
}

test('input guide waits without decrementing declaration time, then preserves normal timeout',()=>{
    const {context:c}=harness(),release=c.flow.acquireInputGuideHold('adventure');
    for(let i=0;i<20;i++)c.tick();
    assert.equal(c.timer,3);assert.equal(c.updates,0);assert.equal(c.timeouts,0);
    release();release();
    for(let i=0;i<3;i++)c.tick();
    assert.equal(c.timer,0);assert.equal(c.updates,3);assert.equal(c.timeouts,1);
});

test('holds have independent lifecycles and an old battle cannot hold a new token',()=>{
    const {context:c,start}=harness();
    const old=c.flow.acquireInputGuideHold('old-battle');
    c.battleToken=2;c.token=2;start();c.tick();assert.equal(c.timer,2);
    const first=c.flow.acquireInputGuideHold('first'),second=c.flow.acquireInputGuideHold('second');
    old();first();c.tick();assert.equal(c.timer,2);
    second();c.tick();assert.equal(c.timer,1);
    c.battleActive=false;c.tick();assert.equal(c.clears,1);assert.equal(c.timer,1);
});

test('an inactive battle cannot pre-acquire a hold for the next battle',()=>{
    const {context:c}=harness();c.battleActive=false;
    const release=c.flow.acquireInputGuideHold('inactive');
    c.battleActive=true;c.tick();assert.equal(c.timer,2);release();release();
});
