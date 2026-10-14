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
test('overview shows only canonical owned heroes; DEV battle previews do not become owned cards',()=>{
 const {ctx:c}=runtime('dev.four-symbols-dev.pages.dev');
 assert.ok(c.getHeroPageSnapshot().heroes.every(hero=>hero.eligible&&!hero.owned));
 assert.match(c.renderHeroPageContent(),/目前沒有已擁有英雄/);
 assert.doesNotMatch(c.renderHeroPageContent(),/class="hero-card"/);
 assert.doesNotMatch(c.renderHeroPageContent(),/免費休息|休戰|heroRosterTab/);
});
function own(c){
 c.FourSymbolsHeroAcquisition={getEntitlement:id=>({heroId:id,allocationSeed:123})};
}
test('element filters share Core elements, fixed order and stable formation-first sorting',()=>{
 const {ctx:c}=runtime();own(c);
 const formation={version:2,characterIndexToSlot:{0:'ALLY_F1',1:'ALLY_F3'},heroIdToSlot:{vajraHeavenlyKing:'ALLY_B1',divineDogHongbao:'ALLY_B3'}};
 c.FourSymbolsTeamFormationPolicy=require('../functions/src/team-formation-policy');
 c.FourSymbolsTeamFormation={getConfirmed:()=>formation};
 const all=c.renderHeroPageContent();assert.ok(all.indexOf('金剛天王')<all.indexOf('神犬紅包'));
 assert.match(all,/全部[\s\S]*火[\s\S]*水[\s\S]*風[\s\S]*土/);
 c.filterHeroPage('fire');const fire=c.renderHeroPageContent();assert.match(fire,/神犬紅包/);assert.doesNotMatch(fire,/金剛天王/);
 c.filterHeroPage('water');assert.doesNotMatch(c.renderHeroPageContent(),/class="hero-card"/);
 c.filterHeroPage('all');assert.equal((c.renderHeroPageContent().match(/class="hero-card"/g)||[]).length,2);
 assert.deepEqual(Array.from(c.FourSymbolsHeroBattle.getRoster()),ids.slice().reverse());
 const css=fs.readFileSync('css/49-v169-rpg-ui.css','utf8');assert.match(css,/\.hero-card-grid\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});
test('full detail subpage preserves Core skill/stats/star controls and escapes content',()=>{
 const {ctx:c}=runtime();own(c);c.selectHeroPage(ids[0]);
 c.skillDatabase.phoenixCry.description='<img src=x onerror=alert(1)>';
 const html=c.renderHeroPageContent();assert.match(html,/hero-detail-back/);assert.match(html,/基礎戰鬥數值/);assert.match(html,/火鳳天鳴 Lv.2/);
 assert.match(html,/HeroGrowth.mutate[\s\S]*starUp/);assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(html,/<img src=x/);
 c.returnHeroOverview();assert.match(c.renderHeroPageContent(),/hero-card-grid/);
});
test('battle uses saved stable Hero IDs and projects six slots without changing Hero growth',()=>{
 const {ctx:c}=runtime();own(c);const before=JSON.stringify(c.FourSymbolsHeroSystem.getDomain().serialize());
 let projected=0;
 c.FourSymbolsTeamFormationPolicy=require('../functions/src/team-formation-policy');
 c.FourSymbolsTeamFormation={getConfirmed:()=>({heroIdToSlot:{vajraHeavenlyKing:'ALLY_F2',divineDogHongbao:'ALLY_B3'}}),projectToBattle:()=>{projected++;}};
 assert.deepEqual(Array.from(c.initializeHeroBattleCombatants(),hero=>hero.heroId),ids.slice().reverse());assert.equal(projected,1);
 assert.equal(JSON.stringify(c.FourSymbolsHeroSystem.getDomain().serialize()),before);
 assert.equal(c.FourSymbolsHeroBattle.setRoster,undefined);
});
test('both entrances share one renderer/controller; obsolete list and write handlers are retired',()=>{
 const mainCity=fs.readFileSync('js/16-stage-v54-main-city-runtime.js','utf8'),formation=fs.readFileSync('js/25-v131-fix-batch.js','utf8');
 assert.match(mainCity,/openSharedFormation/);assert.match(main,/openSharedFormation\('hero'\)/);
 assert.match(formation,/FourSymbolsTeamFormation\.save\(value\)/);assert.match(formation,/pointerdown[\s\S]*pointermove[\s\S]*pointerup[\s\S]*pointercancel/);
 assert.doesNotMatch(formation,/vFixedSelectFormationSlot|vFixedFormationSelectedCharacter/);
 assert.doesNotMatch(main,/function toggleHeroPageRoster|function moveHeroPageRoster|function resetHeroPageRoster/);
});
