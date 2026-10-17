const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const main=fs.readFileSync(path.join(root,'js/00-main.js'),'utf8');
function source(name,next){const start=main.indexOf('function '+name+'(');const end=main.indexOf(next,start);assert.ok(start>=0&&end>start);return main.slice(start,end);}

test('battle and patrol logs are removed while the round has one surviving DOM owner',()=>{
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    assert.doesNotMatch(html,/battleInfoToggle|id="battleInfo"|mapBattleInfo|mapBattleOverlay|battle-info-region/);
    assert.equal((html.match(/id="battleTurnIndicator"/g)||[]).length,1);
    assert.match(html,/id="battleActionRegion"[\s\S]*?<div id="battleTurnIndicator">第 1 回合<\/div>[\s\S]*?id="turnTargetRow"/);
    assert.doesNotMatch(main,/setBattleInfoExpanded|toggleBattleInfoPanel|fillBattleInfoGap/);
});

test('battle reset needs no removed DOM and delivers queued internal notices only once',()=>{
    const turn={textContent:'第 9 回合'};
    const notices=['回復 HP 20','回復 SP 10'];
    const delivered=[];
    const context={window:{v17342PendingBattleNotices:notices},$:id=>id==='battleTurnIndicator'?turn:null,addBattleLog:message=>delivered.push(message)};
    vm.createContext(context);
    vm.runInContext(source('clearBattleLog','function updateActionHudVisibility'),context);
    context.clearBattleLog();
    assert.equal(turn.textContent,'第 1 回合');
    assert.deepEqual(delivered,['回復 HP 20','回復 SP 10']);
    assert.equal(notices.length,0);
    context.clearBattleLog();
    assert.equal(delivered.length,2);
    context.$=()=>null;
    assert.doesNotThrow(()=>context.clearBattleLog());
});

test('combat observer delegation survives without allocating or accessing log DOM',()=>{
    const context={document:new Proxy({}, {get(){throw Error('retired UI accessed');}})};
    vm.createContext(context);
    vm.runInContext(source('addBattleLog','function updatePlayerHeader'),context);
    const base=context.addBattleLog;
    const observed=[];
    context.addBattleLog=function(message){observed.push(message);return base.apply(this,arguments);};
    assert.doesNotThrow(()=>context.addBattleLog('萬象土盾反彈20點傷害給敵方。'));
    assert.deepEqual(observed,['萬象土盾反彈20點傷害給敵方。']);
});
