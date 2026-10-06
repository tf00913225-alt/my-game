const test=require('node:test');
const assert=require('node:assert/strict');
const createRuntime=require('./helpers/relic-runtime-fixture.cjs');

for(const [level,shieldPercent,stance] of [[1,6,0],[10,9,6],[20,12,10]]){
  test('Xuanwu Lv'+level+' opening, source refresh, shield break and next-round expiry',()=>{
    const r=createRuntime(),c=r.context,p=r.party[0],owner=c.FourSymbolsPlayerShield;
    c.v174RelicSystem.getOwnedState().relic_xuanwu_seal.level=level;
    owner.apply(p,77,{sourceType:'skill',sourceId:'other',durationRounds:5});
    c.v174EquipRelic('relic_xuanwu_seal');c.startBattle();
    const find=()=>p.activeBuffs.find(s=>s.sourceId==='relic_xuanwu_seal');
    assert.equal(find().remaining,shieldPercent*10);
    find().remaining=1;
    c.turn=3;c.startTurn();
    assert.equal(find().remaining,shieldPercent*10,'full refresh rather than top-up');
    assert.equal(p.activeBuffs.filter(s=>s.sourceId==='relic_xuanwu_seal').length,1);
    assert.equal(p.activeBuffs.find(s=>s.sourceId==='other').remaining,77);
    assert.equal(owner.remaining(p),77+shieldPercent*10);
    assert.equal(owner.absorb(p,77+shieldPercent*10,0),0);
    assert.equal(c.v174RelicDamageModifiers.incomingReduction(p),stance);
    r.advanceRound();
    assert.equal(c.turn,4);assert.equal(c.v174RelicDamageModifiers.incomingReduction(p),stance);
    r.advanceRound();
    assert.equal(c.turn,5);assert.equal(c.v174RelicDamageModifiers.incomingReduction(p),0);
  });
}
