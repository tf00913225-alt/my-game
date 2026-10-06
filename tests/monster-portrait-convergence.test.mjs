import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';

const registry=JSON.parse(fs.readFileSync('config/monster-portrait-registry.json','utf8'));
const source=fs.readFileSync('js/45-v154-dev-fixes.js','utf8');
const presentation=fs.readFileSync('js/54-v173.51-battle-qa.js','utf8');
const context={console,window:null,document:{getElementById(){return null;},querySelectorAll(){return [];}},currentBattleMonsters:[],monsters:[]};
context.window=context;vm.createContext(context);vm.runInContext(source,context);context.v154InstallMonsterPortraitRegistry(registry);
const rows=Object.values(registry.groups).flat().map(row=>Object.fromEntries(registry.tupleSchema.map((k,i)=>[k,row[i]])));
assert.equal(new Set(rows.map(t=>t.portraitKey)).size,rows.length);
for(const target of rows){
 const monster={name:target.name,element:target.element,rank:target.rank,portraitKey:target.portraitKey};
 const record=context.v154ResolveMonsterPortraitRecord(monster);
 if(target.status==='existing')assert.equal(record.path,target.path,target.portraitKey);
 else{assert.equal(record.status,'fallback');assert.equal(record.generic,true);assert.equal(record.path,null);}
 assert.equal(monster.name,target.name,'resolver cannot rename an Encounter');
}
for(const entry of registry.assetPool.entries.filter(e=>e.status==='adopted')){
 const monster={name:'天兵天將',element:entry.element,portraitKey:entry.assetId};
 context.v154BindMonsterPortraitIdentity(monster);assert.equal(monster.name,entry.displayName);
 assert.equal(context.v154ResolveMonsterPortraitRecord(monster).path,entry.runtimePath);
}
const known=rows.find(t=>t.status==='existing'),planned=rows.find(t=>t.status==='planned');
for(const target of rows.filter(t=>t.group==='adventure'||t.portraitKey.startsWith('adventure.'))){
 const result=context.v154ResolveMonsterPortraitRecord({monsterKey:target.portraitKey,name:target.name,element:target.element,rank:target.rank});
 assert.equal(result.requestedPortraitKey,target.portraitKey);assert.equal(result.fallbackReason,'planned');
}
assert.equal(context.v154ResolveMonsterPortraitRecord({name:known.name,portraitKey:planned.portraitKey}).path,null,'explicit missing identity cannot fall through to a different name');
assert.equal(context.v154ResolveMonsterPortraitRecord({name:'任意中文／../未註冊王',element:'fire',rank:'boss'}).path,null);
for(const [file,meta] of Object.entries(registry.presentation.assets)){
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),meta.sha256,file+' metadata is stale');
 const [l,t,r,b]=meta.alphaBounds;
 assert.ok(l>=0&&t>=0&&r>l&&b>t&&r<=meta.width&&b<=meta.height,file+' visual bounds');
 for(const contract of Object.values(registry.presentation.classes)){
  const height=200,width=140,bh=(b-t)/meta.height,bw=(r-l)/meta.width,aspect=meta.width/meta.height;
  const canvasWidth=Math.min(width/bw,contract.bodyHeight*aspect/bh*height),canvasHeight=canvasWidth/aspect;
  const bodyHeight=canvasHeight*bh,bottom=height*contract.baseline,top=bottom-bodyHeight;
  assert.ok(top>=0&&bottom<=height&&canvasWidth*bw<=width+1e-8,file+' full alpha must fit');
  assert.ok(bodyHeight<=height*contract.bodyHeight+1e-8,file+' body class range');
 }
}
assert.deepEqual(Object.keys(registry.presentation.classes),['STANDARD','ELITE','SMALL_BOSS','BIG_BOSS']);
assert.doesNotMatch(presentation,/transform:\s*scale|MutationObserver/);
assert.doesNotMatch(source,/EARLY_ABYSS_PORTRAITS|FINAL_ABYSS_PORTRAITS|temporary\.heavenly-soldier|temporary\.boss-reference/);
console.log('Monster portrait full identity / planned / explicit key / scale / baseline / no-clipping contracts PASS');
