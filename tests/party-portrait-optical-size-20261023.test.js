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
test('party optical metadata matches all current binary assets and equalizes area inside safe envelope',()=>{
 assert.equal(Object.keys(context.catalog).length,10);
 const areas=[];
 for(const [file,record] of Object.entries(context.catalog)){
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),record.sha256,file);
  const factor=parseFloat(context.height('url("'+file+'")'))/100;
  assert.ok(factor>0&&factor<=1,file+' never enlarges outside frame');
  areas.push(record.density*factor*factor);
  assert.equal(context.height('url("https://example.test/'+file+'?v=1")'),context.height('url("'+file+'")'));
 }
 assert.ok(Math.max(...areas)-Math.min(...areas)<1e-12);
 assert.equal(context.height('url("unknown.png")'),'100%');
 assert.equal(context.height('none'),'100%');
});
