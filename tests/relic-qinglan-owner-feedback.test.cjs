const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const createRuntime=require('./helpers/relic-runtime-fixture.cjs');
const main=fs.readFileSync('js/00-main.js','utf8');
const existing=fs.readFileSync('tests/hit-evasion-final-percent-status-formula-20260923.test.js','utf8');
const extract=new Function('assert','main',existing.slice(existing.indexOf('function sourceFunction('),existing.indexOf('function formulaRuntime('))+';return {sourceFunction,constLine,constObject};')(assert,main);
function setup(level){
    const r=createRuntime(),c=r.context; c.Math=Object.create(Math);
    const code=['HIT_CHANCE_BASE','HIT_CHANCE_MIN_PERCENT','HIT_CHANCE_MAX_PERCENT','STATUS_OFFENSE_ATTRIBUTE_COEFFICIENT','STATUS_HIT_MIN_PERCENT','STATUS_HIT_MAX_PERCENT'].map(extract.constLine);
    code.push(extract.constObject('LOCKDOWN_HIT_BOUNDS'));
    ['calculateHitChancePercent','rollHitChance','calculateStatusEffectChance','rollStatusEffectHit'].forEach(name=>code.push(extract.sourceFunction(main,name)));
    vm.runInContext(code.join('\n'),c);
    r.feedback=[];c.FourSymbolsBattleFloatingFeedback={emit:event=>r.feedback.push(event)};
    c.v174RelicSystem.getOwnedState().relic_qinglan_feather.level=level;
    c.v174EquipRelic('relic_qinglan_feather');c.startBattle();return r;
}
for(const [level,points] of [[1,8],[10,10],[20,12]]){
    test('Qinglan Lv'+level+' uses one Hit RNG and only reports attributable misses',()=>{
        const r=setup(level),c=r.context;let calls=0;
        c.Math.random=()=>{calls++;return .9;};
        assert.equal(c.v174GetRelicFinalEvasionPercent(0),points);
        assert.equal(c.rollHitChance(0,points,0,0,r.party[0]),false);
        assert.equal(calls,1);assert.equal(r.feedback[0].text,'青嵐・迴避');
        c.Math.random=()=>{calls++;return .99;};r.feedback.length=0;
        assert.equal(c.rollHitChance(0,points,0,0,r.party[0]),false);assert.equal(calls,2);assert.equal(r.feedback.length,0);
        r.advanceRound();r.advanceRound();assert.equal(c.v174GetRelicFinalEvasionPercent(0),points);
        r.advanceRound();assert.equal(c.v174GetRelicFinalEvasionPercent(0),0);
        assert.equal(r.party[0].activeBuffs.some(buff=>buff.sourceId==='relic_qinglan_feather'),false);
    });
    test('Qinglan Lv'+level+' uses one Status RNG and respects baseline resistance and chance caps',()=>{
        const r=setup(level),c=r.context;let calls=0;
        c.Math.random=()=>{calls++;return .9;};
        const stats=c.v174ProjectRelicBattleStats(0,{statusResistance:0,resistance:0});
        assert.equal(stats.statusResistance,points);
        assert.equal(c.rollStatusEffectHit(95,30,30,0,stats.statusResistance,false,'player',0,0,r.party[0]),false);
        assert.equal(calls,1);assert.equal(r.feedback[0].text,'青嵐・抵抗');
        r.feedback.length=0;c.Math.random=()=>{calls++;return .99;};
        c.rollStatusEffectHit(95,30,30,0,points,false,'player',0,0,r.party[0]);assert.equal(calls,2);assert.equal(r.feedback.length,0);
        c.Math.random=()=>{calls++;return .7;};
        c.rollStatusEffectHit(100,30,30,0,points,true,'player',0,0,r.party[0]);assert.equal(calls,3);assert.equal(r.feedback.length,0,'the 60% hard-control cap would already resist');
    });
}
