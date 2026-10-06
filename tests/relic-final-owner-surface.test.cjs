const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const createRuntime=require('../scripts/test-helpers/relic-runtime-fixture.cjs');
const main=fs.readFileSync('js/00-main.js','utf8'),vfx=fs.readFileSync('js/39-v143-skill-animation.js','utf8'),skills=fs.readFileSync('js/43-v149-skill-ui-rules.js','utf8');
const old=fs.readFileSync('tests/hit-evasion-final-percent-status-formula-20260923.test.js','utf8');
const extract=new Function('assert','main',old.slice(old.indexOf('function sourceFunction('),old.indexOf('function formulaRuntime('))+';return sourceFunction;')(assert,main);
function setup(id,level=20){
    const r=createRuntime({}),c=r.context;c.v174RelicDevUnlock(id);c.v174RelicSystem.getOwnedState()[id].level=level;c.v174EquipRelic(id);c.startBattle();return r;
}
test('every final catalog entry has actual effects, scalars and level-sensitive player text',()=>{
    const r=createRuntime({}),c=r.context,catalog=c.v174RelicSystem.catalog;
    assert.equal(Object.keys(catalog).length,20);
    for(const def of Object.values(catalog)){
        assert.equal(def.runtimeReady,true,def.id);
        assert.ok(Object.keys(def.scalars).length);assert.ok(def.triggers.length);assert.ok(def.limitText);assert.ok(def.triggerText);assert.ok(Object.keys(def.nextText).length);
        assert.ok(def.triggers.every(trigger=>trigger.effects.length&&trigger.effects.every(effect=>effect.sourceType==='relic')));
        for(const level of [1,10,20]){const text=c.v174RelicSystem.getCurrentEffectText(def.id,level);assert.ok(text.length>10);assert.doesNotMatch(text,/NaN|undefined|尚未開放|待確認|受7次|受8次/);}
    }
    assert.match(c.v174RelicSystem.getCurrentEffectText('relic_red_sky_war_mark',1),/傷害\+6%/);
    assert.match(c.v174RelicSystem.getCurrentEffectText('relic_red_sky_war_mark',20),/傷害\+10%/);
});
test('Battle Status owner displays relic names, exact numbers, charges and next-action duration',()=>{
    const r=setup('relic_qinglan_feather'),c=r.context;
    c.RAW_STATUS_VISUALS={shield:{iconSrc:'shield.webp'}};
    vm.runInContext(extract(vfx,'normalizedStatusEntry'),c);
    let entry=c.normalizedStatusEntry(r.party[0].activeBuffs[0],'buff');
    assert.equal(entry.name,'青嵐');assert.match(entry.effect,/最終閃避 \+12%/);assert.match(entry.effect,/最終異常抗性 \+12%/);assert.equal(entry.turnsLeft,3);
    const armor={sourceType:'relic',type:'relicArmor',statusName:'岩甲',charges:2,damageReductionPercent:12,turnsLeft:Number.MAX_SAFE_INTEGER};
    entry=c.normalizedStatusEntry(armor,'buff');assert.match(entry.effect,/剩餘 2 層/);assert.match(entry.effect,/直接傷害 -12%/);
    entry=c.normalizedStatusEntry({sourceType:'relic',type:'relicBuff',statusName:'乘風',untilNextAction:true,evasionPercent:10,turnsLeft:Number.MAX_SAFE_INTEGER},'buff');assert.equal(entry.remainingText,'至下一次行動開始');
});
test('relic execute kill does not become the active skill follow-up owner defeat condition',()=>{
    const r=setup('relic_burning_star_mark'),c=r.context;c.numeric=value=>Number(value)||0;
    vm.runInContext(extract(skills,'snapshotHasDefeat'),c);
    const enemy=r.monsters[1];enemy.hp=1100;
    c.settleBattleHpDamage(enemy,800,{attacker:r.party[0],sourceType:'activeSkill'});
    assert.equal(enemy.hp,0);assert.equal(c.snapshotHasDefeat([{wasAlive:true,monster:enemy}]),false);
    r.monsters[2].hp=100;c.settleBattleHpDamage(r.monsters[2],100,{attacker:r.party[0],sourceType:'activeSkill'});
    assert.equal(c.snapshotHasDefeat([{wasAlive:true,monster:r.monsters[2]}]),true);
});
test('Boss HP setter receives the whole packet before absorption and preserves actual HP loss',()=>{
    const r=createRuntime(),c=r.context;let hp=50,shield=100;
    const enemy={maxHP:50};Object.defineProperty(enemy,'hp',{get:()=>hp,set:value=>{let packet=hp-value;const absorbed=Math.min(packet,shield);shield-=absorbed;hp=Math.max(0,hp-(packet-absorbed));}});
    assert.equal(c.settleBattleHpDamage(enemy,120,{sourceType:'relic',damageKind:'relic'}),20);
    assert.equal(shield,0);assert.equal(hp,30);
});
test('single-target presentation pins the actual executed target even when it is killed',()=>{
    const r=setup('relic_broken_army_scroll'),c=r.context;r.monsters[2].hp=100;
    c.settleBattleHpDamage(r.monsters[3],2000,{attacker:r.party[0],sourceType:'activeSkill'});
    assert.equal(r.monsters[2].hp,0);
    assert.equal(c.FourSymbolsCombatEvents.lastDamageFor(r.monsters[2]).sourceType,'relic');
    assert.equal(c.v174RelicDebugState().totalTriggers,1);
    assert.ok(fs.readFileSync('js/60-team-relic-system.js','utf8').includes('override:payload&&payload.presentationTarget'));
});
