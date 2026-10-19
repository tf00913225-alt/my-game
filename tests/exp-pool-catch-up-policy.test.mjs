import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadLegacyRuntime} from '../scripts/monster-balance-shadow-matrix.mjs';
const require=createRequire(import.meta.url);
const policy=require('../functions/src/exp-pool-catch-up-policy');
// Frozen pre-extraction js28 rules, including slot precedence over the gap.
function original(level,highest,slot){
 const safeLevel=Math.max(1,Number(level)||1);
 if(safeLevel<20){if(slot===2)return 2.00;if(slot===1)return 1.50;}
 const gap=Math.max(0,highest-Math.max(1,Number(level)||1));
 if(gap>=30)return 1.50;
 if(gap>=20)return 1.30;
 if(gap>=10)return 1.15;
 return 1.00;
}
test('shared pool policy preserves frozen gap and additional-slot boundaries, with frozen browser/CommonJS exports',()=>{
 assert.equal(Object.isFrozen(policy),true);
 for(const slot of [-1,0,1,2,3])for(const level of [0,1,9,10,18,19,19.9,20,21,70,100,'19',NaN])
  for(const highest of [1,9,10,19,20,29,30,31,39,40,49,50,100])
   assert.equal(policy.multiplierForCharacter(slot,level,highest),original(level,highest,slot));
 const context=vm.createContext({window:{}});
 vm.runInContext(fs.readFileSync(new URL('../functions/src/exp-pool-catch-up-policy.js',import.meta.url),'utf8'),context);
 assert.equal(Object.isFrozen(context.window.FourSymbolsExpPoolCatchUpPolicy),true);
 assert.equal(context.window.FourSymbolsExpPoolCatchUpPolicy.multiplierForCharacter(2,19,100),2);
});

test('final production Client uses shared pool policy with actual party identity, rounded preview costs and unchanged direct EXP',()=>{
 const {context,paths}=loadLegacyRuntime();const run=source=>vm.runInContext(source,context);
 assert.ok(paths.includes('functions/src/exp-pool-catch-up-policy.js'));
 run(`Object.assign(player,{id:'primary',level:1,exp:0,expNext:300});player2={id:'secondary',level:1,exp:0,expNext:300};player3={id:'third',level:1,exp:0,expNext:300};`);
 for(const highest of [1,10,20,30,40,100])for(const level of [1,9,19,20])for(const [slot,name] of ['player','player2','player3'].entries()){
  context.__level=level;context.__highest=highest;
  run(`player.level=__highest;player2.level=__highest;player3.level=__highest;`);
  run(`${name}.level=__level;${name}.exp=1;${name}.expNext=300;`);
  const actualHighest=run('window.v133GetHighestCreatedCharacterLevel()');
  assert.equal(run(`window.v173GetExpPoolCatchUpMultiplier(${name})`),original(level,actualHighest,slot));
  assert.equal(run(`window.v173GetDiscountedPreviewCost(${name},1)`),Math.ceil(299/original(level,actualHighest,slot)));
  assert.equal(run(`window.v173GetDirectCatchUpExpMultiplier(${name})`),level<20?slot===2?3:slot===1?2:1:1);
 }
});
