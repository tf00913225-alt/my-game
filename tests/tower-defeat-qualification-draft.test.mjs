import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Isolated draft predicate only: no run identity, persisted terminal or retirement.
const source=fs.readFileSync('js/gameplay-boss-tower-system.js','utf8');
const start=source.indexOf('    function isValidTowerDefeatedParty(');
const end=source.indexOf('    function startTowerFloor(',start);
assert.ok(start>=0&&end>start);
const draft=vm.runInNewContext(source.slice(start,end)+'\nisValidTowerDefeatedParty');

test('draft accepts only nonempty unique existing party members with finite nonpositive HP',()=>{
  const party=[{hp:0},{hp:-1}];
  assert.equal(draft([0,1],i=>party[i]),true);
  assert.equal(draft([0],i=>party[i]),true);
  assert.equal(draft([3,4,5],()=>({hp:0})),true);
  assert.equal(draft([6],()=>({hp:0})),false);
  for(const indexes of [[],[0,0],[-1],[1.5],[NaN],['0'],null]){
    assert.equal(draft(indexes,i=>party[i]),false,String(indexes));
  }
  for(const character of [undefined,null,{hp:1},{hp:NaN},{hp:Infinity},{hp:-Infinity},{hp:'0'},{}]){
    assert.equal(draft([0],()=>character),false,String(character));
  }
  assert.equal(draft([0],()=>{throw Error('lookup failed');}),false);
  assert.deepEqual(party,[{hp:0},{hp:-1}]);
});

test('draft predicate has no runtime caller or export',()=>{
  assert.equal((source.match(/isValidTowerDefeatedParty\s*\(/g)||[]).length,1);
  assert.doesNotMatch(source,/window\.isValidTowerDefeatedParty/);
});
