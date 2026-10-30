const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/54-v173.51-battle-qa.js'),'utf8');
const block=source.slice(source.indexOf('const PARTY_ART_DENSITY='),source.indexOf('function setTextIfChanged'));
const context=vm.createContext({});
vm.runInContext(block+';globalThis.catalog=PARTY_ART_DENSITY;globalThis.height=partyPortraitHeight;',context);
const measurements=JSON.parse(fs.readFileSync(path.join(root,'docs/qa/PLAYER-BATTLE-PORTRAITS-20261030-optical.json'),'utf8'));
test('party optical metadata matches all current binary assets and equalizes area to the approved original rear baseline',()=>{
 assert.equal(Object.keys(context.catalog).length,10);
 const areas=[];
 for(const [file,record] of Object.entries(context.catalog)){
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),record.sha256,file);
  const factor=parseFloat(context.height('url("'+file+'")'))/100;
  const measured=measurements.assets.find(asset=>asset.runtimePath===file);
  if(measured){
   // The former <111.2% envelope described the retired PNG compositions.
   // New source shapes use the same optical formula and measured pixel area;
   // pin each result instead of loosening a blanket size limit.
   assert.equal(record.density,measured.density,file+' uses measured source density');
   assert.equal(record.sha256,measured.webpSha256,file+' uses the measured exact source');
   assert.ok(Math.abs(factor*100-measured.heightPercentAtUnchangedReference)<1e-12,file+' optical height matches the unchanged formula');
   assert.ok(Math.abs(record.density-measured.integerAlphaSum/(255*measured.height*measured.height))<1e-10,file+' density agrees with source alpha area');
  }else{
   assert.ok(file.startsWith('assets/heroes/'),file+' requires measured player metadata');
   assert.ok(factor>=1&&factor<1.112,file+' unchanged hero size stays in the original envelope');
  }
  areas.push(record.density*factor*factor);
  assert.equal(context.height('url("https://example.test/'+file+'?v=1")'),context.height('url("'+file+'")'));
 }
 assert.ok(Math.max(...areas)-Math.min(...areas)<1e-12);
 assert.ok(Math.abs(areas[0]-.520696867047023)<1e-12,"baseline is original rear vajra, not smallest party source");
 assert.equal(context.height('url("unknown.png")'),'100%');
 assert.equal(context.height('none'),'100%');
});

test('approved paint enlargement retains depth and cannot be replaced by critical translate shake',()=>{
 const css=fs.readFileSync(path.join(root,'css/fixed-slot-battlefield-rendering-v2.css'),'utf8');
 assert.match(css,/--battle-paint-scale:1\.3225;/);
 assert.match(css,/scale:var\(--battle-paint-scale\);/);
 assert.match(css,/\.battle-monster > \.v174-battle-art\{--battle-paint-offset-y:12px;\}/);
 assert.match(css,/top:max\([\s\S]*?var\(--battle-paint-offset-y, 0px\)[\s\S]*?var\(--battle-portrait-hud-clearance\)/);
 assert.doesNotMatch(css,/\.battle-monster \.v174-portrait-paint\{translate:/);
 assert.match(css,/--battle-art-depth:1\.18/);
 assert.match(css,/--battle-art-depth:1\.10/);
});
