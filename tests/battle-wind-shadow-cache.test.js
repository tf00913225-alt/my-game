const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/39-v143-skill-animation.js','utf8');
test('shadow cache cleanup is sequence-owned, idempotent and releases replaced page reference',()=>{
 const context={};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('    function clearShadowCache('),source.indexOf('    function cleanupCurrent(')),context);
 const page={dataset:{vfxShadowCache:'8'}},old={sequence:7,shadowCachePage:page};context.clearShadowCache(old);assert.equal(page.dataset.vfxShadowCache,'8');assert.equal(old.shadowCachePage,null);
 const current={sequence:8,shadowCachePage:page};context.clearShadowCache(current);assert.equal(page.dataset.vfxShadowCache,undefined);context.clearShadowCache(current);context.clearShadowCache(null);
});
