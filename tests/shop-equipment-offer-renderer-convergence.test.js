"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const gear=fs.readFileSync('js/equipment-progression.js','utf8');
const ui=fs.readFileSync('js/51-v169-rpg-ui.js','utf8');
const repoSource=(fs.readFileSync('js/startup/account-save-repository.js','utf8')+fs.readFileSync('js/00-main.js','utf8').split('/* ACCOUNT_SAVE_OPERATIONS_OWNER_BEGIN */')[1].split('/* ACCOUNT_SAVE_OPERATIONS_OWNER_END */')[0]);
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
 });c.window=c;c.FourSymbolsEquipmentReforge=require("../functions/src/equipment-reforge");c.FourSymbolsEquipmentFactory=require("../js/equipment-factory");
 c.FourSymbolsInventoryStackPolicy=require('../functions/src/inventory-stack-policy');
 vm.runInContext(repoSource,c);const repo=c.FourSymbolsAccountSave;repo.activate(uid);
 c.saveGame=options=>{if(reenter){const fn=reenter;reenter=null;fn();}try{repo.writeForUid(repo.getActiveUid(),{gold:c.gold,inventoryItems:c.inventoryItems,...(c.player?{player:c.player}:{})},options);return true;}catch(_){return false;}};
 c.rpgAlert=(_message,o)=>{if(o.tone==='success')success++;return Promise.resolve();};
 vm.runInContext(require('../.github/scripts/fixtures/item-slot-owner.cjs'),c);
 vm.runInContext(inventoryOwner,c);vm.runInContext(gear,c);
 const key=repo.accountKey('equipment-shop-daily');
 return {c,repo,seed,key,body,read:()=>c.FourSymbolsEquipmentShop.render(),buy:(i,id)=>c.v17346BuyEquipmentShopOffer(i,id),fail:k=>failKey=k,day:d=>day=d,reenter:fn=>reenter=fn,success:()=>success};
}
test('canonical renderer owns six deterministic cards, stable batch IDs and explicit missing-art placeholders',()=>{
 assert.doesNotMatch(ui,/SHOP_EQUIPMENT_PREVIEW|function renderEquipmentShop|equipmentShopOffers|equipment-shop-daily/);
 assert.match(ui,/FourSymbolsEquipmentShop\.render\(\)/);
 assert.doesNotMatch(gear,/previousSwitch|previousRefresh/);
 const f=fixture(),a=f.read();assert.equal((a.match(/<img /g)||[]).length+(a.match(/data-asset-state="missing"/g)||[]).length,6);assert.equal((a.match(/v169-item-art/g)||[]).length,6);assert.equal(a,f.read());
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
test('approved prices agree across cards, preview, acquisition and saved inventory',()=>{
 const f=fixture(),factory=f.c.FourSymbolsEquipmentFactory;let preview='';f.c.v132ShowRewardModal=html=>preview=html;
 const cards=f.read(),offers=f.c.FourSymbolsEquipmentShop.offers();
 for(let i=0;i<offers.length;i++){
  const expected=factory.prices(offers[i]);assert.ok(cards.includes(expected.shop.toLocaleString('zh-TW')+' 金幣'));
  f.c.v17346PreviewEquipmentShopOffer(i);assert.ok(preview.includes(expected.shop.toLocaleString('zh-TW')+' 金幣'));
  const before=f.c.gold;assert.equal(f.buy(i),true);assert.equal(f.c.gold,before-expected.shop);
  const owned=f.c.inventoryItems.at(-1);assert.equal(owned.shopPrice,expected.shop);assert.equal(owned.price,expected.sell);assert.deepEqual(factory.prices(owned),expected);
  const saved=JSON.parse(f.seed.get(f.repo.saveKey('shop-A')));assert.equal(saved.inventoryItems.at(-1).price,expected.sell);
 }
});
test('refresh creates new batch, stale click rejected, all six available; unlimited free test mode',()=>{
 const f=fixture();f.buy(0);assert.equal(f.c.v17345RefreshEquipmentShop(),true);assert.doesNotMatch(f.read(),/已購買/);assert.match(f.read(),/2026-10-06:1:0/);assert.equal(f.buy(0,'2026-10-06:0:0'),false);
 assert.equal(f.buy(0,'2026-10-06:1:0'),true);for(let i=0;i<25;i++){const old=f.c.FourSymbolsEquipmentShop.offers();const money=f.c.gold;assert.equal(f.c.v17345RefreshEquipmentShop(),true);const next=f.c.FourSymbolsEquipmentShop.offers();assert.equal(next.length,6);assert.ok(next.every((item,index)=>item.v141Uid!==old[index].v141Uid));assert.notDeepEqual(next.map(x=>x.name),old.map(x=>x.name));assert.equal(f.c.gold,money);assert.equal(new Set(next.map(x=>x.name)).size,6);}assert.doesNotMatch(f.read(),/今日刷新|免費|剩|未開放|\/ 10/);
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

function equipmentLessonFixture(){
 const f=fixture(),c=f.c;
 Object.assign(c,{player:{id:'lesson-player',element:'fire',hp:100,sp:40,adventureProgress:{schemaVersion:3,pendingStoryOpening:true,activeChapterId:'chapter_v1',chapters:{}}},
  FourSymbolsStartupPolicy:{getUid:()=> 'shop-A'},setInterval:()=>1,clearInterval(){},clearTimeout(){},addEventListener(){},CustomEvent:function(){},getPotionCount:()=>0,
  getExistingPartyIndexes:()=>[0],getPartyCharacterByIndex:()=>c.player,getPartyBattleStats:()=>({maxHP:100,maxSP:40})});
 c.document.dispatchEvent=()=>{};c.document.addEventListener=()=>{};
 vm.runInContext(fs.readFileSync('js/adventure/adventure-content-v1-20260915.js','utf8'),c);
 vm.runInContext(fs.readFileSync('js/adventure/adventure-runtime-v1-20260915.js','utf8'),c);
 const state=c.player.adventureProgress.chapters.chapter_v1;
 state.currentNodeId='c1_04';state.completedNodes.c1_03=true;state.rewardClaims.c1_03='ready';
 state.onboarding={active:true,phase:'guidance',nodeId:'c1_04',requiredAction:'equipment'};
 assert.equal(c.FourSymbolsAdventure.claimNodeReward('c1_03'),true);
 return {...f,state,buyLesson:()=>c.FourSymbolsEquipmentShop.buyLessonArmor()};
}

test('lesson funding buys one exact Factory armor through the original transaction, independent of daily offers',()=>{
 const f=equipmentLessonFixture(),beforeGold=f.c.gold,originalOffers=f.c.FourSymbolsEquipmentShop.offers().map(x=>x.offerId);
 assert.equal(f.state.equipmentLessonFunding.amount,750);assert.equal(f.c.inventoryItems.length,0);
 assert.match(f.read(),/id="chapter1TutorialArmorBuy"/);
 assert.equal(f.buyLesson(),true);assert.equal(f.c.gold,beforeGold-750);assert.equal(f.c.inventoryItems.length,1);
 assert.equal(f.state.grantedEquipmentUid,f.c.inventoryItems[0].v141Uid);assert.equal(f.state.equipmentLessonPurchase.paidGold,750);
 assert.equal(f.seed.get(f.key),undefined,'permanent lesson purchase does not write daily sold receipts');
 assert.equal(f.buyLesson(),false);f.day('2026-10-07');assert.equal(f.buyLesson(),false);
 assert.equal(f.repo.readForUid('shop-A').save.player.adventureProgress.chapters.chapter_v1.equipmentLessonPurchase.equipmentUid,f.state.grantedEquipmentUid);
 assert.equal(originalOffers.length,6);assert.equal(f.c.FourSymbolsEquipmentShop.offers().length,6);
});

test('lesson purchase refusal or exception restores gold, inventory and the exact Adventure root',()=>{
 for(const mode of ['false','throw','full','stale']){
  const f=equipmentLessonFixture(),root=f.c.player.adventureProgress,before=JSON.stringify(root),money=f.c.gold;
  if(mode==='false')f.fail(f.repo.saveKey('shop-A'));
  if(mode==='throw')f.c.saveGame=()=>{throw Error('denied');};
  if(mode==='full')f.c.inventoryItems=Array.from({length:120},(_,i)=>({id:'full'+i,type:'weapon',count:1}));
  if(mode==='stale')f.repo.activate('shop-B');
  const inventory=JSON.stringify(f.c.inventoryItems);
  assert.equal(f.buyLesson(),false,mode);assert.equal(f.c.gold,money);assert.equal(JSON.stringify(f.c.inventoryItems),inventory);
  assert.equal(f.c.player.adventureProgress,root);assert.equal(JSON.stringify(root),before);
 }
});

test('an old gifted armor never becomes new funding or a second lesson purchase',()=>{
 const f=fixture(),gift=f.c.FourSymbolsEquipmentFactory.starter('leatherArmor');
 const raw={schemaVersion:3,activeChapterId:'chapter_v1',chapters:{chapter_v1:{storySchemaVersion:2,storyKeys:{},dialogue:null,currentNodeId:'c1_04',completedNodes:{c1_01:true,c1_02:true,c1_03:true},rewardClaims:{c1_03:'claimed'},branchSelections:{},chapterCompleted:false,chapterRewardClaimed:false,grantedEquipmentUid:gift.v141Uid,onboarding:{active:true,phase:'guidance',nodeId:'c1_04',requiredAction:'equipment'}}}};
 Object.assign(f.c,{player:{id:'old-gift-owner',element:'fire',hp:100,sp:40,adventureProgress:JSON.parse(JSON.stringify(raw))},FourSymbolsStartupPolicy:{getUid:()=> 'shop-A'},setInterval:()=>1,clearInterval(){},clearTimeout(){},addEventListener(){},CustomEvent:function(){}});
 f.c.document.dispatchEvent=()=>{};vm.runInContext(fs.readFileSync('js/adventure/adventure-content-v1-20260915.js','utf8'),f.c);vm.runInContext(fs.readFileSync('js/adventure/adventure-runtime-v1-20260915.js','utf8'),f.c);
 const state=f.c.FourSymbolsAdventure.getChapterState(),money=f.c.gold;
 assert.equal(state.grantedEquipmentUid,gift.v141Uid);assert.equal(state.equipmentLessonFunding,undefined);
 assert.equal(f.c.FourSymbolsAdventure.getEquipmentLessonOfferIntent(),null);assert.equal(f.c.FourSymbolsEquipmentShop.buyLessonArmor(),false);
 assert.equal(f.c.FourSymbolsAdventure.claimNodeReward('c1_03'),false);assert.equal(f.c.gold,money);
});

test('lesson rendered offer and purchased armor retain the exact cached UID and name across a refused purchase',()=>{
 const f=equipmentLessonFixture(),factory=f.c.FourSymbolsEquipmentFactory;let created=[];
 f.c.FourSymbolsEquipmentFactory={...factory,starter:id=>{const item=factory.starter(id);created.push(item);return item;}};
 const first=f.read(),shown=created[0];assert.equal(created.length,1);assert.ok(first.includes(shown.name));assert.equal(first,f.read());
 f.fail(f.repo.saveKey('shop-A'));assert.equal(f.buyLesson(),false);assert.equal(f.read(),first);assert.equal(created.length,1);
 f.fail(null);assert.equal(f.buyLesson(),true);assert.equal(f.c.inventoryItems[0].v141Uid,shown.v141Uid);assert.equal(f.c.inventoryItems[0].name,shown.name);
 assert.doesNotMatch(f.read(),/chapter1TutorialArmorBuy/);
});

test('a different lesson owner intent cannot reuse another character cached offer',()=>{
 const f=equipmentLessonFixture(),factory=f.c.FourSymbolsEquipmentFactory,created=[];
 f.c.FourSymbolsStartupPolicy={getUid:()=>f.repo.getActiveUid()};
 f.c.FourSymbolsEquipmentFactory={...factory,starter:id=>{const item=factory.starter(id);created.push(item);return item;}};
 f.read();f.repo.activate('shop-B');f.c.player.id='second-character';f.read();assert.equal(created.length,2);assert.notEqual(created[0].v141Uid,created[1].v141Uid);
 assert.equal(f.buyLesson(),true);assert.equal(f.c.inventoryItems[0].v141Uid,created[1].v141Uid);
});
