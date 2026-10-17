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
test('city includes every existing player and only confirmed deployed owned heroes in formation order',()=>{
 const f=partyFixture(),p=f.context.deployedHomeParty();assert.deepEqual(Array.from(p.characters,r=>r.index),[0,1,2]);assert.deepEqual(Array.from(p.heroes,r=>r.heroId),['a','b']);
 assert.equal(p.heroes[0].character.hp,undefined,'city must not fabricate persistent Hero HP');
 const before=JSON.stringify(f.players);f.context.deployedHomeParty();assert.equal(JSON.stringify(f.players),before);
 f.setFormation({heroIdToSlot:{b:'ALLY_B3'}});assert.deepEqual(Array.from(f.context.deployedHomeParty().heroes,r=>r.heroId),['b']);
 f.owned.delete('b');assert.equal(f.context.deployedHomeParty().heroes.length,0);
});
test('empty, sparse and pending formation states never create placeholder deployed actors or preview heroes',()=>{
 const f=partyFixture();f.players[1]=null;f.setFormation(null);
 assert.deepEqual(Array.from(f.context.deployedHomeParty().characters,r=>r.index),[0,2]);assert.equal(f.context.deployedHomeParty().heroes.length,0);
 f.players.fill(null);assert.equal(f.context.deployedHomeParty().characters.length,0);
});
test('all twelve city features, story route, formation and resource identities remain unique',()=>{
 const city=html.slice(html.indexOf('<div class="home-card-grid"'),html.indexOf('id="homeRestCard"'));
 for(const action of ['character','hero','shop','quest','relic','autoBattleSettings','forge','synthesis','achievement','announcement','offlineExp','system']){
  assert.equal(city.split("openHomeFeature('"+action+"')").length-1,1,action);
 }
 for(const id of ['homeHudGoldValue','homeHudExpValue','homeBannerName'])assert.equal(html.split('id="'+id+'"').length-1,1,id);
 assert.match(source,/openSharedFormation/);assert.match(read('js/adventure/adventure-entry-v1-20260915.js'),/onclick="openAdventureMap\(\)"/);
 assert.match(source,/rosterEscape\(character.id/);assert.match(source,/getCharacterBattleArtworkPath\(character\)/);
});
test('city remains under the original first-screen renderer and refresh bridge',()=>{
 assert.match(source,/prepareFirstScreenVisuals/);assert.match(source,/firstScreenVisualReadyPromise=null/);
 assert.match(read('js/00-main.js'),/function refreshHeroPage\(preserveScroll=false\)\{\s*window.v54RenderHomeRoster\?\.\(\)/);
 assert.doesNotMatch(source,/initializeHeroBattleCombatants|setInterval|createTreeWalker/);
});
