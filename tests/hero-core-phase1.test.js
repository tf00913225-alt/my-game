"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
require("../js/hero-core.js");
const core=globalThis.FourSymbolsHeroCore;
const ids=core.listHeroDefinitions().map(x=>x.heroId);
const id=ids[0];
assert.equal(ids.length,2);
assert.deepEqual(core.listHeroDefinitions().map(x=>[x.name,x.element,x.archetype,x.rageSkillId]),[["神犬紅包","fire","magic","phoenixCry"],["金剛天王","wind","magic","windHowlLightning"]]);
assert.equal(core.getHeroDefinition(ids[1]).acquisition.kind,"cumulativeLoginDay");
assert.equal(core.getHeroDefinition(ids[1]).passive.target,"livingAllyLowestAbsoluteCurrentHp");
assert.ok(Object.isFrozen(core.getHeroDefinition(id).passive));
assert.throws(()=>core.getHeroDefinition("unknown"));
for(const weights of Object.values(core.weights)){assert.equal(Object.values(weights).reduce((a,b)=>a+b,0),100);}
assert.deepEqual(Object.keys(core.weights),["physical","magic"]);
let characters=[{id:"first",level:50}];
let state=core.normalizeAccountState();
const skills={phoenixCry:{id:"phoenixCry",burnChance:20},windHowlLightning:{id:"windHowlLightning",requires:"x"}};
const before=JSON.stringify(skills);
const main=fs.readFileSync("js/00-main.js","utf8");
const statSource=main.slice(main.indexOf("function calculateCharacterBaseStats("),main.indexOf("function getPlayerDefenseDownPercent("));
const constants=main.slice(main.indexOf("const BASE_PHYSICAL_ATTACK"),main.indexOf("const BASE_PHYSICAL_ATTACK")+800).split("\n").filter(line=>/^const (BASE_|ATTACK_PER_|MAGIC_ATTACK_PER_|DEFENSE_PER_|HP_PER_)/.test(line)).join("\n");
const ctx=vm.createContext({getEffectivePlayerAbilityPoints:(c,b,key)=>Number(c[key]||0)});
vm.runInContext(constants+"\n"+statSource,ctx);
const domain=()=>core.createDomain(state,()=>characters,ctx.calculateCharacterBaseStats,key=>skills[key]);
for(const [rows,expected] of [[[50],50],[[50,40],40],[[50,40,null],40],[[80,70,25],25]]){
    characters=rows.map((level,index)=>level===null?null:{id:String(index),level});assert.equal(domain().getHeroLevel(id),expected);
}
for(const [level,points] of [[1,0],[10,45],[90,445]]){characters=[{id:"p",level}];assert.equal(domain().getHeroTotalAllocatablePoints(id),points);}
assert.deepEqual([0,1,2,3,4].map(n=>domain().getHeroStarCost(n)),[25,50,75,100,150]);
assert.equal(domain().getHeroStarCost(5),null);assert.throws(()=>domain().getHeroStarCost(6));
assert.equal(domain().canUnlockHero(id),false);
state=domain().addSpecificFragments(id,500);
state=domain().unlockHero(id,12345);
assert.equal(state.heroes[id].specificFragments,400);
assert.throws(()=>domain().unlockHero(id,22));
characters=[{id:"p",level:1}];
for(let star=1;star<=5;star++){state=domain().starUpHero(id);assert.equal(state.heroes[id].stars,star);assert.equal(domain().getHeroTotalAllocatablePoints(id),star*15);}
assert.equal(state.heroes[id].specificFragments,0);assert.equal(domain().canStarUpHero(id),false);assert.throws(()=>domain().starUpHero(id));
characters=[{id:"p",level:80}];
const high=domain().getHeroAllocatedStats(id);
assert.deepEqual(high,domain().getHeroAllocatedStats(id));
assert.equal(Object.values(high).reduce((a,b)=>a+b,0),470);
characters.push({id:"new",level:25});
const low=domain().getHeroAllocatedStats(id);
assert.equal(Object.values(low).reduce((a,b)=>a+b,0),195);
for(const key of Object.keys(low)){assert.ok(low[key]<=high[key]);}
characters.pop();assert.deepEqual(domain().getHeroAllocatedStats(id),high);
assert.equal(domain().canReroll(id,0),false);assert.throws(()=>domain().rerollHeroAllocation(id,42,0));
state=domain().rerollHeroAllocation(id,42,1);assert.notDeepEqual(domain().getHeroAllocatedStats(id),high);
const points=domain().getHeroAllocatedStats(id);
assert.deepEqual(domain().getHeroBaseStats(id),ctx.calculateCharacterBaseStats({level:80,...points},{}));
for(const [level,skillLevel] of [[1,1],[9,1],[10,2],[20,3],[80,9],[90,10],[100,10]]){characters=[{id:"p",level}];assert.equal(domain().getHeroSkillLevel(id),skillLevel);assert.equal(domain().getHeroSkillProjection(id).level,skillLevel);}
assert.strictEqual(domain().getHeroSkillProjection(id).definition,skills.phoenixCry);assert.equal(JSON.stringify(skills),before);
const serialized=JSON.parse(JSON.stringify(domain().serialize()));
assert.deepEqual(core.normalizeAccountState(serialized),state);
for(const key of ["exp","level","skillLevel","rage","maxHP","attack","passiveStacks"]){assert.equal(Object.hasOwn(serialized.heroes[id],key),false);}
serialized.heroes[id].rage=12;serialized.heroes[id].level=99;
assert.deepEqual(core.normalizeAccountState(serialized),state);
assert.throws(()=>core.normalizeAccountState({schemaVersion:2,heroes:{}}));
assert.throws(()=>core.normalizeAccountState({...state,heroes:{...state.heroes,[id]:{...state.heroes[id],stars:6}}}));
const legacy={player:{id:"legacy",level:50},gold:123,inventoryItems:[{id:"gear"}],characterSkillLoadouts:{fire:{skillLevels:{phoenixCry:2}}}};
const legacyBytes=JSON.stringify(legacy);
// Execute the real hydrate extension boundary before any player mutation.
const hydrateStart=main.indexOf("const hydratedHeroAccount=");
const hydrateEnd=main.indexOf("        Object.assign(",hydrateStart);
const hydrate=vm.createContext({window:{FourSymbolsHeroCore:core},data:legacy,heroAccountState:state});
vm.runInContext(main.slice(hydrateStart,hydrateEnd),hydrate);
assert.deepEqual(hydrate.heroAccountState,core.normalizeAccountState());assert.equal(JSON.stringify(legacy),legacyBytes);
const reload=vm.createContext({window:{FourSymbolsHeroCore:core},data:{...legacy,heroAccount:state},heroAccountState:null});
vm.runInContext(main.slice(hydrateStart,hydrateEnd),reload);
assert.deepEqual(reload.heroAccountState,state);
assert.match(main,/heroAccount:window\.FourSymbolsHeroCore\.normalizeAccountState\(heroAccountState\)/);
assert.ok(hydrateStart<main.indexOf("            data.player",hydrateStart));
assert.match(fs.readFileSync("scripts/build-production.mjs","utf8"),/"js\/hero-core.js",\s*"js\/00-main.js"/);
assert.equal(core.contract.rage.persisted,false);assert.equal(core.contract.runtimeReady,false);
assert.doesNotMatch(fs.readFileSync("js/hero-core.js","utf8"),/localStorage|document\.|Date\.now|Math\.random/);
console.log("PASS Hero Phase 1: registry, level, stats, fragments/stars, deterministic allocation, skills, legacy hydration and canonical roundtrip");
