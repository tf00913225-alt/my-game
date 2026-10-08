'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../functions/src/hero-core');
const main=fs.readFileSync('js/00-main.js','utf8');
const adapter=main.slice(main.indexOf('let heroAccountState='),main.indexOf('\n});',main.indexOf('let heroAccountState='))+4);
const roster=main.slice(main.indexOf('// Battle-only roster.'),main.indexOf('function getCharacterArtworkPath('));
const ids=['divineDogHongbao','vajraHeavenlyKing'];
function runtime(hostname){
 const ctx={location:{hostname},FourSymbolsHeroCore:core,player:{id:'p',level:30},player2:null,player3:null,
  skillDatabase:{phoenixCry:{},windHowlLightning:{}},calculateCharacterBaseStats:()=>({maxHP:100,maxSP:50}),battleActive:false};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(adapter+'\n'+roster,ctx);return ctx;
}
test('exact DEV host gets both formal heroes in the default battle roster without canonical ownership',()=>{
 const c=runtime('dev.four-symbols-dev.pages.dev'),before=JSON.stringify(c.FourSymbolsHeroSystem.getDomain().serialize());
 const first=c.initializeHeroBattleCombatants();
 assert.deepEqual(Array.from(first,h=>h.heroId),ids);
 assert.ok(first.every(h=>h.combatantKind==='heroNpc'&&h.level===30&&h.rage===0));
 const projection=c.FourSymbolsHeroSystem.getDomain({forBattle:true}).serialize();
 assert.equal(JSON.stringify(c.FourSymbolsHeroSystem.getDomain().serialize()),before);
 assert.equal(vm.runInContext('JSON.stringify(heroAccountState)',c),before,'actual save source stays locked');
 assert.deepEqual(c.FourSymbolsHeroSystem.getDomain({forBattle:true}).serialize(),projection,'preview seed is stable');
 c.FourSymbolsHeroBattle.setRoster([ids[1]]);assert.equal(c.initializeHeroBattleCombatants().length,1);
 c.FourSymbolsHeroBattle.useUnlockedRoster();assert.equal(c.initializeHeroBattleCombatants().length,2);
 c.location.hostname='tf00913225-alt.github.io';assert.equal(c.initializeHeroBattleCombatants().length,0);
});
for(const host of ['tf00913225-alt.github.io','four-symbols-dev.pages.dev','other.four-symbols-dev.pages.dev','dev.four-symbols-dev.pages.dev.evil.invalid','localhost','127.0.0.1','']){
 test('no automatic heroes on '+(host||'missing host'),()=>{
  const c=runtime(host);assert.equal(c.initializeHeroBattleCombatants().length,0);
  assert.throws(()=>c.FourSymbolsHeroBattle.setRoster(ids),/locked/);
 });
}
test('owned progression and account replacement remain canonical; only locked heroes receive preview access',()=>{
 const c=runtime('dev.four-symbols-dev.pages.dev');
 let state=c.FourSymbolsHeroSystem.getDomain().unlockHeroDirect(ids[0],123);
 state=core.createDomain(state,()=>[c.player],c.calculateCharacterBaseStats,()=>null).addSpecificFragments(ids[0],50);
 state=core.createDomain(state,()=>[c.player],c.calculateCharacterBaseStats,()=>null).starUpHero(ids[0]);
 c.FourSymbolsHeroSystem.replaceAccountState(state);
 assert.deepEqual(c.FourSymbolsHeroSystem.getDomain({forBattle:true}).getHeroAccountState(ids[0]),state.heroes[ids[0]]);
 assert.equal(c.FourSymbolsHeroSystem.getDomain().isHeroUnlocked(ids[1]),false);
 c.FourSymbolsHeroSystem.replaceAccountState(core.normalizeAccountState());
 assert.equal(c.FourSymbolsHeroSystem.getDomain().isHeroUnlocked(ids[0]),false);
 assert.equal(c.initializeHeroBattleCombatants().length,2);
});
