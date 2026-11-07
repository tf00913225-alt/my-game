import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture(){
  let uid='alice',available=true,refuse=false,entered=0;
  const player={id:'hero'},nodes=new Map();
  function node(){return {hidden:true,disabled:false,attrs:{},events:{},dataset:{},classList:{remove(){}},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.events[k]=fn;},focus(){this.focused=true;},click(){if(!this.disabled)this.events.click?.();}};}
  const root=node();root.isConnected=true;
  root.querySelector=selector=>{if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);};
  Object.defineProperty(root,'innerHTML',{set(value){this.html=value;nodes.clear();}});
  const context=vm.createContext({player,window:{addEventListener(){}},document:{createElement:()=>root,getElementById:()=>({append(){}})},showPage(){},FourSymbolsAccountSave:{getActiveUid:()=>uid},FourSymbolsTaoxiContent:{available:()=>available,village(){entered++;throw Error('scene reached');}},FourSymbolsTaoxiProgress:{create:()=>({snapshot(){if(refuse)throw Error('read refused');return {uid,player,chapter:{}};}})}});
  vm.runInContext(fs.readFileSync(new URL('../js/exploration/taoxi-ui.js',import.meta.url),'utf8'),context);
  return {root,get:selector=>root.querySelector(selector),api:context.FourSymbolsTaoxi,get entered(){return entered;},set uid(value){uid=value;},set available(value){available=value;},set refuse(value){refuse=value;}};
}

test('region click only reveals information; explicit confirmation reaches original scene',async()=>{
  const f=fixture();await f.api.open('home');
  const region=f.get('[data-village]'),info=f.get('#taoxiRegionInfo'),enter=f.get('[data-enter-village]');
  enter.click();assert.equal(f.entered,0,'hidden confirmation cannot enter');
  region.click();region.click();assert.equal(f.entered,0);assert.equal(info.hidden,false);assert.equal(region.attrs['aria-expanded'],'true');assert.equal(enter.disabled,false);
  assert.match(f.root.html,/完成前 5 關及新手教學/);
  assert.throws(()=>enter.click(),/scene reached/);assert.equal(f.entered,1);
});

test('locked region remains readable; confirmation rechecks eligibility and read failure',async()=>{
  const f=fixture();f.available=false;await f.api.open();f.get('[data-village]').click();
  assert.equal(f.get('#taoxiRegionInfo').hidden,false);assert.equal(f.get('[data-enter-village]').disabled,true);
  f.available=true;f.get('[data-village]').click();assert.equal(f.get('[data-enter-village]').disabled,false);
  f.available=false;f.get('[data-enter-village]').click();assert.equal(f.entered,0);
  f.available=true;f.get('[data-village]').click();f.refuse=true;f.get('[data-enter-village]').click();
  assert.equal(f.entered,0);assert.equal(f.get('[data-enter-village]').disabled,true);assert.equal(f.get('[data-region-status]').textContent,'read refused');
});

test('back dismisses information and stale account cannot confirm',async()=>{
  const f=fixture();await f.api.open('adventure');f.get('[data-village]').click();f.get('[data-back]').click();
  assert.equal(f.get('#taoxiRegionInfo').hidden,true);assert.equal(f.get('[data-village]').attrs['aria-expanded'],'false');assert.equal(f.get('[data-village]').focused,true);
  f.get('[data-village]').click();f.uid='bob';f.get('[data-enter-village]').click();assert.equal(f.entered,0);assert.equal(f.root.hidden,true);
});
