"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const gear=fs.readFileSync('js/equipment-progression.js','utf8');
const ui=fs.readFileSync('js/51-v169-rpg-ui.js','utf8');
const repoSource=fs.readFileSync('js/startup/account-save-repository.js','utf8');
const content=fs.readFileSync('js/27-v132-content-expansion.js','utf8');
const inventoryEnd='    window.v132RunInventoryTransaction=runInventoryTransaction;';
const inventoryOwner=content.slice(content.indexOf('    function getItemInventoryCapacity('),content.indexOf(inventoryEnd)+inventoryEnd.length);
function fixture(seed=new Map(),uid='shop-A'){
 let failKey=null,day='2026-10-06',success=0,reenter=null;
 const store={getItem:k=>seed.get(k)??null,setItem(k,v){if(k===failKey)throw Error('quota');seed.set(k,String(v));},removeItem:k=>seed.delete(k)};
 const body={innerHTML:'',querySelector:()=>true};
 class Clock extends Date{constructor(...args){super(...(args.length?args:[day+'T12:00:00']));}}
 const c=vm.createContext({console:{error(){}},localStorage:store,Date:Clock,setTimeout(){},alert(){},gold:100000,inventoryItems:[],
  document:{readyState:'loading',addEventListener(){},getElementById:id=>id==='homeFeatureModalBody'?body:null,querySelector:()=>null,createElement:()=>({}),head:{appendChild(){}}},
  isEquipmentInventoryType:t=>['head','shoulder','armor','shoes','weapon'].includes(t),cloneInventoryStackItem:(d,n)=>({...d,count:n}),INVENTORY_MAX_STACK_DEFAULT:999,
  renderShopContent(){return c.FourSymbolsEquipmentShop.render();}
 });c.window=c;
 vm.runInContext(repoSource,c);const repo=c.FourSymbolsAccountSave;repo.activate(uid);
 c.saveGame=options=>{if(reenter){const fn=reenter;reenter=null;fn();}try{repo.writeForUid(repo.getActiveUid(),{gold:c.gold,inventoryItems:c.inventoryItems},options);return true;}catch(_){return false;}};
 c.rpgAlert=(_message,o)=>{if(o.tone==='success')success++;return Promise.resolve();};
 vm.runInContext(inventoryOwner,c);vm.runInContext(gear,c);
 const key=repo.accountKey('equipment-shop-daily');
 return {c,repo,seed,key,body,read:()=>c.FourSymbolsEquipmentShop.render(),buy:(i,id)=>c.v17346BuyEquipmentShopOffer(i,id),fail:k=>failKey=k,day:d=>day=d,reenter:fn=>reenter=fn,success:()=>success};
}
test('canonical renderer owns six deterministic art cards, stable batch IDs and no glyph fallback',()=>{
 assert.doesNotMatch(ui,/SHOP_EQUIPMENT_PREVIEW|function renderEquipmentShop|equipmentShopOffers|equipment-shop-daily/);
 assert.match(ui,/FourSymbolsEquipmentShop\.render\(\)/);
 assert.doesNotMatch(gear,/previousSwitch|previousRefresh/);
 const f=fixture(),a=f.read();assert.equal((a.match(/<img /g)||[]).length,6);assert.equal((a.match(/v169-item-art/g)||[]).length,6);assert.equal(a,f.read());
 assert.match(a,/data-offer-id="2026-10-06:0:0"/);
 const errorCode=a.match(/onerror="([^"]+)"/)[1];const art={dataset:{},setAttribute(k,v){this[k]=v;},textContent:''};new Function(errorCode).call({parentElement:art});assert.equal(art.dataset.assetState,'broken');assert.equal(art.textContent,'◇');assert.equal(art['aria-label'],'裝備圖片無法載入');
});
test('purchase once, rapid repeat and synchronous reentry, gold/inventory/save receipt agree',()=>{
 const f=fixture(),before=f.read(),cost=Number(before.match(/>([\d,]+) 金幣<\/button>/)[1].replaceAll(',',''));
 f.reenter(()=>assert.equal(f.buy(0),false));assert.equal(f.buy(0),true);for(let i=0;i<3;i++)assert.equal(f.buy(0),false);
 assert.equal(f.c.gold,100000-cost);assert.equal(f.c.inventoryItems.length,1);assert.equal(f.success(),1);assert.match(f.read(),/disabled aria-disabled="true">已購買/);
 assert.equal((f.read().match(/已購買/g)||[]).length,1);assert.equal((f.read().match(/onclick="event.stopPropagation/g)||[]).length,5);
 const reload=fixture(f.seed);assert.match(reload.read(),/已購買/);assert.equal(reload.buy(0),false);
});
test('refresh creates new batch, stale click rejected, all six available; five free limit retained',()=>{
 const f=fixture();f.buy(0);assert.equal(f.c.v17345RefreshEquipmentShop(),true);assert.doesNotMatch(f.read(),/已購買/);assert.match(f.read(),/2026-10-06:1:0/);assert.equal(f.buy(0,'2026-10-06:0:0'),false);
 assert.equal(f.buy(0,'2026-10-06:1:0'),true);for(let i=0;i<4;i++)assert.equal(f.c.v17345RefreshEquipmentShop(),true);assert.equal(f.c.v17345RefreshEquipmentShop(),false);
 f.day('2026-10-07');assert.match(f.read(),/2026-10-07:0:0/);assert.doesNotMatch(f.read(),/已購買/);
});
test('insufficient gold/full inventory never mark sold',()=>{
 const f=fixture();f.c.gold=0;assert.equal(f.buy(0),false);assert.equal(f.seed.get(f.key),undefined);f.c.gold=100000;f.c.inventoryItems=Array.from({length:120},(_,i)=>({id:'full'+i,type:'weapon',count:1}));assert.equal(f.buy(0),false);assert.equal(f.c.gold,100000);assert.equal(f.seed.get(f.key),undefined);
});
test('main, metadata or shop storage failure roll back all prior bytes, runtime and success UI',()=>{
 for(const target of ['main','metadata','shop']){
  const f=fixture();f.seed.set(f.key,JSON.stringify({date:'2026-10-06',refreshCount:0}));const before=new Map(f.seed);
  f.fail(target==='main'?f.repo.saveKey('shop-A'):target==='metadata'?f.repo.metadataKey('shop-A'):f.key);
  assert.equal(f.buy(0),false,target);assert.equal(f.c.gold,100000);assert.equal(f.c.inventoryItems.length,0);assert.equal(f.success(),0);assert.deepEqual(f.seed,before);assert.doesNotMatch(f.read(),/已購買/);
 }
});
test('corrupt shop state blocks purchase and refresh, UID B does not inherit A receipts',()=>{
 const f=fixture();f.seed.set(f.key,'{bad');assert.equal(f.buy(0),false);assert.equal(f.c.v17345RefreshEquipmentShop(),false);assert.match(f.read(),/購買與刷新已暫停/);
 const a=fixture();a.buy(0);const b=fixture(a.seed,'shop-B');assert.doesNotMatch(b.read(),/已購買/);assert.equal(b.buy(0),true);assert.equal(b.key,'four_symbols_account:shop-B:equipment-shop-daily');assert.match(fixture(a.seed).read(),/已購買/);
});
