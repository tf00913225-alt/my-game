import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {loadLegacyRuntime} from '../scripts/monster-balance-shadow-matrix.mjs';

// Exercise the final production wrapper chain and actual inventory writer.
// noRewards suppresses unrelated gold RNG; material-drop behavior is unchanged.
function fixture(){
 const {context}=loadLegacyRuntime();
 const run=source=>vm.runInContext(source,context);
 const json=source=>JSON.parse(run(`JSON.stringify(${source})`));
 run(`saveGame=()=>{};updateUI=()=>{};updateMonsterUI=()=>{};
  rebuildInventorySlots=()=>{window.__rebuilds++;};
  addBattleLog=message=>window.__logs.push(message);window.audioEngine={play:()=>{}};
  window.__logs=[];window.__rebuilds=0;currentZone='zone1';window.v132ActiveDungeonRun=null;inventoryItems.length=0;`);
 function kill({rank='regular',samples=[],full=false,dungeon=null,zone='zone1'}={}){
  context.__input={rank,full,dungeon,zone};
  run(`window.__logs=[];window.__rebuilds=0;currentZone=__input.zone;window.v132ActiveDungeonRun=__input.dungeon;
   inventoryItems.splice(0,inventoryItems.length,...(__input.full?Array.from({length:120},(_,i)=>({id:'occupied-'+i,type:'material',count:1})):[]));
   monsters=[{name:'drop parity',rank:__input.rank,v141BattleRank:__input.rank,alive:true,hp:1,sp:0,noRewards:true,level:1}];currentBattleMonsters=[0];`);
  const draws=[];
  context.Math.random=()=>{
   assert.ok(draws.length<samples.length,'unexpected RNG draw in final killMonster chain');
   draws.push({alive:run('monsters[0].alive'),inventory:json('inventoryItems.map(row=>row.id)'),dungeon:run('window.v132ActiveDungeonRun')});
   return samples[draws.length-1];
  };
  run('killMonster(0)');
  assert.equal(draws.length,samples.length,'all and only expected samples consumed');
  assert.ok(draws.every(draw=>draw.alive===false),'drops draw after core death settlement');
  assert.equal(run('window.v132ActiveDungeonRun'),dungeon,'temporary elite isolation restores original run');
  return {draws,items:json('inventoryItems.map(({id,count})=>({id,count}))'),logs:json('__logs'),rebuilds:run('__rebuilds')};
 }
 return {kill,run};
}

test('fully loaded regular kill samples four independent five-percent drops in inventory order',()=>{
 const f=fixture(),mixed=f.kill({samples:[0,.049999,.05,.99]});
 assert.deepEqual(mixed.items,[{id:'freezeTalismanLow',count:1},{id:'stealthTalismanLow',count:1}]);
 assert.deepEqual(mixed.draws.map(draw=>draw.inventory),[[],['freezeTalismanLow'],['freezeTalismanLow','stealthTalismanLow'],['freezeTalismanLow','stealthTalismanLow']]);
 assert.equal(mixed.rebuilds,1);
 assert.deepEqual(f.kill({samples:[0,0,0,0]}).items.map(row=>row.id),['freezeTalismanLow','stealthTalismanLow','barrierTalismanLow','oreLow']);
});

test('fully loaded elite kill rolls once, preserves legacy cumulative boundaries, and excludes normal drops',()=>{
 const f=fixture();
 for(const [sample,id] of [[.005,'ticketSetFire'],[.015,'ticketSetWater'],[.025,'ticketSetEarth'],[.035,'ticketSetWind'],[.065,'freezeTalismanMid'],[.115,'stealthTalismanMid'],[.165,'barrierTalismanMid'],[.03,'ticketSetEarth'],[.04,'ticketSetWind'],[.19,'barrierTalismanMid']]){
  const result=f.kill({rank:'elite',samples:[sample]});
  assert.deepEqual(result.items,[{id,count:1}],`legacy sample ${sample}`);
  assert.deepEqual(result.draws[0].inventory,[]);assert.equal(result.draws[0].dungeon,null,'elite sample occurs after isolation unwinds');assert.equal(result.rebuilds,1);
 }
 assert.deepEqual(f.kill({rank:'elite',samples:[.5]}).items,[]);
});

test('actual dungeon run suppresses both drop pools without consuming drop RNG',()=>{
 const f=fixture();
 for(const rank of ['regular','elite']){
  const result=f.kill({rank,dungeon:{mode:'material'},zone:'dungeon'});
  assert.deepEqual(result.items,[]);assert.equal(result.rebuilds,0);
 }
});

test('capacity failure consumes original draws without successful drop feedback or inventory changes',()=>{
 const f=fixture(),normal=f.kill({full:true,samples:[0,0,0,0]});
 assert.equal(normal.items.length,120);assert.equal(normal.rebuilds,0);
 assert.ok(normal.items.every(row=>row.id.startsWith('occupied-')));assert.ok(!normal.logs.some(log=>log.includes('掉落了')));
 const elite=f.kill({rank:'elite',full:true,samples:[0]});
 assert.deepEqual(elite.items,normal.items);assert.equal(elite.rebuilds,0);
 assert.ok(elite.logs.some(log=>log.includes('背包已滿')));assert.ok(!elite.logs.some(log=>log.includes('掉落了')));
});
