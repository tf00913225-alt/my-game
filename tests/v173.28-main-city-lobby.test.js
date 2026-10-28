"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const source=read('js/16-stage-v54-main-city-runtime.js'),html=read('index.html');
function partyFixture(){
 const players=[{id:'甲'},{id:'乙'},{id:'丙'}],owned=new Set(['a','b']);let confirmed={heroIdToSlot:{b:'ALLY_B3',a:'ALLY_B1'}};
 const context={window:{FourSymbolsTeamFormation:{getConfirmed:()=>confirmed},FourSymbolsTeamFormationPolicy:require('../functions/src/team-formation-policy'),FourSymbolsHeroSystem:{getDomain:()=>({isHeroUnlocked:id=>owned.has(id),getHeroDefinition:id=>({name:id}),getHeroLevel:()=>35})}},
 getExistingPartyIndexes:()=>players.flatMap((p,i)=>p?[i]:[]),getPartyCharacterByIndex:i=>players[i],getPartyBattleStats:()=>({maxHP:600,maxSP:200})};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('    function deployedHomeParty(){'),source.indexOf('    function renderHomeRoster(){')),context);
 return {context,players,owned,setFormation:f=>confirmed=f};
}
test('city projects real player characters while leaving hero formation untouched',()=>{
 const f=partyFixture(),p=f.context.deployedHomeParty();assert.deepEqual(Array.from(p.characters,r=>r.index),[0,1,2]);assert.equal(p.heroes,undefined);
 const before=JSON.stringify(f.players);f.context.deployedHomeParty();assert.equal(JSON.stringify(f.players),before);
 f.setFormation({heroIdToSlot:{b:'ALLY_B3'}});assert.equal(f.context.deployedHomeParty().characters.length,3);
 f.context.window.FourSymbolsTeamFormation.getConfirmed=()=>{throw Error('city must not depend on hero formation');};
 assert.equal(f.context.deployedHomeParty().characters.length,3);
});
test('empty, sparse and pending formation states never create placeholder deployed actors or preview heroes',()=>{
 const f=partyFixture();f.players[1]=null;f.setFormation(null);
 assert.deepEqual(Array.from(f.context.deployedHomeParty().characters,r=>r.index),[0,2]);
 f.players.fill(null);assert.equal(f.context.deployedHomeParty().characters.length,0);
});
test('all twelve city features, story route, formation and resource identities remain unique',()=>{
 const city=html.slice(html.indexOf('<div class="home-card-grid"'),html.indexOf('id="homeRestCard"'));
 for(const action of ['character','hero','shop','quest','relic','autoBattleSettings','forge','synthesis','achievement','announcement','offlineExp','system']){
  assert.equal(city.split("openHomeFeature('"+action+"')").length-1,1,action);
 }
 for(const id of ['homeHudGoldValue','homeHudExpValue','homeBannerName'])assert.equal(html.split('id="'+id+'"').length-1,1,id);
 assert.match(source,/openSharedFormation/);assert.match(read('js/adventure/adventure-entry-v1-20260915.js'),/onclick="openAdventureMap\(\)"/);
 assert.match(source,/rosterEscape\(character.id/);assert.match(source,/getCharacterArtworkPath\(character\)/);
});
test('city remains under the original first-screen renderer and refresh bridge',()=>{
 assert.match(source,/prepareFirstScreenVisuals/);assert.match(source,/firstScreenVisualReadyPromise=null/);
 assert.doesNotMatch(source,/FourSymbolsHeroSystem|FourSymbolsTeamFormationPolicy|data-hero-position/);
 assert.doesNotMatch(source,/initializeHeroBattleCombatants|setInterval|createTreeWalker/);
});

test('renderer follows sparse player counts, real artwork selectors and clamped resource fractions without mutations',()=>{
 const f=partyFixture(),count={},scene={dataset:{}},roster={dataset:{},querySelector:()=>count,querySelectorAll:()=>[],insertAdjacentHTML:(_,html)=>roster.html=html};
 Object.assign(f.context,{firstScreenVisualReadyPromise:null,ensureHomeRosterShell:()=>roster,syncRosterResource:()=>{},syncHomeRelicSummary:()=>{},rosterNumber:n=>Number(n)||0,rosterEscape:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),document:{getElementById:id=>id==='homePartyScene'?scene:null},elementDatabase:{fire:{},water:{},wind:{}}});
 const main=read('js/00-main.js');vm.runInContext(main.slice(main.indexOf('function getCharacterArtworkPath('),main.indexOf('function getCharacterDisplayNameByIndex(')),f.context);
 vm.runInContext(source.slice(source.indexOf('    function renderHomeRoster(){'),source.indexOf('    window.v54RenderHomeRoster=')),f.context);
 Object.assign(f.players[0],{id:'甲<"',gender:'male',element:'fire',hp:300,sp:120,level:40});
 Object.assign(f.players[1],{gender:'female',element:'water',hp:900,sp:-5});
 Object.assign(f.players[2],{gender:'male',element:'wind',hp:600,sp:200});
 const before=JSON.stringify(f.players);f.context.renderHomeRoster();
 assert.equal(scene.dataset.partySize,'3');assert.equal(count.textContent,'角色 3 人');
 for(const path of ['player_male_01','player_female_02','player_male_03'])assert.ok(scene.innerHTML.includes(path+'.webp'));assert.doesNotMatch(scene.innerHTML,/battle_(?:male|female)_/);
 assert.equal((scene.innerHTML.match(/<figure/g)||[]).length,3);assert.doesNotMatch(scene.innerHTML,/assets\/heroes/);
 assert.match(roster.html,/aria-valuenow="300" aria-valuetext="HP 300 \/ 600"/);assert.match(roster.html,/width:50%/);
 assert.match(roster.html,/aria-valuenow="0" aria-valuetext="SP 0 \/ 200"/);assert.match(roster.html,/甲&lt;&quot;/);
 assert.equal(JSON.stringify(f.players),before);
 f.players[1]=null;f.context.renderHomeRoster();assert.equal(scene.dataset.partySize,'2');assert.match(scene.innerHTML,/character:2/);
 f.players[2]=null;f.context.renderHomeRoster();assert.equal(scene.dataset.partySize,'1');
 f.players[0]=null;f.context.renderHomeRoster();assert.equal(scene.innerHTML,'');assert.equal(count.textContent,'角色 0 人');
});
