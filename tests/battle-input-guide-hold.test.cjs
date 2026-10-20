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

test('tutorial launch projects every party member to manual without saving over auto preferences',()=>{
    const dungeon=fs.readFileSync('js/27-v132-content-expansion.js','utf8');
    const extract=name=>{const start=source.indexOf('function '+name+'(');return source.slice(start,source.indexOf('\nfunction ',start+1));};
    const launch=dungeon.slice(dungeon.indexOf('        autoBattle=window.v132ActiveDungeonRun.tutorial?'),dungeon.indexOf('        syncBattleAutoSettings();',dungeon.indexOf('        autoBattle=window.v132ActiveDungeonRun.tutorial?')));
    const c={window:null,autoBattle:true,battleActive:true,battleToken:7,
        autoConfig:{enabled:true,skill:'flameSlash'},autoConfig2:{enabled:true,skill:'waterArrow'},autoConfig3:{enabled:true,skill:'normal'},
        HERO_BASIC_ATTACK_CONFIG:{enabled:true,skill:'normal'},getPartyCharacterByIndex:()=>({hp:100}),syncs:0};
    c.window=c;c.v132ActiveDungeonRun={mode:'adventure',tutorial:true};
    c.v131SyncElementBoxForBattle=()=>{c.syncs++;};vm.createContext(c);
    vm.runInContext(extract('getPartyAutoConfig')+extract('autoActionForCharacter')+extract('toggleAutoBattle'),c);
    const preferences=JSON.stringify([c.autoConfig,c.autoConfig2,c.autoConfig3]);
    vm.runInContext(launch,c);assert.equal(c.autoBattle,false);assert.equal(c.syncs,1);
    for(let index=0;index<6;index++){
        assert.equal(c.getPartyAutoConfig(index).enabled,false);
        c.autoActionForCharacter(index,7); // Would require action/runtime dependencies if it attempted an auto action.
    }
    c.toggleAutoBattle();assert.equal(c.autoBattle,false);
    assert.equal(JSON.stringify([c.autoConfig,c.autoConfig2,c.autoConfig3]),preferences);
    const save=source.slice(source.indexOf('function saveGame('),source.indexOf('function loadGame('));
    for(const field of ['autoConfig','autoConfig2','autoConfig3'])assert.match(save,new RegExp(field+':\\s*'+field+'\\s*,'));
    assert.doesNotMatch(save,/\bautoBattle\s*:/,'transient manual mode is not a persisted preference');
    c.v132ActiveDungeonRun=null;
    assert.equal(c.getPartyAutoConfig(0),c.autoConfig);assert.equal(c.getPartyAutoConfig(1),c.autoConfig2);
    assert.equal(c.getPartyAutoConfig(2),c.autoConfig3);
    c.v132ActiveDungeonRun={mode:'adventure',tutorial:false};vm.runInContext(launch,c);
    assert.equal(c.autoBattle,true);assert.equal(c.syncs,2);
    for(let index=0;index<6;index++)assert.equal(c.getPartyAutoConfig(index).enabled,true);
    assert.equal(JSON.stringify([c.autoConfig,c.autoConfig2,c.autoConfig3]),preferences);
});

test('tutorial synchronization pauses only Element Box activity and its toggle adapter refuses preference changes',()=>{
    const elementBox=fs.readFileSync('js/25-v131-fix-batch.js','utf8');
    const start=elementBox.indexOf('    function syncElementBoxForBattle(options){');
    const sync=elementBox.slice(start,elementBox.indexOf('    window.v131SyncElementBoxForBattle=',start));
    const toggleStart=elementBox.indexOf('        toggleAutoBattle=function(){');
    const toggle=elementBox.slice(toggleStart,elementBox.indexOf('\n        };',toggleStart)+11);
    const c={window:null,elementBoxActive:true,elementBoxLastTick:0,Date,
        autoBattle:false,autoConfig:{enabled:true},autoConfig2:{enabled:true},autoConfig3:{enabled:true},
        elementBoxState:{remainingMs:12345},
        hasAnyAutoBattleEnabled:()=>true,persistElementBoxState(){throw Error('tutorial must not rewrite persisted state');},
        originalToggleAutoBattle(){throw Error('tutorial must not toggle preferences');}};
    c.window=c;c.v132ActiveDungeonRun={tutorial:true};vm.createContext(c);vm.runInContext(sync+toggle,c);
    const before=JSON.stringify([c.autoConfig,c.autoConfig2,c.autoConfig3,c.elementBoxState]);
    assert.equal(c.syncElementBoxForBattle({silent:true}),false);assert.equal(c.elementBoxActive,false);
    assert.ok(c.elementBoxLastTick>0);assert.equal(c.toggleAutoBattle(),false);
    assert.equal(JSON.stringify([c.autoConfig,c.autoConfig2,c.autoConfig3,c.elementBoxState]),before);
});
