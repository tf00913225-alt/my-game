import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
function setup(){
  const ctx=vm.createContext({console});
  for(const f of ['prototypes/exploration-corner/scene.js','js/exploration/taoxi-content.js','js/exploration/taoxi-progress.js'])vm.runInContext(fs.readFileSync(new URL(f,root),'utf8'),ctx);
  const C=ctx.FourSymbolsTaoxiContent,G=ctx.FourSymbolsExplorationGeometry;
  let uid='alice',saved=null,refuse=false,items={},full=false;
  const p={id:'test',gender:'male',element:'fire',adventureProgress:{chapters:{chapter_v1:{completedNodes:Object.fromEntries(Array.from({length:16},(_,i)=>['c1_'+String(i+1).padStart(2,'0'),true])),onboarding:{active:false,phase:'complete'}}}}};
  const progress=ctx.FourSymbolsTaoxiProgress.create({uid:()=>uid,player:()=>p,save(){if(refuse)return false;saved=JSON.stringify({p,items});return true;},transaction(fn){const old=JSON.stringify(items);try{if(fn())return true;}catch(_){}items=JSON.parse(old);return false;},addItem(id,n){if(full)return false;items[id]=(items[id]||0)+n;return true;}});
  return {C,G,p,progress,get items(){return items;},get saved(){return saved;},set refuse(v){refuse=v;},set uid(v){uid=v;},set full(v){full=v;}};
}
test('all-device content uses native portrait dimensions; eight creation appearances',()=>{
  const {C}=setup();assert.equal(C.houses.length,5);assert.equal(C.points.length,10);assert.equal(C.points.filter(p=>p.kind==='reward').length,6);
  const names=new Set();for(const gender of ['male','female'])for(const element of ['fire','water','wind','earth'])names.add(C.appearance({gender,element}));assert.equal(names.size,8);
  assert.throws(()=>C.appearance({element:'unknown'}));
});
test('opening requires each of five completed stages and complete inactive onboarding',()=>{
  const {C,p}=setup(),chapter=p.adventureProgress.chapters.chapter_v1;
  assert.equal(C.available(chapter),true);for(let i=1;i<=5;i++){const key='c1_0'+i;delete chapter.completedNodes[key];assert.equal(C.available(chapter),false);chapter.completedNodes[key]=true;}
  chapter.onboarding.active=true;assert.equal(C.available(chapter),false);chapter.onboarding.active=false;chapter.onboarding.phase='guidance';assert.equal(C.available(chapter),false);assert.equal(C.available(null),false);
});
test('C and E unlock only through reachable earlier clues; main progress unchanged',()=>{
  const f=setup(),{C,progress,p}=f,before=JSON.stringify(p.adventureProgress),locked=C.houses[2];
  assert.equal(C.unlocked(locked,progress.snapshot().chapter,progress.snapshot().state),false);
  assert.equal(progress.search('c-journal').ok,false);
  assert.equal(progress.talk('ayun').ok,true);assert.equal(C.unlocked(locked,progress.snapshot().chapter,progress.snapshot().state),false);
  assert.equal(progress.search('a-letter').ok,true);assert.equal(C.unlocked(locked,progress.snapshot().chapter,progress.snapshot().state),true);
  assert.equal(progress.search('c-journal').ok,true);assert.equal(C.unlocked(C.houses[4],progress.snapshot().chapter,progress.snapshot().state),true);
  assert.equal(JSON.stringify(p.adventureProgress),before);
});
test('reward and receipt commit once together, including after serialized reload',()=>{
  const f=setup();assert.equal(f.progress.search('a-chest').ok,true);const bytes=f.saved;
  assert.equal(f.items.hpPotion10,1);for(let i=0;i<12;i++)assert.equal(f.progress.search('a-chest').repeated,true);assert.equal(f.items.hpPotion10,1);
  f.p.explorationProgress=JSON.parse(bytes).p.explorationProgress;
  assert.equal(f.progress.search('a-chest').repeated,true);assert.equal(f.items.hpPotion10,1);
});
test('write refusal and full inventory retain both reward and receipt for retry',()=>{
  const f=setup();f.refuse=true;assert.equal(f.progress.search('a-chest').ok,false);assert.equal(f.items.hpPotion10,undefined);assert.equal(f.p.explorationProgress,undefined);assert.equal(f.saved,null);
  f.refuse=false;f.full=true;assert.equal(f.progress.search('a-chest').ok,false);assert.equal(f.p.explorationProgress,undefined);
  f.full=false;assert.equal(f.progress.search('a-chest').ok,true);assert.equal(f.items.hpPotion10,1);
});
test('UID mismatch and malformed retained history fail closed without grants',()=>{
  const f=setup();f.progress.search('a-letter');const before=f.saved;f.uid='bob';assert.equal(f.progress.search('a-chest').ok,false);assert.equal(f.saved,before);assert.equal(f.items.hpPotion10,undefined);
  f.uid='alice';f.p.explorationProgress.searched['a-chest']=false;assert.equal(f.progress.search('a-chest').ok,false);assert.equal(f.items.hpPotion10,undefined);
});
test('actual hydration clears an absent next-UID extension after the original validated copy boundary',()=>{
  const main=fs.readFileSync(new URL('js/00-main.js',root),'utf8');
  const boundary=main.slice(main.indexOf('const hydratedHeroAccount='));
  const copy=boundary.match(/Object\.assign\(\s*player,\s*data\.player\s*\);[\s\S]*?(?=migrateLegacySixStats\(player\))/);
  assert.ok(copy,'formal hydration boundary must exist');
  const alice={version:1,ownerUid:'alice',talked:{},searched:{'a-chest':true}};
  const player={id:'Alice',explorationProgress:alice};
  const context=vm.createContext({player,data:{player:{id:'Bob'}}});
  vm.runInContext(copy[0],context);assert.equal(player.id,'Bob');assert.equal(Object.hasOwn(player,'explorationProgress'),false);
  assert.equal(alice.searched['a-chest'],true,'retained original record is not erased');
  context.data={player:{id:'Alice',explorationProgress:alice}};
  vm.runInContext(copy[0],context);assert.equal(player.explorationProgress,alice,'explicit retained extension survives');
});
test('all five houses, NPC approaches, exits and ten points have collision-safe routes',()=>{
  const {C,G}=setup(),v=C.village();assert.equal(G.canStand(v.spawn.x,v.spawn.y,v),true);
  for(const object of v.objects.filter(o=>o.interaction))assert.ok(G.findRoute(v.spawn,object.approach,v),'village '+object.id);
  for(const h of C.houses){const data=C.interior(h.id);for(const object of data.objects.filter(o=>o.interaction))assert.ok(G.findRoute(data.spawn,object.approach,data),'interior '+object.id);}
});
