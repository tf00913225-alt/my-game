const test=require('node:test');
const assert=require('node:assert/strict');
const createRuntime=require('./helpers/relic-runtime-fixture.cjs');

for(const [level,damage,hit] of [[1,8,4],[10,10,6],[20,12,8]]){
  test('Soul Bell Lv'+level+' uses per-effect final modifiers and round-end expiry',()=>{
    const r=createRuntime(),c=r.context;
    c.v174RelicSystem.getOwnedState().relic_soul_bell.level=level;
    c.v174EquipRelic('relic_soul_bell');c.startBattle();
    const enemy=r.monsters[1],boss=r.monsters[0];
    for(const round of [1,2]){
      c.turn=round;c.startTurn();
      assert.equal(c.v174RelicDamageModifiers.outgoingReduction(enemy),0);
    }
    c.turn=3;c.startTurn();
    assert.equal(c.v174RelicDamageModifiers.outgoingReduction(enemy),damage);
    assert.equal(c.v174GetRelicFinalHitReductionPercent(enemy),hit);
    assert.equal(c.v174RelicDamageModifiers.outgoingReduction(boss),damage*.8);
    assert.equal(c.v174GetRelicFinalHitReductionPercent(boss),hit*.8);
    assert.equal(enemy.attack,100);assert.equal(enemy.magicAttack,100);
    assert.equal(enemy.accuracy,100);
    assert.equal(enemy.statusEffects.filter(state=>['freeze','petrify','stun'].includes(state.type)).length,0,'no hard control');
    assert.equal(enemy.statusEffects[0].type,'relicSuppression','formal soft negative status');
    r.advanceRound();
    assert.equal(c.turn,4);
    assert.equal(c.v174RelicDamageModifiers.outgoingReduction(enemy),damage);
    r.advanceRound();
    assert.equal(c.turn,5);
    assert.equal(c.v174RelicDamageModifiers.outgoingReduction(enemy),0);
    assert.equal(c.v174GetRelicFinalHitReductionPercent(enemy),0);
  });
}
