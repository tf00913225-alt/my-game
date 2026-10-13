'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/60-team-relic-system.js','utf8');
const functions=source.slice(source.indexOf('    function loadBattleIdentityImage('),source.indexOf('    async function beginRelicCinematic('));
const dedicated='assets/relics/battle-icons/relic_nine_dragon_fire.webp';
const listing='assets/relics/icons/relic_nine_dragon_fire.webp';
function fixture(failure){
 const requests=[];
 class Image{
  complete=false;naturalWidth=0;
  set src(path){requests.push(path);queueMicrotask(()=>{if(failure==='load'){this.onerror();return;}this.complete=true;this.naturalWidth=256;this.onload();});}
  decode(){return failure==='decode'?Promise.reject(Error('decode failed')):Promise.resolve();}
 }
 const context={Image};vm.runInNewContext(functions,context);return {resolve:context.resolveBattleIdentityIcon,requests};
}
test('all battle modes resolve the same dedicated identity asset after decode',async()=>{
 const f=fixture();
 for(const mode of ['normal','daily','abyss','tower','personal','world'])assert.equal(await f.resolve({battleIconPath:dedicated,iconPath:listing,mode}),dedicated);
 assert.deepEqual(f.requests,Array(6).fill(dedicated));
});
for(const failure of ['load','decode'])test(`${failure} failure rejects without substituting list artwork; recovery keeps dedicated identity`,async()=>{
 const f=fixture(failure);await assert.rejects(f.resolve({battleIconPath:dedicated,iconPath:listing}));assert.deepEqual(f.requests,[dedicated]);
 const recovered=fixture();assert.equal(await recovered.resolve({battleIconPath:dedicated,iconPath:listing}),dedicated);
});
test('missing dedicated mapping rejects before any request, even with a list icon',async()=>{
 const f=fixture();await assert.rejects(f.resolve({iconPath:listing}),/路徑為空/);assert.deepEqual(f.requests,[]);
});
