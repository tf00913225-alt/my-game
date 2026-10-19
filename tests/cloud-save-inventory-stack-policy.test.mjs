import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),policy=require('../functions/src/inventory-stack-policy');
// Frozen non-equipment algorithm from c538b47e. It intentionally retains the
// old raw-count capacity/floored-count insertion mismatch for corrupt inputs.
function before(items,id,amount,maxStack=999){
 const quantity=Math.max(1,Math.floor(Number(amount)||1));
 const matching=items.filter(item=>item&&item.id===id);
 const free=maxStack<=1?0:matching.reduce((n,item)=>n+Math.max(0,maxStack-(Number(item.count)||0)),0);
 const capacity=free+Math.max(0,120-items.length)*maxStack;
 if(quantity>capacity)return {success:false,capacity};
 let remaining=quantity;
 if(maxStack>1)matching.forEach(stack=>{
  if(remaining<=0)return;
  const current=Math.max(0,Math.floor(Number(stack.count)||0));
  const add=Math.min(Math.max(0,maxStack-current),remaining);
  stack.count=current+add;remaining-=add;
 });
 while(remaining>0){
  if(items.length>=120)return {success:false,capacity};
  const count=Math.min(maxStack,remaining);items.push({id,count});remaining-=count;
 }
 return {success:true,capacity};
}
function apply(items,id,result){
 for(const update of result.updates)items[update.index].count=update.count;
 result.appendCounts.forEach(count=>items.push({id,count}));
 return result.success;
}
test('pure plans preserve frozen original capacity, ordering and results over coerced inputs',()=>{
 const amounts=[undefined,null,0,-1,-50,1,2,999,1000,1999,2.9,'2',NaN,Infinity];
 const counts=[undefined,0,-5,1,1.5,998,998.9,999,1000,NaN,Infinity];
 for(const length of [0,1,2,118,119,120,121])for(const count of counts)for(const amount of amounts)for(const maxStack of [100,999]){
  const items=Array.from({length},(_,index)=>index<2?{id:'target',count}:{id:'filler-'+index,count:1});
  const original=structuredClone(items),expected=structuredClone(items),actual=structuredClone(items);
  const frozen=before(expected,'target',amount,maxStack),plan=policy.plan(items,'target',amount,maxStack);
  assert.deepEqual(items,original,'planning cannot mutate input');
  assert.equal(plan.capacity,frozen.capacity);assert.equal(apply(actual,'target',plan),frozen.success);
  assert.deepEqual(actual,expected,`${length}/${count}/${amount}/${maxStack}`);
 }
});
test('full inventory can merge, valid overflow is all-or-nothing and corrupt negative counts retain late failure',()=>{
 const items=Array.from({length:120},(_,i)=>({id:i?'filler'+i:'target',count:i?1:998}));
 const merge=policy.plan(items,'target',1);assert.equal(merge.success,true);assert.deepEqual(merge.appendCounts,[]);
 const overflow=policy.plan(items,'target',2);assert.equal(overflow.canAdd,false);assert.deepEqual(overflow.updates,[]);
 items[0].count=-5;const corrupt=policy.plan(items,'target',1000);
 assert.equal(corrupt.canAdd,true);assert.equal(corrupt.success,false);
 assert.deepEqual(corrupt.updates,[{index:0,count:999}]);
 assert.equal(policy.capacity([], 'equipment',1),120);
});
function client(items=[]){
 const source=fs.readFileSync(new URL('../js/27-v132-content-expansion.js',import.meta.url),'utf8');
 const start=source.indexOf('    function getItemInventoryCapacity(');
 const end=source.indexOf('    window.v132AddItemToInventory=addItemToInventory;',start);
 const calls=[];let serial=0;
 const c=vm.createContext({inventoryItems:structuredClone(items),INVENTORY_MAX_STACK_DEFAULT:999,
  isEquipmentInventoryType:type=>type==='weapon',characterEquipment:{},
  getTicketDefinition:id=>id==='ticket'?{id,name:'formal-ticket'}:null,
  syncTicketPresentation(stack,def){calls.push(stack.count);stack.name=def.name;},
  cloneInventoryStackItem:(definition,count)=>({...definition,count}),
  FourSymbolsInventoryStackPolicy:policy,
  FourSymbolsEquipmentFactory:{create:definition=>({...definition,v141Uid:'factory-'+(++serial)})}});
 c.window=c;vm.runInContext(source.slice(start,end),c);
 return {c,calls,add:(definition,amount)=>c.addItemToInventory(definition,amount)};
}
test('actual Client adapter retains guards, visited ticket synchronization, cloning and equipment factory',()=>{
 const h=client([{id:'ticket',count:999},{id:'ticket',count:998},{id:'ticket',count:0}]);
 assert.equal(h.add({id:'ticket',type:'ticket'},1),true);
 assert.deepEqual(h.calls,[999,998]);assert.equal(h.c.inventoryItems[2].name,undefined);
 assert.equal(h.c.inventoryItems[1].count,999);
 for(const def of [null,{id:'blueprintLegacy'},{id:'hpPotion100'},{id:'x',retired:true},{id:'x',compatibilityOnly:true},{id:'x',blueprintSlot:'head'}])
  assert.equal(h.add(def,1),false);
 assert.equal(h.add({id:'material',type:'material'},1000),true);
 assert.deepEqual(Array.from(h.c.inventoryItems.slice(-2),row=>row.count),[999,1]);
 assert.equal(h.add({id:'sword',type:'weapon'},2),true);
 assert.deepEqual(Array.from(h.c.inventoryItems.slice(-2),row=>row.v141Uid),['factory-1','factory-2']);
});
test('UMD exports are frozen and planning requires no clock, RNG or storage',()=>{
 const sandbox=vm.createContext({window:{},Math:Object.assign(Object.create(Math),{random(){throw Error('RNG');}}),
  Date:class{constructor(){throw Error('clock');}static now(){throw Error('clock');}}});
 vm.runInContext(fs.readFileSync(new URL('../functions/src/inventory-stack-policy.js',import.meta.url),'utf8'),sandbox);
 const p=sandbox.window.FourSymbolsInventoryStackPolicy;
 assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.constants));
 assert.equal(p.plan([],'target',1000).appendCounts.join(','),'999,1');
});
