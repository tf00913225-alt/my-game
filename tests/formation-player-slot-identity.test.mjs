import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Policy=require('../functions/src/team-formation-policy');

test('formation keeps canonical player slot identity across an empty middle character slot',async()=>{
 const players=[{id:'甲'},null,{id:'丙'}];
 let confirmed={version:2,characterIndexToSlot:{0:'ALLY_F1',2:'ALLY_F3'},heroIdToSlot:{}};
 const calls=[];
 const c={battleActive:false,getCharacters:()=>players.filter(Boolean),getPartyCharacterByIndex:i=>players[i],
  getExistingPartyIndexes:()=>[0,2],heroPageHtml:String,getCharacterBattleArtworkPath:()=>'',
  fixedBattlefieldSlots:()=>({allySlots:Policy.slots}),
  document:{getElementById:()=>null},
  FourSymbolsTeamFormation:{getConfirmed:()=>structuredClone(confirmed),getStatus:()=>({ready:true,busy:false,pending:null,playerIndexes:[0,2]}),
   save:async value=>{Policy.validate(value,[0,2],[]);calls.push(value);confirmed=structuredClone(value);return true;}}};
 c.window=c;vm.createContext(c);
 const source=fs.readFileSync('js/25-v131-fix-batch.js','utf8');
 vm.runInContext(source.slice(source.indexOf('    let formationSelectedUnit='),source.indexOf('    function applyPlayerElementFrames()')),c);
 assert.equal(await c.vFixedPlaceFormationUnit('player:2','ALLY_F1'),true);
 assert.equal(calls.length,1,'legal swap must reach the protected save owner');
 assert.deepEqual(JSON.parse(JSON.stringify(confirmed.characterIndexToSlot)),{0:'ALLY_F3',2:'ALLY_F1'});
});
