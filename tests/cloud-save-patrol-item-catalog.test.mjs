import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {buildPatrolItemCatalog,syncPatrolItemCatalog,PATROL_ITEM_CATALOG_PATH} from '../scripts/lib/item-acquisition-projection.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const itemPath='js/27-v132-content-expansion.js',dropPath='functions/src/patrol-drop-policy.js';
function temporary(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'patrol-item-catalog-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 for(const file of [itemPath,dropPath]){
  fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});
  fs.copyFileSync(path.join(root,file),path.join(dir,file));
 }
 return dir;
}
function mutate(dir,file,from,to){
 const target=path.join(dir,file),source=fs.readFileSync(target,'utf8');
 assert.ok(source.includes(from),from);fs.writeFileSync(target,source.replace(from,to));
}
test('eleven projected items equal the actual bounded Client definition constructors',()=>{
 const source=fs.readFileSync(path.join(root,itemPath),'utf8');
 // Independent Client section extraction retains the formal constructors and
 // exported lookup behavior, without executing a gameplay or award path.
 const icons=source.slice(source.indexOf('    const TALISMAN_ART='),source.indexOf('    function oreIcon('));
 const ticketIcon=source.slice(source.indexOf('    function ticketIcon('),source.indexOf('    const SET_PALETTE='));
 const tiers=source.slice(source.indexOf('    const FORMAL_ITEM_TIERS='),source.indexOf('    /* =====================================================\n       4.'));
 const tickets=source.slice(source.indexOf('    const ticketDefinitions='),source.indexOf('    /*\n       V169：抽獎券圖'));
 const sandbox=vm.createContext({window:{}},{codeGeneration:{strings:false,wasm:false}});
 const actual=JSON.parse(vm.runInContext(icons+'\n'+ticketIcon+'\n'+tiers+'\n'+tickets+
  '\nJSON.stringify([...talismanDefinitions,...oreDefinitions,...ticketDefinitions])',sandbox,{timeout:1000}));
 const catalog=buildPatrolItemCatalog(root),definitions=new Map(actual.map(item=>[item.id,item]));
 const dropSandbox=vm.createContext({window:{}});
 vm.runInContext(fs.readFileSync(path.join(root,dropPath),'utf8'),dropSandbox,{timeout:1000});
 const allowlist=JSON.parse(vm.runInContext('JSON.stringify([...new Set([...window.FourSymbolsPatrolDropPolicy.normalRows,...window.FourSymbolsPatrolDropPolicy.eliteRows].map(row=>row.itemId))])',dropSandbox));
 assert.equal(allowlist.length,11);assert.deepEqual(Object.keys(catalog.items),allowlist);
 for(const id of allowlist)assert.deepEqual(catalog.items[id],definitions.get(id),id);
 assert.equal(catalog.outcomeVerified,false);assert.equal(catalog.rewardEligible,false);
 assert.match(catalog.sha256,/^[a-f0-9]{64}$/);
 assert.equal(JSON.stringify(catalog),JSON.stringify(buildPatrolItemCatalog(root)));
});
test('formal data drift regenerates exact definitions while unrelated gameplay is never evaluated',t=>{
 const dir=temporary(t),before=buildPatrolItemCatalog(dir);
 mutate(dir,itemPath,'{key:"freeze",label:"冰封符",duration:4}','{key:"freeze",label:"冰封符",duration:5}');
 const changed=buildPatrolItemCatalog(dir);
 assert.equal(changed.items.freezeTalismanLow.talismanDuration,5);
 assert.equal(changed.items.freezeTalismanMid.talismanDuration,5);assert.notEqual(changed.sha256,before.sha256);
 fs.appendFileSync(path.join(dir,itemPath),'\nthrow new Error("whole gameplay must not execute");\n');
 assert.deepEqual(buildPatrolItemCatalog(dir),changed);
});
test('checkOnly never writes missing or stale output; synchronization is deterministic',t=>{
 const dir=temporary(t),file=path.join(dir,PATROL_ITEM_CATALOG_PATH);
 assert.throws(()=>syncPatrolItemCatalog(dir,true),/stale/);assert.equal(fs.existsSync(file),false);
 syncPatrolItemCatalog(dir);const bytes=fs.readFileSync(file,'utf8'),mtime=fs.statSync(file).mtimeMs;
 syncPatrolItemCatalog(dir,true);assert.equal(fs.statSync(file).mtimeMs,mtime);
 mutate(dir,itemPath,'ticketSetFire",name:"赤炎裝備抽獎券','ticketSetFire",name:"正式漂移抽獎券');
 assert.throws(()=>syncPatrolItemCatalog(dir,true),/stale/);assert.equal(fs.readFileSync(file,'utf8'),bytes);
 syncPatrolItemCatalog(dir);assert.notEqual(fs.readFileSync(file,'utf8'),bytes);
});
test('unknown drop IDs, duplicate definitions, missing constructors and runtime dependencies fail closed',t=>{
 const cases=[
  [dropPath,'itemId:"oreLow"','itemId:"unsupportedPatrolItem"'],
  [dropPath,'chance:.05,quantity:1','chance:.05,quantity:2'],
  [itemPath,'id:"ticketSetWater"','id:"ticketSetFire"'],
  [itemPath,'function rasterItemIcon(path,tier,kind){','function retiredRasterItemIcon(path,tier,kind){'],
  [itemPath,'const rarity=tier?','const clock=Date.now(); const rarity=tier?'],
  [itemPath,'const rarity=tier?','const value=process.env; const rarity=tier?'],
  [itemPath,'type:"ticket",','type:"unsupported",']
 ];
 for(const [file,from,to] of cases){
  const dir=temporary(t);mutate(dir,file,from,to);
  assert.throws(()=>buildPatrolItemCatalog(dir),undefined,from);
  assert.equal(fs.existsSync(path.join(dir,PATROL_ITEM_CATALOG_PATH)),false);
 }
});
