import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),model=require('../functions/src/equipment-reforge');
const progression=fs.readFileSync('js/equipment-progression.js','utf8');
const forge=fs.readFileSync('js/36-v141-content-systems.js','utf8');
const format=vm.runInNewContext(forge.match(/const STAT_LABEL=\{[^;]+;/)[0]+forge.slice(forge.indexOf('    function reforgeSlotText('),forge.indexOf('    window.FourSymbolsReforge='))+';reforgeSlotText');
function detail(item){
 const rows=[];const c={window:{FourSymbolsEquipmentReforge:model,FourSymbolsReforge:{slotCount:model.slotCount,slots:model.slots,reason:()=>'',slotText:format}},
  escapeHtml:String,isEquipmentInventoryType:type=>type==='armor',document:{getElementById:()=>({querySelectorAll:()=>[],insertAdjacentHTML:(_,html)=>rows.push(html)})}};
 vm.runInNewContext(progression.slice(progression.indexOf('    function remainingReforgeSlots('),progression.indexOf('    function configureEquipmentChestModal(')),c);
 c.window.v17346AppendReforgeMarkers(item);
 return {rows,remaining:c.window.v17346RemainingReforgeSlots(item)};
}
test('backpack shows canonical slots separately, counts only empty slots and never rewrites data',()=>{
 for(const item of [
  {type:'armor',rarityKey:'purple',reforgeAffixes:[{stat:'attack',value:18},null]},
  {type:'armor',rarityKey:'white',reforgeStats:{accuracy:0.5,attack:-3}},
  {type:'armor',rarityKey:'four-symbol',reforgeAffixes:[{stat:'attack',value:40},null,{stat:'attack',value:38},null,{stat:'vitality',value:0}]}]){
  const before=JSON.stringify(item),slots=model.slots(item),view=detail(item);
  assert.equal(view.remaining,slots.filter(a=>a===null).length);
  assert.equal(view.rows.length,slots.length);
  slots.forEach((a,i)=>assert.ok(view.rows[i].includes(a?String(a.value):'[可冶煉]')));
  const html=vm.runInNewContext(forge.slice(forge.indexOf('        const affixes=currentEntries.map('),forge.indexOf('        const actions=pending?'))+';affixes',
   {currentEntries:slots,reforgeSlotText:format,escapeHtml:String,lockSet:new Set(),pending:null});
  assert.equal((html.match(/data-reforge-slot=/g)||[]).length,slots.length);
  slots.forEach(a=>assert.ok(html.includes(format(a))));
  assert.equal(JSON.stringify(item),before);
 }
 assert.deepEqual(detail({type:'potion',rarityKey:'white'}),{rows:[],remaining:0});
});
