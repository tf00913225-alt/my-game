"use strict";
const fs=require("fs"),vm=require("vm"),assert=require("node:assert/strict");
const summarySource=fs.readFileSync("js/relic-summary-catalog.js","utf8");
const source=fs.readFileSync("js/60-team-relic-system.js","utf8");
assert.match(summarySource,/FourSymbolsRelicSummaryCatalog/,"hardening harness must load the formal first-screen relic summary bridge before the full relic runtime");

const createRuntime=require('../scripts/test-helpers/relic-runtime-fixture.cjs');
function make(){ const r=createRuntime();return {c:r.context,party:r.party,monsters:r.monsters,setMode(){},setDamage:r.setEnemyDamage}; }

{
 const r=make(); r.c.v174EquipRelic("relic_qinglan_feather");r.c.startBattle();assert.equal(r.c.v174RelicDebugState().relicId,"relic_qinglan_feather","canonical round-start creates battle state immediately");r.c.startTurn(r.c.battleToken);r.c.turn=2;r.c.startTurn(r.c.battleToken);assert.equal(r.c.v174RelicDebugState().triggerCounts["relic_qinglan_feather:battle_start"],1,"battle_start relic triggers exactly once");r.c.loseBattle();
}
{
 const r=make();r.c.v174EquipRelic("relic_sun_orb");r.c.startBattle();r.c.turn=2;r.monsters.forEach(m=>m.hp=2000);r.c.startTurn(r.c.battleToken);const after=r.monsters[1].hp;r.c.v174RelicDebugDispatch("round_start",{sourceType:"system"});assert.equal(r.monsters[1].hp,after,"duplicate round boundary cannot trigger twice");r.c.loseBattle();
}
{
 const r=make();r.c.v174EquipRelic("relic_tiangang_banner");r.c.startBattle();r.party[0].activeBuffs=[{type:"shield",turnsLeft:9,remaining:1000,amount:1000}];r.setMode("shield");r.setDamage(10);for(let i=0;i<6;i++)r.c.processSingleMonsterAttack(1);assert.ok(r.monsters.some(m=>m.hp<2000),"fully shielded effective attacks still count once per enemy action");r.c.loseBattle();
}
{
 const r=make();r.c.v174EquipRelic("relic_cold_spring_jade");r.party[0].hp=400;r.setDamage(100);r.c.startBattle();r.c.processSingleMonsterAttack(1);assert.equal(r.c.v174RelicDebugState().totalTriggers,1);r.party[0].hp=300;r.c.turn=4;r.setDamage(10);r.c.processSingleMonsterAttack(1);assert.equal(r.c.v174RelicDebugState().totalTriggers,1,"staying below 35 percent does not retrigger without a fresh crossing");r.party[0].hp=400;r.c.turn=4;r.setDamage(100);r.c.processSingleMonsterAttack(1);assert.equal(r.c.v174RelicDebugState().totalTriggers,2,"a fresh crossing after the three-round cooldown triggers the second emergency heal");r.party[0].hp=400;r.c.turn=8;r.c.processSingleMonsterAttack(1);assert.equal(r.c.v174RelicDebugState().totalTriggers,2,"the formal two-trigger battle cap remains enforced");r.c.loseBattle();
}
{
 const r=make();r.c.v174EquipRelic("relic_nine_dragon_fire");r.monsters[1].frozen=true;r.c.startBattle();for(let i=0;i<7;i++)r.c.processSingleMonsterAttack(1);assert.equal(r.c.v174RelicDebugState().enemyActionCount,0,"hard-controlled full skips do not count as enemy actions");r.monsters[1].frozen=false;for(let i=0;i<7;i++)r.c.processSingleMonsterAttack(1);assert.equal(r.c.v174RelicDebugState().enemyActionCount,0,"seven effective actions trigger and reset the counter");assert.ok(r.monsters.some(m=>m.hp<2000));r.c.loseBattle();
}
assert.match(source,/formalMaterialSource:null/);assert.match(source,/boundaryEvents:\{\}/);
assert.match(source,/combatEvents.subscribe\("hp_damage"/);assert.match(source,/previousHpPercent/);
console.log("✓ relic hardening tests passed");
