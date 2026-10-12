'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../functions/src/hero-core');
const main=fs.readFileSync('js/00-main.js','utf8');
const adapter=main.slice(main.indexOf('let heroAccountState='),main.indexOf('\n});',main.indexOf('let heroAccountState='))+4);
const roster=main.slice(main.indexOf('// Battle-only roster.'),main.indexOf('function getCharacterArtworkPath('));
const ui=main.slice(main.indexOf('// Hero page is a read-only Core projection;'),main.indexOf('function openHomeFeature(type)'));
const ids=['divineDogHongbao','vajraHeavenlyKing'];
const plain=value=>JSON.parse(JSON.stringify(value));
function runtime(hostname='production.invalid'){
 const alerts=[],ctx={location:{hostname},FourSymbolsHeroCore:core,player:{id:'p1',level:40},player2:{id:'p2',level:18},player3:null,battleActive:false,
  skillDatabase:{phoenixCry:{name:'火鳳天鳴',description:'全體燃燒'},windHowlLightning:{name:'風哮電擊',description:'單體法術'}},
  calculateCharacterBaseStats:()=>({maxHP:999,maxSP:555,attack:101,magicAttack:202,defense:303,speed:44}),
  STAT_NAMES:{attack:'攻擊',intelligence:'智力',vitality:'體質',energy:'能量',defensePoints:'防禦',agility:'敏捷'},elementDatabase:{fire:{name:'火'},wind:{name:'風'}},
  getCharacterBattleArtworkPath:actor=>actor.combatantKind==='heroNpc'?'/'+actor.heroId+'.webp':'',
  rpgAlert:message=>alerts.push(message),$:()=>null};
 ctx.window=ctx;ctx.getCharacters=()=>[ctx.player,ctx.player2,ctx.player3];vm.createContext(ctx);vm.runInContext(adapter+'\n'+roster+'\n'+ui,ctx);
 return {ctx,alerts};
}
test('production locked heroes remain browseable without unlock, stats or roster mutation',()=>{
 const {ctx:c}=runtime(),before=c.FourSymbolsHeroSystem.getDomain().serialize();
 const data=c.getHeroPageSnapshot();assert.equal(data.heroes.length,2);assert.equal(data.heroes[0].level,18);
 assert.ok(data.heroes.every(hero=>!hero.eligible&&!hero.owned&&hero.stats===null));
 assert.match(c.renderHeroPageContent(),/尚未解鎖/);assert.match(c.renderHeroPageContent(),/heroRosterToggle[^>]*disabled/);
 c.toggleHeroPageRoster(ids[0]);assert.equal(c.FourSymbolsHeroBattle.getRoster().length,0);
 assert.deepEqual(c.FourSymbolsHeroSystem.getDomain().serialize(),before);
});
test('owned progression and level/skill/base-stat projections come from formal domain',()=>{
 const {ctx:c}=runtime();let domain=c.FourSymbolsHeroSystem.getDomain();
 c.FourSymbolsHeroSystem.replaceAccountState(domain.unlockHeroDirect(ids[0],123));
 c.FourSymbolsHeroAcquisition={getEntitlement:id=>id===ids[0]?{heroId:id,allocationSeed:123}:null};
 domain=c.FourSymbolsHeroSystem.getDomain();c.FourSymbolsHeroSystem.replaceAccountState(domain.addSpecificFragments(ids[0],50));
 domain=c.FourSymbolsHeroSystem.getDomain();c.FourSymbolsHeroSystem.replaceAccountState(domain.starUpHero(ids[0]));
 const hero=c.getHeroPageSnapshot().heroes[0];assert.equal(hero.account.stars,1);assert.equal(hero.account.specificFragments,25);
 assert.equal(hero.level,18);assert.equal(hero.skill.level,2);assert.equal(hero.stats.magicAttack,202);
 assert.deepEqual(plain(hero.points),plain(c.FourSymbolsHeroSystem.getDomain().getHeroAllocatedStats(ids[0])));
 c.skillDatabase.phoenixCry.description='<img src=x onerror=alert(1)>';
 const html=c.renderHeroPageContent();assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(html,/<img src=x/);
});
test('DEV UI toggles 0/1/2 heroes, reorders and resets the same battle roster without Save changes',()=>{
 const {ctx:c}=runtime('dev.four-symbols-dev.pages.dev'),before=c.FourSymbolsHeroSystem.getDomain().serialize();
 const snapshot=c.getHeroPageSnapshot();assert.ok(snapshot.heroes.every(hero=>hero.eligible&&!hero.owned));
 const copy=c.FourSymbolsHeroBattle.getRoster();copy.length=0;assert.equal(c.FourSymbolsHeroBattle.getRoster().length,2);
 c.moveHeroPageRoster(ids[1],-1);assert.deepEqual(Array.from(c.FourSymbolsHeroBattle.getRoster()),ids.slice().reverse());
 assert.deepEqual(Array.from(c.initializeHeroBattleCombatants(),hero=>hero.heroId),ids.slice().reverse());
 c.toggleHeroPageRoster(ids[0]);assert.equal(c.initializeHeroBattleCombatants().length,1);
 c.toggleHeroPageRoster(ids[1]);assert.equal(c.initializeHeroBattleCombatants().length,0);
 c.toggleHeroPageRoster(ids[0]);assert.equal(c.initializeHeroBattleCombatants().length,1);
 c.resetHeroPageRoster();assert.equal(c.initializeHeroBattleCombatants().length,2);
 assert.deepEqual(c.FourSymbolsHeroSystem.getDomain().serialize(),before);
 c.switchHeroPageTab('roster');assert.match(c.renderHeroPageContent(),/本次登入期間有效/);
 assert.equal((c.renderHeroPageContent().match(/<li class="hero-roster-slot/g)||[]).length,3);
});
test('battle-time UI requests cannot mutate roster, actor identity or transient state',()=>{
 const {ctx:c,alerts}=runtime('dev.four-symbols-dev.pages.dev');const actors=c.initializeHeroBattleCombatants();
 actors[0].hp=12;actors[0].rage=9;c.battleActive=true;
 const before=JSON.stringify(actors);c.toggleHeroPageRoster(ids[0]);c.moveHeroPageRoster(ids[1],-1);c.resetHeroPageRoster();
 assert.equal(alerts.length,3);assert.equal(JSON.stringify(actors),before);
 assert.deepEqual(Array.from(c.FourSymbolsHeroBattle.getRoster()),ids);
 assert.match(c.renderHeroPageContent(),/戰鬥中無法更動/);assert.match(c.renderHeroPageContent(),/heroRosterToggle[^>]*disabled/);
});
test('missing created players cannot project stats or enable roster editing',()=>{
 const {ctx:c}=runtime('dev.four-symbols-dev.pages.dev');c.player=null;c.player2=null;
 const snapshot=c.getHeroPageSnapshot();assert.equal(snapshot.editingAllowed,false);assert.ok(snapshot.heroes.every(hero=>hero.stats===null&&hero.level===null));
 assert.match(c.renderHeroPageContent(),/heroRosterToggle[^>]*disabled/);
});
test('three-Hero UI capacity uses a disposable domain fixture, never the production registry',()=>{
 const {ctx:c}=runtime();const defs=core.listHeroDefinitions().concat({...core.getHeroDefinition(ids[0]),heroId:'fixtureThirdHero',name:'第三名測試英雄'});
 const domain={listHeroDefinitions:()=>defs,isHeroUnlocked:()=>true,getHeroDefinition:id=>defs.find(def=>def.heroId===id),
  getHeroAccountState:id=>({heroId:id,stars:0,specificFragments:0}),getHeroLevel:()=>18,getHeroAllocatedStats:()=>({attack:4}),
  getHeroBaseStats:c.calculateCharacterBaseStats,getHeroSkillProjection:()=>({level:2,definition:c.skillDatabase.phoenixCry})};
 c.FourSymbolsHeroSystem={getDomain:()=>domain};
 assert.equal(c.getHeroPageSnapshot().roster.length,3);assert.equal(c.initializeHeroBattleCombatants().length,3);
 c.switchHeroPageTab('roster');assert.equal((c.renderHeroPageContent().match(/<li class="hero-roster-slot/g)||[]).length,3);
 assert.match(c.renderHeroPageContent(),/第三名測試英雄/);assert.throws(()=>c.FourSymbolsHeroBattle.setRoster(defs.map(def=>def.heroId).concat('fourth')),/invalid/);
 assert.equal(core.listHeroDefinitions().length,2);
});
